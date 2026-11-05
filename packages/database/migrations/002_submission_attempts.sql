-- Fail safely rather than silently deleting duplicate student grades.
DO $check$
BEGIN
  IF EXISTS (SELECT 1 FROM practical_submissions GROUP BY student_id, practical_id HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'Duplicate student/practical grades exist. Review and reconcile them before applying migration 002.';
  END IF;
  IF (SELECT data_type FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'practical_submissions' AND column_name = 'code') <> 'bytea' THEN
    RAISE EXCEPTION 'Expected practical_submissions.code BYTEA. Review the deployed schema before migration.';
  END IF;
END
$check$;
-- statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS uq_submission_student_practical ON practical_submissions(student_id, practical_id);
-- statement-breakpoint
CREATE TABLE IF NOT EXISTS submission_attempts (
  job_id text PRIMARY KEY,
  student_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  practical_id integer NOT NULL REFERENCES practicals(id) ON DELETE CASCADE,
  code bytea NOT NULL, language text NOT NULL,
  normalized_marks numeric NOT NULL CHECK(normalized_marks BETWEEN 0 AND 10),
  raw_marks numeric NOT NULL CHECK(raw_marks >= 0),
  case_results jsonb NOT NULL, result jsonb NOT NULL,
  submitted_at timestamptz NOT NULL, completed_at timestamptz NOT NULL DEFAULT now()
);
-- statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_attempts_student_practical_time ON submission_attempts(student_id, practical_id, submitted_at DESC);
-- statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_cases_practical_order ON practical_test_cases(practical_id, order_index);
-- statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_results_submission ON practical_submission_cases(submission_id);
-- statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_practicals_course_status ON practicals(course_id, status);
-- statement-breakpoint
CREATE TABLE IF NOT EXISTS submission_resets (
 student_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 practical_id integer NOT NULL REFERENCES practicals(id) ON DELETE CASCADE,
 reset_at timestamptz NOT NULL, PRIMARY KEY(student_id, practical_id)
);
-- statement-breakpoint
CREATE OR REPLACE FUNCTION coderank_save_attempt(
  p_job_id text, p_student integer, p_practical integer, p_code text, p_language text,
  p_status text, p_raw numeric, p_normalized numeric, p_runtime numeric,
  p_late boolean, p_submitted_at timestamptz, p_cases jsonb, p_result jsonb
) RETURNS jsonb LANGUAGE plpgsql AS $function$
DECLARE
  prior submission_attempts%ROWTYPE;
  best practical_submissions%ROWTYPE;
  changed_id integer;
  outcome jsonb;
BEGIN
  IF length(p_job_id) NOT BETWEEN 1 AND 200 OR p_normalized NOT BETWEEN 0 AND 10 OR p_raw < 0 OR p_runtime < 0 THEN
    RAISE EXCEPTION 'Invalid submission attempt';
  END IF;
  -- The same lock is used by deletion, so a grade cannot be half-deleted.
  PERFORM pg_advisory_xact_lock(p_student, p_practical);
  SELECT * INTO prior FROM submission_attempts WHERE job_id = p_job_id;
  IF FOUND THEN
    IF prior.student_id <> p_student OR prior.practical_id <> p_practical OR prior.code <> convert_to(p_code, 'UTF8') OR prior.language <> p_language THEN
      RAISE EXCEPTION 'Job identity conflicts with an existing attempt';
    END IF;
    RETURN prior.result;
  END IF;
  IF EXISTS (SELECT 1 FROM submission_resets WHERE student_id = p_student AND practical_id = p_practical AND reset_at >= p_submitted_at) THEN
    RAISE EXCEPTION 'Submission was reset after this job was queued';
  END IF;
  IF jsonb_typeof(p_cases) <> 'array' OR jsonb_array_length(p_cases) > 20 THEN
    RAISE EXCEPTION 'Invalid test case results';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_to_recordset(p_cases) AS r(test_case_id integer)
    LEFT JOIN practical_test_cases t ON t.id = r.test_case_id AND t.practical_id = p_practical
    WHERE t.id IS NULL
  ) OR (SELECT count(*) FROM jsonb_array_elements(p_cases)) <>
       (SELECT count(DISTINCT (value->>'test_case_id')::integer) FROM jsonb_array_elements(p_cases)) THEN
    RAISE EXCEPTION 'Test cases changed or do not belong to this practical';
  END IF;

  INSERT INTO practical_submissions(student_id, practical_id, code, language, status,
    raw_marks, normalized_marks, execution_time_ms, is_late, submitted_at)
  VALUES(p_student, p_practical, convert_to(p_code, 'UTF8'), p_language, p_status,
    p_raw, p_normalized, p_runtime, p_late, p_submitted_at)
  ON CONFLICT(student_id, practical_id) DO UPDATE SET
    code = EXCLUDED.code, language = EXCLUDED.language, status = EXCLUDED.status,
    raw_marks = EXCLUDED.raw_marks, normalized_marks = EXCLUDED.normalized_marks,
    execution_time_ms = EXCLUDED.execution_time_ms, is_late = EXCLUDED.is_late,
    submitted_at = EXCLUDED.submitted_at
  WHERE EXCLUDED.normalized_marks > practical_submissions.normalized_marks
    OR (EXCLUDED.normalized_marks = practical_submissions.normalized_marks AND EXCLUDED.raw_marks > practical_submissions.raw_marks)
    OR (EXCLUDED.normalized_marks = practical_submissions.normalized_marks AND EXCLUDED.status = 'Accepted' AND practical_submissions.status <> 'Accepted')
    OR (EXCLUDED.normalized_marks = practical_submissions.normalized_marks AND practical_submissions.status = 'Compile Error' AND EXCLUDED.status <> 'Compile Error')
  RETURNING id INTO changed_id;

  SELECT * INTO STRICT best FROM practical_submissions WHERE student_id = p_student AND practical_id = p_practical;
  IF changed_id IS NOT NULL THEN
    DELETE FROM practical_submission_cases WHERE submission_id = changed_id;
    INSERT INTO practical_submission_cases(submission_id, test_case_id, passed, marks_awarded, actual_output, error_message, execution_time_ms)
    SELECT changed_id, r.test_case_id, r.passed, r.marks_awarded, r.actual_output, r.error_message, r.execution_time_ms
    FROM jsonb_to_recordset(p_cases) AS r(test_case_id integer, passed boolean, marks_awarded numeric, actual_output text, error_message text, execution_time_ms numeric);
  END IF;
  outcome := p_result || jsonb_build_object('submissionId', best.id, 'normalizedMarks', best.normalized_marks,
    'rawMarks', best.raw_marks, 'overallStatus', best.status, 'attemptId', p_job_id);
  INSERT INTO submission_attempts(job_id, student_id, practical_id, code, language, normalized_marks, raw_marks, case_results, result, submitted_at)
  VALUES(p_job_id, p_student, p_practical, convert_to(p_code,'UTF8'), p_language, p_normalized, p_raw, p_cases, outcome, p_submitted_at);
  RETURN outcome;
END
$function$;
-- statement-breakpoint
CREATE OR REPLACE FUNCTION coderank_delete_submission(p_student integer, p_practical integer)
RETURNS void LANGUAGE plpgsql AS $function$
BEGIN
  PERFORM pg_advisory_xact_lock(p_student, p_practical);
  INSERT INTO submission_resets(student_id, practical_id, reset_at)
  VALUES(p_student, p_practical, clock_timestamp())
  ON CONFLICT(student_id, practical_id) DO UPDATE SET reset_at = EXCLUDED.reset_at;
  DELETE FROM practical_submission_cases WHERE submission_id IN
    (SELECT id FROM practical_submissions WHERE student_id = p_student AND practical_id = p_practical);
  DELETE FROM practical_submissions WHERE student_id = p_student AND practical_id = p_practical;
  DELETE FROM student_workspaces WHERE student_id = p_student AND practical_id = p_practical;
  -- Attempts retain the replay ledger: a stalled old job cannot recreate a deleted grade.
END
$function$;
