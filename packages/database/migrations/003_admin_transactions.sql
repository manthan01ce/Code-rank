CREATE OR REPLACE FUNCTION coderank_replace_mapping(p_admin integer, p_course integer, p_faculty integer[], p_co integer)
RETURNS void LANGUAGE plpgsql AS $function$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM users WHERE id=p_admin AND role='admin' AND status='active') THEN
  RAISE EXCEPTION 'Administrator required' USING ERRCODE='42501';
 END IF;
 PERFORM 1 FROM courses WHERE id=p_course FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Course not found' USING ERRCODE='P0002'; END IF;
 IF cardinality(p_faculty)>4 OR cardinality(p_faculty)<>(SELECT count(DISTINCT f) FROM unnest(p_faculty) f)
 OR EXISTS(SELECT 1 FROM unnest(p_faculty) f LEFT JOIN users u ON u.id=f AND u.role='faculty' AND u.status='active' WHERE u.id IS NULL)
 OR (cardinality(p_faculty)>0 AND NOT p_co=ANY(p_faculty)) THEN
  RAISE EXCEPTION 'Invalid faculty mapping' USING ERRCODE='22023';
 END IF;
 DELETE FROM course_faculty WHERE course_id=p_course;
 INSERT INTO course_faculty(course_id,faculty_id,is_co_coordinator) SELECT p_course,f,f=p_co FROM unnest(p_faculty) f;
 UPDATE courses SET assigned_faculty=p_co WHERE id=p_course;
 INSERT INTO activity_logs(user_id,action,details) VALUES(p_admin,'UPDATE_MAPPING','Updated course '||p_course);
END
$function$;
-- statement-breakpoint
CREATE OR REPLACE FUNCTION coderank_mutate_practical(p_actor integer,p_id integer,p_action text,p_body jsonb)
RETURNS jsonb LANGUAGE plpgsql AS $function$
DECLARE
 p practicals%ROWTYPE;
 course integer;
 total numeric;
 cases jsonb;
 has_cases boolean;
 deadline timestamptz;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM users WHERE id=p_actor AND role='faculty' AND status='active') THEN
  RAISE EXCEPTION 'Faculty required' USING ERRCODE='42501';
 END IF;
 IF p_action='create' THEN course:=(p_body->>'course_id')::integer;
 ELSE
  SELECT * INTO p FROM practicals WHERE id=p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Practical not found' USING ERRCODE='P0002'; END IF;
  course:=p.course_id;
 END IF;
 -- Shared row lock prevents concurrent remapping from revoking authority mid-write.
 PERFORM 1 FROM courses WHERE id=course FOR SHARE;
 IF NOT EXISTS(SELECT 1 FROM course_faculty WHERE course_id=course AND faculty_id=p_actor AND (p_action='extend' OR is_co_coordinator)) THEN
  RAISE EXCEPTION 'Course authorization required' USING ERRCODE='42501';
 END IF;
 IF p_action='delete' THEN
  -- Always archive: deleting cases/attempts would erase grading history.
  UPDATE practicals SET status='inactive',updated_at=now() WHERE id=p_id RETURNING * INTO p;
 ELSIF p_action='extend' THEN
  IF p_body->>'newEndTime' IS NOT NULL THEN deadline:=(p_body->>'newEndTime')::timestamptz;
  ELSE deadline:=greatest(coalesce(p.end_time,now()),now())+make_interval(mins=>(p_body->>'extraMinutes')::integer); END IF;
  IF deadline IS NULL OR deadline<=greatest(coalesce(p.end_time,now()),now()) THEN RAISE EXCEPTION 'Deadline must extend the practical' USING ERRCODE='22023'; END IF;
  UPDATE practicals SET end_time=deadline,updated_at=now() WHERE id=p_id RETURNING * INTO p;
 ELSIF p_action IN ('create','update') THEN
  cases:=p_body->'test_cases';
  has_cases:=cases IS NOT NULL AND jsonb_array_length(cases)>0;
  IF p_action='create' AND NOT has_cases THEN RAISE EXCEPTION 'Test cases required' USING ERRCODE='22023'; END IF;
  IF has_cases THEN
   IF jsonb_typeof(cases)<>'array' OR jsonb_array_length(cases)>20 OR EXISTS(SELECT 1 FROM jsonb_array_elements(cases) t WHERE (t->>'marks')::numeric<0 OR t->>'marks' IS NULL) THEN
    RAISE EXCEPTION 'Invalid test cases' USING ERRCODE='22023';
   END IF;
   -- Existing case IDs are referenced by grades and immutable attempts.
   IF p_action='update' AND (EXISTS(SELECT 1 FROM practical_submissions WHERE practical_id=p_id) OR EXISTS(SELECT 1 FROM submission_attempts WHERE practical_id=p_id)) THEN
    IF (SELECT jsonb_agg(jsonb_build_object('input',input,'expected',expected,'marks',marks,'is_hidden',is_hidden,'time_limit',time_limit,'memory_limit',memory_limit,'label',label) ORDER BY order_index) FROM practical_test_cases WHERE practical_id=p_id)
      IS DISTINCT FROM (SELECT jsonb_agg(jsonb_build_object('input',t->>'input','expected',t->>'expected','marks',(t->>'marks')::numeric,'is_hidden',coalesce((t->>'is_hidden')::boolean,false),'time_limit',(t->>'time_limit')::numeric,'memory_limit',(t->>'memory_limit')::numeric,'label',coalesce(t->>'label','Test Case '||n)) ORDER BY n) FROM jsonb_array_elements(cases) WITH ORDINALITY c(t,n)) THEN
     RAISE EXCEPTION 'Graded test cases are immutable; create a new practical' USING ERRCODE='23514';
    END IF;
    has_cases:=false;
   END IF;
  END IF;
  SELECT sum((t->>'marks')::numeric) INTO total FROM jsonb_array_elements(coalesce(cases,'[]')) t;
  IF p_action='create' THEN
   INSERT INTO practicals(faculty_id,course_id,batch_id,title,description) VALUES(p_actor,course,'All',p_body->>'title',p_body->>'description') RETURNING * INTO p;
   p_id:=p.id;
  END IF;
  UPDATE practicals SET title=p_body->>'title',description=p_body->>'description',instructions=coalesce(p_body->>'instructions',''),
   difficulty=coalesce(p_body->>'difficulty','Easy'),is_challenge=coalesce((p_body->>'is_challenge')::boolean,false),starter_code=coalesce(p_body->'starter_code','{}'),
   input_format=coalesce(p_body->>'input_format',''),output_format=coalesce(p_body->>'output_format',''),constraints=coalesce(p_body->>'constraints',''),
   sample_input=coalesce(p_body->>'sample_input',''),sample_output=coalesce(p_body->>'sample_output',''),topics=coalesce(p_body->>'topics',''),
   start_time=(p_body->>'start_time')::timestamptz,end_time=(p_body->>'end_time')::timestamptz,
   total_marks=CASE WHEN has_cases THEN total ELSE p.total_marks END,updated_at=now()
  WHERE id=p_id RETURNING * INTO p;
  IF has_cases THEN
   DELETE FROM practical_test_cases WHERE practical_id=p_id;
   INSERT INTO practical_test_cases(practical_id,input,expected,marks,is_hidden,time_limit,memory_limit,order_index,label)
   SELECT p_id,t->>'input',t->>'expected',(t->>'marks')::numeric,coalesce((t->>'is_hidden')::boolean,false),(t->>'time_limit')::numeric,(t->>'memory_limit')::numeric,n-1,coalesce(t->>'label','Test Case '||n)
   FROM jsonb_array_elements(cases) WITH ORDINALITY c(t,n);
  END IF;
 ELSE RAISE EXCEPTION 'Invalid practical action' USING ERRCODE='22023';
 END IF;
 INSERT INTO activity_logs(user_id,action,details) VALUES(p_actor,upper(p_action)||'_PRACTICAL','Practical '||p_id);
 RETURN to_jsonb(p);
END
$function$;
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
  PERFORM 1 FROM practicals WHERE id=p_practical AND status='active' FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Practical no longer active'; END IF;
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
