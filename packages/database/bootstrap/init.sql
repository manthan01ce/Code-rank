--
-- PostgreSQL database dump
--


-- Dumped from database version 16.15
-- Dumped by pg_dump version 16.15

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

ALTER TABLE IF EXISTS ONLY public.submission_resets DROP CONSTRAINT IF EXISTS submission_resets_student_id_fkey;
ALTER TABLE IF EXISTS ONLY public.submission_resets DROP CONSTRAINT IF EXISTS submission_resets_practical_id_fkey;
ALTER TABLE IF EXISTS ONLY public.submission_attempts DROP CONSTRAINT IF EXISTS submission_attempts_student_id_fkey;
ALTER TABLE IF EXISTS ONLY public.submission_attempts DROP CONSTRAINT IF EXISTS submission_attempts_practical_id_fkey;
ALTER TABLE IF EXISTS ONLY public.student_workspaces DROP CONSTRAINT IF EXISTS student_workspaces_student_id_fkey;
ALTER TABLE IF EXISTS ONLY public.student_workspaces DROP CONSTRAINT IF EXISTS student_workspaces_practical_id_fkey;
ALTER TABLE IF EXISTS ONLY public.practicals DROP CONSTRAINT IF EXISTS practicals_faculty_id_fkey;
ALTER TABLE IF EXISTS ONLY public.practicals DROP CONSTRAINT IF EXISTS practicals_course_id_fkey;
ALTER TABLE IF EXISTS ONLY public.practical_test_cases DROP CONSTRAINT IF EXISTS practical_test_cases_practical_id_fkey;
ALTER TABLE IF EXISTS ONLY public.practical_submissions DROP CONSTRAINT IF EXISTS practical_submissions_student_id_fkey;
ALTER TABLE IF EXISTS ONLY public.practical_submissions DROP CONSTRAINT IF EXISTS practical_submissions_practical_id_fkey;
ALTER TABLE IF EXISTS ONLY public.practical_submission_cases DROP CONSTRAINT IF EXISTS practical_submission_cases_test_case_id_fkey;
ALTER TABLE IF EXISTS ONLY public.practical_submission_cases DROP CONSTRAINT IF EXISTS practical_submission_cases_submission_id_fkey;
ALTER TABLE IF EXISTS ONLY public.courses DROP CONSTRAINT IF EXISTS courses_assigned_faculty_fkey;
ALTER TABLE IF EXISTS ONLY public.course_faculty DROP CONSTRAINT IF EXISTS course_faculty_faculty_id_fkey;
ALTER TABLE IF EXISTS ONLY public.course_faculty DROP CONSTRAINT IF EXISTS course_faculty_course_id_fkey;
DROP INDEX IF EXISTS public.uq_submission_student_practical;
DROP INDEX IF EXISTS public.idx_workspaces_retention;
DROP INDEX IF EXISTS public.idx_users_status;
DROP INDEX IF EXISTS public.idx_users_role;
DROP INDEX IF EXISTS public.idx_users_active_students_id;
DROP INDEX IF EXISTS public.idx_results_submission;
DROP INDEX IF EXISTS public.idx_practicals_course_status;
DROP INDEX IF EXISTS public.idx_practicals_active_id;
DROP INDEX IF EXISTS public.idx_practical_submissions_student;
DROP INDEX IF EXISTS public.idx_practical_submissions_practical;
DROP INDEX IF EXISTS public.idx_departments_name;
DROP INDEX IF EXISTS public.idx_courses_semester;
DROP INDEX IF EXISTS public.idx_courses_course_code;
DROP INDEX IF EXISTS public.idx_course_faculty_faculty;
DROP INDEX IF EXISTS public.idx_course_faculty_course;
DROP INDEX IF EXISTS public.idx_cases_practical_order;
DROP INDEX IF EXISTS public.idx_attempts_student_practical_time;
DROP INDEX IF EXISTS public.idx_activity_logs_retention;
ALTER TABLE IF EXISTS ONLY public.users DROP CONSTRAINT IF EXISTS users_pkey;
ALTER TABLE IF EXISTS ONLY public.users DROP CONSTRAINT IF EXISTS users_email_key;
ALTER TABLE IF EXISTS ONLY public.submission_resets DROP CONSTRAINT IF EXISTS submission_resets_pkey;
ALTER TABLE IF EXISTS ONLY public.submission_attempts DROP CONSTRAINT IF EXISTS submission_attempts_pkey;
ALTER TABLE IF EXISTS ONLY public.student_workspaces DROP CONSTRAINT IF EXISTS student_workspaces_pkey;
ALTER TABLE IF EXISTS ONLY public.practicals DROP CONSTRAINT IF EXISTS practicals_pkey;
ALTER TABLE IF EXISTS ONLY public.practical_test_cases DROP CONSTRAINT IF EXISTS practical_test_cases_pkey;
ALTER TABLE IF EXISTS ONLY public.practical_submissions DROP CONSTRAINT IF EXISTS practical_submissions_pkey;
ALTER TABLE IF EXISTS ONLY public.practical_submission_cases DROP CONSTRAINT IF EXISTS practical_submission_cases_pkey;
ALTER TABLE IF EXISTS ONLY public.departments DROP CONSTRAINT IF EXISTS departments_pkey;
ALTER TABLE IF EXISTS ONLY public.departments DROP CONSTRAINT IF EXISTS departments_name_key;
ALTER TABLE IF EXISTS ONLY public.courses DROP CONSTRAINT IF EXISTS courses_pkey;
ALTER TABLE IF EXISTS ONLY public.courses DROP CONSTRAINT IF EXISTS courses_course_code_key;
ALTER TABLE IF EXISTS ONLY public.course_faculty DROP CONSTRAINT IF EXISTS course_faculty_pkey;
ALTER TABLE IF EXISTS ONLY public.coderank_migrations DROP CONSTRAINT IF EXISTS coderank_migrations_pkey;
ALTER TABLE IF EXISTS ONLY public.activity_logs DROP CONSTRAINT IF EXISTS activity_logs_pkey;
ALTER TABLE IF EXISTS public.users ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.practicals ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.practical_test_cases ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.practical_submissions ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.practical_submission_cases ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.departments ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.courses ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.activity_logs ALTER COLUMN id DROP DEFAULT;
DROP SEQUENCE IF EXISTS public.users_id_seq;
DROP TABLE IF EXISTS public.users;
DROP TABLE IF EXISTS public.submission_resets;
DROP TABLE IF EXISTS public.submission_attempts;
DROP TABLE IF EXISTS public.student_workspaces;
DROP SEQUENCE IF EXISTS public.practicals_id_seq;
DROP TABLE IF EXISTS public.practicals;
DROP SEQUENCE IF EXISTS public.practical_test_cases_id_seq;
DROP TABLE IF EXISTS public.practical_test_cases;
DROP SEQUENCE IF EXISTS public.practical_submissions_id_seq;
DROP TABLE IF EXISTS public.practical_submissions;
DROP SEQUENCE IF EXISTS public.practical_submission_cases_id_seq;
DROP TABLE IF EXISTS public.practical_submission_cases;
DROP SEQUENCE IF EXISTS public.departments_id_seq;
DROP TABLE IF EXISTS public.departments;
DROP SEQUENCE IF EXISTS public.courses_id_seq;
DROP TABLE IF EXISTS public.courses;
DROP TABLE IF EXISTS public.course_faculty;
DROP TABLE IF EXISTS public.coderank_migrations;
DROP SEQUENCE IF EXISTS public.activity_logs_id_seq;
DROP TABLE IF EXISTS public.activity_logs;
DROP FUNCTION IF EXISTS public.coderank_save_attempt(p_job_id text, p_student integer, p_practical integer, p_code text, p_language text, p_status text, p_raw numeric, p_normalized numeric, p_runtime numeric, p_late boolean, p_submitted_at timestamp with time zone, p_cases jsonb, p_result jsonb);
DROP FUNCTION IF EXISTS public.coderank_reset_submission(p_actor integer, p_submission integer);
DROP FUNCTION IF EXISTS public.coderank_replace_mapping(p_admin integer, p_course integer, p_faculty integer[], p_co integer);
DROP FUNCTION IF EXISTS public.coderank_mutate_practical(p_actor integer, p_id integer, p_action text, p_body jsonb);
DROP FUNCTION IF EXISTS public.coderank_manage_user(p_admin integer, p_id integer, p_action text, p_body jsonb);
DROP FUNCTION IF EXISTS public.coderank_manage_catalog(p_admin integer, p_entity text, p_id integer, p_action text, p_body jsonb);
DROP FUNCTION IF EXISTS public.coderank_delete_submission(p_student integer, p_practical integer);
--
-- Name: coderank_delete_submission(integer, integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.coderank_delete_submission(p_student integer, p_practical integer) RETURNS void
    LANGUAGE plpgsql
    AS $$
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
$$;


ALTER FUNCTION public.coderank_delete_submission(p_student integer, p_practical integer) OWNER TO postgres;

--
-- Name: coderank_manage_catalog(integer, text, integer, text, jsonb); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.coderank_manage_catalog(p_admin integer, p_entity text, p_id integer, p_action text, p_body jsonb) RETURNS jsonb
    LANGUAGE plpgsql
    AS $_$
DECLARE
 result jsonb;
 old_name text;
BEGIN
 PERFORM pg_advisory_xact_lock(20401017,2);
 IF NOT EXISTS(SELECT 1 FROM users WHERE id=p_admin AND role='admin' AND status='active') THEN
  RAISE EXCEPTION 'Active administrator required' USING ERRCODE='42501';
 END IF;
 IF p_entity NOT IN ('course','department') OR p_entity IS NULL OR p_action NOT IN ('create','update','delete') OR p_action IS NULL THEN
  RAISE EXCEPTION 'Invalid catalog operation' USING ERRCODE='22023';
 END IF;
 IF p_action<>'delete' THEN
  IF jsonb_typeof(p_body)<>'object' OR p_body IS NULL OR jsonb_typeof(p_body->'name')<>'string' OR p_body->>'name' IS NULL OR length(trim(p_body->>'name')) NOT BETWEEN 1 AND 300 THEN
   RAISE EXCEPTION 'Invalid name' USING ERRCODE='22023';
  END IF;
  IF p_entity='course' THEN
   IF jsonb_typeof(p_body->'course_code')<>'string' OR p_body->>'course_code' IS NULL OR length(trim(p_body->>'course_code')) NOT BETWEEN 1 AND 100
    OR coalesce(p_body->>'semester','') !~ '^[1-9][0-9]{0,2}$' THEN
    RAISE EXCEPTION 'Invalid course code or semester' USING ERRCODE='22023';
   END IF;
  ELSE
   IF jsonb_typeof(p_body->'institute_name')<>'string' OR p_body->>'institute_name' IS NULL OR length(trim(p_body->>'institute_name')) NOT BETWEEN 1 AND 300 THEN
    RAISE EXCEPTION 'Invalid institute name' USING ERRCODE='22023';
   END IF;
  END IF;
 END IF;
 IF p_entity='course' THEN
  IF p_action='create' THEN
   INSERT INTO courses(course_code,name,semester) VALUES(trim(p_body->>'course_code'),trim(p_body->>'name'),(p_body->>'semester')::integer) RETURNING to_jsonb(courses.*) INTO result;
  ELSE
   SELECT name INTO old_name FROM courses WHERE id=p_id FOR UPDATE;
   IF NOT FOUND THEN RAISE EXCEPTION 'Course not found' USING ERRCODE='P0002'; END IF;
   IF p_action='delete' THEN
    -- Cascading a course deletion would erase practicals and grading history.
    IF EXISTS(SELECT 1 FROM practicals WHERE course_id=p_id) THEN
     RAISE EXCEPTION 'Course contains practicals; preserve its grading history' USING ERRCODE='23503';
    END IF;
    DELETE FROM course_faculty WHERE course_id=p_id;
    DELETE FROM courses WHERE id=p_id RETURNING to_jsonb(courses.*) INTO result;
   ELSE
    UPDATE courses SET course_code=trim(p_body->>'course_code'),name=trim(p_body->>'name'),semester=(p_body->>'semester')::integer WHERE id=p_id RETURNING to_jsonb(courses.*) INTO result;
   END IF;
  END IF;
 ELSE
  IF p_action='create' THEN
   INSERT INTO departments(name,institute_name) VALUES(trim(p_body->>'name'),trim(p_body->>'institute_name')) RETURNING to_jsonb(departments.*) INTO result;
  ELSE
   SELECT name INTO old_name FROM departments WHERE id=p_id FOR UPDATE;
   IF NOT FOUND THEN RAISE EXCEPTION 'Department not found' USING ERRCODE='P0002'; END IF;
   IF p_action='delete' THEN
    IF EXISTS(SELECT 1 FROM users WHERE extra_info->>'department'=old_name) THEN
     RAISE EXCEPTION 'Department is assigned to users' USING ERRCODE='23503';
    END IF;
    DELETE FROM departments WHERE id=p_id RETURNING to_jsonb(departments.*) INTO result;
   ELSE
    UPDATE departments SET name=trim(p_body->>'name'),institute_name=trim(p_body->>'institute_name') WHERE id=p_id RETURNING to_jsonb(departments.*) INTO result;
    UPDATE users SET extra_info=jsonb_set(extra_info,'{department}',to_jsonb(trim(p_body->>'name'))) WHERE extra_info->>'department'=old_name;
   END IF;
  END IF;
 END IF;
 INSERT INTO activity_logs(user_id,action,details) VALUES(p_admin,upper(p_action)||'_'||upper(p_entity),'Catalog '||p_entity||' '||(result->>'id'));
 RETURN result;
END
$_$;


ALTER FUNCTION public.coderank_manage_catalog(p_admin integer, p_entity text, p_id integer, p_action text, p_body jsonb) OWNER TO postgres;

--
-- Name: coderank_manage_user(integer, integer, text, jsonb); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.coderank_manage_user(p_admin integer, p_id integer, p_action text, p_body jsonb) RETURNS jsonb
    LANGUAGE plpgsql
    AS $$
DECLARE
 u users%ROWTYPE;
 c integer;
 replacement integer;
 result jsonb;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM users WHERE id=p_admin AND role='admin' AND status='active') THEN
  RAISE EXCEPTION 'Active administrator required' USING ERRCODE='42501';
 END IF;
 -- All remapping/deactivation operations use this lock before user/course locks.
 PERFORM pg_advisory_xact_lock(20401017,2);
 IF p_action='create' THEN
  IF p_body->>'role' NOT IN ('faculty','student') OR p_body->>'role' IS NULL THEN RAISE EXCEPTION 'Invalid user role' USING ERRCODE='22023'; END IF;
  INSERT INTO users(first_name,last_name,name,email,password,role,extra_info,status)
  VALUES(p_body->>'first_name',p_body->>'last_name',p_body->>'name',p_body->>'email',p_body->>'password_hash',p_body->>'role',coalesce(p_body->'extra_info','{}'),'active') RETURNING * INTO u;
 ELSIF p_action IN ('update','deactivate') THEN
  SELECT * INTO u FROM users WHERE id=p_id AND role<>'admin' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'User not found or protected' USING ERRCODE='P0002'; END IF;
  IF p_body->>'role' IS NOT NULL AND p_body->>'role'<>u.role THEN RAISE EXCEPTION 'Changing user role is not supported' USING ERRCODE='22023'; END IF;
  UPDATE users SET first_name=coalesce(p_body->>'first_name',first_name),last_name=coalesce(p_body->>'last_name',last_name),
   name=coalesce(p_body->>'name',name),email=coalesce(p_body->>'email',email),
   extra_info=CASE WHEN p_body ? 'extra_info' THEN coalesce(extra_info,'{}') || (p_body->'extra_info') ELSE extra_info END,
   status=CASE WHEN p_action='deactivate' THEN 'inactive' ELSE coalesce(p_body->>'status',status) END,
   password=coalesce(p_body->>'password_hash',password),
   session_token=CASE WHEN p_action='deactivate' OR p_body->>'status'='inactive' OR p_body ? 'password_hash' THEN md5(random()::text||clock_timestamp()::text) ELSE session_token END
  WHERE id=p_id RETURNING * INTO u;
  IF u.role='faculty' AND u.status='inactive' THEN
   FOR c IN SELECT id FROM courses WHERE assigned_faculty=u.id OR id IN(SELECT course_id FROM course_faculty WHERE faculty_id=u.id) ORDER BY id FOR UPDATE LOOP
    DELETE FROM course_faculty WHERE course_id=c AND faculty_id=u.id;
    SELECT cf.faculty_id INTO replacement FROM course_faculty cf JOIN users other ON other.id=cf.faculty_id
     WHERE cf.course_id=c AND other.status='active' ORDER BY cf.is_co_coordinator DESC,cf.faculty_id LIMIT 1;
    UPDATE course_faculty SET is_co_coordinator=(faculty_id=replacement) WHERE course_id=c;
    UPDATE courses SET assigned_faculty=replacement WHERE id=c;
   END LOOP;
  END IF;
 ELSE RAISE EXCEPTION 'Invalid user action' USING ERRCODE='22023'; END IF;
 IF u.status NOT IN ('active','inactive') THEN RAISE EXCEPTION 'Invalid user status' USING ERRCODE='22023'; END IF;
 result:=to_jsonb(u)-'password'-'session_token';
 INSERT INTO activity_logs(user_id,action,details) VALUES(p_admin,upper(p_action)||'_USER','User '||u.id);
 RETURN result;
END
$$;


ALTER FUNCTION public.coderank_manage_user(p_admin integer, p_id integer, p_action text, p_body jsonb) OWNER TO postgres;

--
-- Name: coderank_mutate_practical(integer, integer, text, jsonb); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.coderank_mutate_practical(p_actor integer, p_id integer, p_action text, p_body jsonb) RETURNS jsonb
    LANGUAGE plpgsql
    AS $$
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
$$;


ALTER FUNCTION public.coderank_mutate_practical(p_actor integer, p_id integer, p_action text, p_body jsonb) OWNER TO postgres;

--
-- Name: coderank_replace_mapping(integer, integer, integer[], integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.coderank_replace_mapping(p_admin integer, p_course integer, p_faculty integer[], p_co integer) RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM users WHERE id=p_admin AND role='admin' AND status='active') THEN
  RAISE EXCEPTION 'Administrator required' USING ERRCODE='42501';
 END IF;
 PERFORM pg_advisory_xact_lock(20401017,2);
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
$$;


ALTER FUNCTION public.coderank_replace_mapping(p_admin integer, p_course integer, p_faculty integer[], p_co integer) OWNER TO postgres;

--
-- Name: coderank_reset_submission(integer, integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.coderank_reset_submission(p_actor integer, p_submission integer) RETURNS jsonb
    LANGUAGE plpgsql
    AS $$
DECLARE s practical_submissions%ROWTYPE; course integer;
BEGIN
 -- Same ordering as remapping, user deactivation and catalog deletion.
 PERFORM pg_advisory_xact_lock(20401017,2);
 IF NOT EXISTS(SELECT 1 FROM users WHERE id=p_actor AND role='faculty' AND status='active') THEN
  RAISE EXCEPTION 'Active faculty required' USING ERRCODE='42501';
 END IF;
 SELECT * INTO s FROM practical_submissions WHERE id=p_submission;
 IF NOT FOUND THEN RAISE EXCEPTION 'Submission not found' USING ERRCODE='P0002'; END IF;
 SELECT p.course_id INTO course FROM practicals p WHERE p.id=s.practical_id;
 PERFORM 1 FROM courses WHERE id=course FOR SHARE;
 IF NOT EXISTS(SELECT 1 FROM course_faculty WHERE course_id=course AND faculty_id=p_actor) THEN
  RAISE EXCEPTION 'Current course assignment required' USING ERRCODE='42501';
 END IF;
 PERFORM coderank_delete_submission(s.student_id,s.practical_id);
 INSERT INTO activity_logs(user_id,action,details) VALUES(p_actor,'RESET_SUBMISSION','Submission '||p_submission);
 RETURN jsonb_build_object('success',true,'message','Submission deleted successfully');
END
$$;


ALTER FUNCTION public.coderank_reset_submission(p_actor integer, p_submission integer) OWNER TO postgres;

--
-- Name: coderank_save_attempt(text, integer, integer, text, text, text, numeric, numeric, numeric, boolean, timestamp with time zone, jsonb, jsonb); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.coderank_save_attempt(p_job_id text, p_student integer, p_practical integer, p_code text, p_language text, p_status text, p_raw numeric, p_normalized numeric, p_runtime numeric, p_late boolean, p_submitted_at timestamp with time zone, p_cases jsonb, p_result jsonb) RETURNS jsonb
    LANGUAGE plpgsql
    AS $$
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
$$;


ALTER FUNCTION public.coderank_save_attempt(p_job_id text, p_student integer, p_practical integer, p_code text, p_language text, p_status text, p_raw numeric, p_normalized numeric, p_runtime numeric, p_late boolean, p_submitted_at timestamp with time zone, p_cases jsonb, p_result jsonb) OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: activity_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.activity_logs (
    id bigint NOT NULL,
    user_id integer,
    action text NOT NULL,
    details text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.activity_logs OWNER TO postgres;

--
-- Name: activity_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.activity_logs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.activity_logs_id_seq OWNER TO postgres;

--
-- Name: activity_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.activity_logs_id_seq OWNED BY public.activity_logs.id;


--
-- Name: coderank_migrations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.coderank_migrations (
    name text NOT NULL,
    checksum text NOT NULL,
    applied_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.coderank_migrations OWNER TO postgres;

--
-- Name: course_faculty; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.course_faculty (
    course_id integer NOT NULL,
    faculty_id integer NOT NULL,
    is_co_coordinator boolean DEFAULT false NOT NULL
);


ALTER TABLE public.course_faculty OWNER TO postgres;

--
-- Name: courses; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.courses (
    id integer NOT NULL,
    course_code text NOT NULL,
    name text NOT NULL,
    semester integer NOT NULL,
    assigned_faculty integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT courses_semester_check CHECK ((semester > 0))
);


ALTER TABLE public.courses OWNER TO postgres;

--
-- Name: courses_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.courses_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.courses_id_seq OWNER TO postgres;

--
-- Name: courses_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.courses_id_seq OWNED BY public.courses.id;


--
-- Name: departments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.departments (
    id integer NOT NULL,
    name text NOT NULL,
    institute_name text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.departments OWNER TO postgres;

--
-- Name: departments_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.departments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.departments_id_seq OWNER TO postgres;

--
-- Name: departments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.departments_id_seq OWNED BY public.departments.id;


--
-- Name: practical_submission_cases; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.practical_submission_cases (
    id integer NOT NULL,
    submission_id integer NOT NULL,
    test_case_id integer NOT NULL,
    passed boolean NOT NULL,
    marks_awarded numeric DEFAULT 0 NOT NULL,
    actual_output text,
    error_message text,
    execution_time_ms numeric DEFAULT 0 NOT NULL
);


ALTER TABLE public.practical_submission_cases OWNER TO postgres;

--
-- Name: practical_submission_cases_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.practical_submission_cases_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.practical_submission_cases_id_seq OWNER TO postgres;

--
-- Name: practical_submission_cases_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.practical_submission_cases_id_seq OWNED BY public.practical_submission_cases.id;


--
-- Name: practical_submissions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.practical_submissions (
    id integer NOT NULL,
    student_id integer NOT NULL,
    practical_id integer NOT NULL,
    code bytea NOT NULL,
    language text NOT NULL,
    status text NOT NULL,
    raw_marks numeric DEFAULT 0 NOT NULL,
    normalized_marks numeric DEFAULT 0 NOT NULL,
    execution_time_ms numeric DEFAULT 0 NOT NULL,
    is_late boolean DEFAULT false NOT NULL,
    submitted_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.practical_submissions OWNER TO postgres;

--
-- Name: practical_submissions_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.practical_submissions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.practical_submissions_id_seq OWNER TO postgres;

--
-- Name: practical_submissions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.practical_submissions_id_seq OWNED BY public.practical_submissions.id;


--
-- Name: practical_test_cases; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.practical_test_cases (
    id integer NOT NULL,
    practical_id integer NOT NULL,
    input text DEFAULT ''::text NOT NULL,
    expected text DEFAULT ''::text NOT NULL,
    marks numeric DEFAULT 0 NOT NULL,
    is_hidden boolean DEFAULT false NOT NULL,
    time_limit numeric,
    memory_limit numeric,
    order_index integer DEFAULT 0 NOT NULL,
    label text,
    CONSTRAINT practical_test_cases_marks_check CHECK ((marks >= (0)::numeric))
);


ALTER TABLE public.practical_test_cases OWNER TO postgres;

--
-- Name: practical_test_cases_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.practical_test_cases_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.practical_test_cases_id_seq OWNER TO postgres;

--
-- Name: practical_test_cases_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.practical_test_cases_id_seq OWNED BY public.practical_test_cases.id;


--
-- Name: practicals; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.practicals (
    id integer NOT NULL,
    faculty_id integer NOT NULL,
    course_id integer NOT NULL,
    batch_id text,
    title text NOT NULL,
    description text,
    instructions text,
    total_marks numeric DEFAULT 0 NOT NULL,
    difficulty text DEFAULT 'Easy'::text,
    is_challenge boolean DEFAULT false NOT NULL,
    starter_code jsonb DEFAULT '{}'::jsonb,
    input_format text,
    output_format text,
    constraints text,
    sample_input text,
    sample_output text,
    topics text,
    status text DEFAULT 'active'::text NOT NULL,
    start_time timestamp with time zone,
    end_time timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT practicals_total_marks_check CHECK ((total_marks >= (0)::numeric))
);


ALTER TABLE public.practicals OWNER TO postgres;

--
-- Name: practicals_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.practicals_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.practicals_id_seq OWNER TO postgres;

--
-- Name: practicals_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.practicals_id_seq OWNED BY public.practicals.id;


--
-- Name: student_workspaces; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.student_workspaces (
    student_id integer NOT NULL,
    practical_id integer NOT NULL,
    language text NOT NULL,
    latest_code bytea NOT NULL,
    saved_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.student_workspaces OWNER TO postgres;

--
-- Name: submission_attempts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.submission_attempts (
    job_id text NOT NULL,
    student_id integer NOT NULL,
    practical_id integer NOT NULL,
    code bytea NOT NULL,
    language text NOT NULL,
    normalized_marks numeric NOT NULL,
    raw_marks numeric NOT NULL,
    case_results jsonb NOT NULL,
    result jsonb NOT NULL,
    submitted_at timestamp with time zone NOT NULL,
    completed_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT submission_attempts_normalized_marks_check CHECK (((normalized_marks >= (0)::numeric) AND (normalized_marks <= (10)::numeric))),
    CONSTRAINT submission_attempts_raw_marks_check CHECK ((raw_marks >= (0)::numeric))
);


ALTER TABLE public.submission_attempts OWNER TO postgres;

--
-- Name: submission_resets; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.submission_resets (
    student_id integer NOT NULL,
    practical_id integer NOT NULL,
    reset_at timestamp with time zone NOT NULL
);


ALTER TABLE public.submission_resets OWNER TO postgres;

--
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    id integer NOT NULL,
    first_name text,
    last_name text,
    name text NOT NULL,
    email text NOT NULL,
    password text NOT NULL,
    role text NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    extra_info jsonb DEFAULT '{}'::jsonb NOT NULL,
    session_token text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT users_role_check CHECK ((role = ANY (ARRAY['admin'::text, 'faculty'::text, 'student'::text])))
);


ALTER TABLE public.users OWNER TO postgres;

--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.users_id_seq OWNER TO postgres;

--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: activity_logs id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.activity_logs ALTER COLUMN id SET DEFAULT nextval('public.activity_logs_id_seq'::regclass);


--
-- Name: courses id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.courses ALTER COLUMN id SET DEFAULT nextval('public.courses_id_seq'::regclass);


--
-- Name: departments id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.departments ALTER COLUMN id SET DEFAULT nextval('public.departments_id_seq'::regclass);


--
-- Name: practical_submission_cases id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.practical_submission_cases ALTER COLUMN id SET DEFAULT nextval('public.practical_submission_cases_id_seq'::regclass);


--
-- Name: practical_submissions id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.practical_submissions ALTER COLUMN id SET DEFAULT nextval('public.practical_submissions_id_seq'::regclass);


--
-- Name: practical_test_cases id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.practical_test_cases ALTER COLUMN id SET DEFAULT nextval('public.practical_test_cases_id_seq'::regclass);


--
-- Name: practicals id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.practicals ALTER COLUMN id SET DEFAULT nextval('public.practicals_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Data for Name: activity_logs; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.activity_logs VALUES (710, 1, 'LOGIN', 'User logged in', '2026-10-08 08:30:16.329+00');
INSERT INTO public.activity_logs VALUES (711, 1330, 'LOGIN', 'User logged in', '2026-10-08 08:34:24.756+00');
INSERT INTO public.activity_logs VALUES (712, 1, 'LOGIN', 'User logged in', '2026-10-11 12:03:19.418+00');
INSERT INTO public.activity_logs VALUES (713, 1, 'LOGIN', 'User logged in', '2026-10-11 12:03:22.573+00');
INSERT INTO public.activity_logs VALUES (715, 1, 'LOGIN', 'User logged in', '2026-10-11 15:03:13.407+00');
INSERT INTO public.activity_logs VALUES (716, 1337, 'LOGIN', 'User logged in', '2026-10-11 15:05:17.276+00');
INSERT INTO public.activity_logs VALUES (717, 1295, 'LOGIN', 'User logged in', '2026-10-11 15:08:07.33+00');
INSERT INTO public.activity_logs VALUES (722, 1295, 'CREATE_PRACTICAL', 'Created practical "setwrtywwerw" for course 11, batch All', '2026-10-12 08:09:02.354+00');
INSERT INTO public.activity_logs VALUES (723, 1329, 'LOGIN', 'User logged in', '2026-10-12 08:09:41.027+00');
INSERT INTO public.activity_logs VALUES (724, 1, 'LOGIN', 'User logged in', '2026-10-12 10:10:25.595+00');
INSERT INTO public.activity_logs VALUES (725, 1, 'LOGIN', 'User logged in', '2026-10-12 10:13:10.575+00');
INSERT INTO public.activity_logs VALUES (726, 1, 'LOGIN', 'User logged in', '2026-10-12 10:47:32.041+00');
INSERT INTO public.activity_logs VALUES (727, 1295, 'LOGIN', 'User logged in', '2026-10-12 11:21:41.085+00');
INSERT INTO public.activity_logs VALUES (729, 1, 'LOGIN', 'User logged in', '2026-10-13 04:11:04.848+00');
INSERT INTO public.activity_logs VALUES (730, 1330, 'LOGIN', 'User logged in', '2026-10-13 04:26:46.376+00');
INSERT INTO public.activity_logs VALUES (731, 1, 'LOGIN', 'User logged in', '2026-10-13 11:30:51.554+00');
INSERT INTO public.activity_logs VALUES (732, 1295, 'LOGIN', 'User logged in', '2026-10-13 13:07:24.74+00');
INSERT INTO public.activity_logs VALUES (733, 1, 'LOGIN', 'User logged in', '2026-10-13 13:08:49.822+00');
INSERT INTO public.activity_logs VALUES (734, 1, 'UPDATE_MAPPING', 'Updated mapping for course 11, co-coordinator 1267', '2026-10-13 13:09:32.003+00');
INSERT INTO public.activity_logs VALUES (735, 1, 'LOGIN', 'User logged in', '2026-10-13 13:37:06.232+00');
INSERT INTO public.activity_logs VALUES (736, 1329, 'LOGIN', 'User logged in', '2026-10-13 13:37:25.737+00');
INSERT INTO public.activity_logs VALUES (737, 1330, 'LOGIN', 'User logged in', '2026-10-13 13:54:13.153+00');
INSERT INTO public.activity_logs VALUES (738, 1295, 'LOGIN', 'User logged in', '2026-10-13 14:19:49.738+00');
INSERT INTO public.activity_logs VALUES (739, 1, 'LOGIN', 'User logged in', '2026-10-17 12:47:58.996+00');
INSERT INTO public.activity_logs VALUES (740, 1291, 'LOGIN', 'User logged in', '2026-10-17 13:04:53.395+00');
INSERT INTO public.activity_logs VALUES (741, 1329, 'LOGIN', 'User logged in', '2026-10-17 13:05:25.245+00');
INSERT INTO public.activity_logs VALUES (742, 1295, 'LOGIN', 'User logged in', '2026-10-17 13:12:49.739+00');
INSERT INTO public.activity_logs VALUES (743, 1, 'LOGIN', 'User logged in', '2026-10-17 13:13:29.133+00');
INSERT INTO public.activity_logs VALUES (744, 1, 'UPDATE_MAPPING', 'Updated mapping for course 11, co-coordinator 1295', '2026-10-17 13:13:43.573+00');
INSERT INTO public.activity_logs VALUES (745, 1295, 'LOGIN', 'User logged in', '2026-10-17 13:17:05.92+00');
INSERT INTO public.activity_logs VALUES (746, 1379, 'LOGIN', 'User logged in', '2026-10-20 05:05:11.594+00');
INSERT INTO public.activity_logs VALUES (747, 1379, 'LOGIN', 'User logged in', '2026-10-20 05:07:06.749+00');
INSERT INTO public.activity_logs VALUES (748, 1, 'LOGIN', 'User logged in', '2026-10-20 05:11:50.673+00');
INSERT INTO public.activity_logs VALUES (755, 1379, 'LOGIN', 'User logged in', '2026-10-20 06:03:42.198+00');
INSERT INTO public.activity_logs VALUES (756, 1379, 'UPDATE_PROFILE', 'User updated their own account', '2026-10-20 06:03:43.886+00');
INSERT INTO public.activity_logs VALUES (757, 1379, 'UPDATE_PROFILE', 'User updated their own account', '2026-10-20 06:03:44.915+00');
INSERT INTO public.activity_logs VALUES (758, 1295, 'CHANGE_PASSWORD', 'User updated their own account', '2026-10-20 06:16:48.984+00');
INSERT INTO public.activity_logs VALUES (759, 1, 'LOGIN', 'User logged in', '2026-10-20 06:20:21.452+00');
INSERT INTO public.activity_logs VALUES (760, 1, 'UPDATE_MAPPING', 'Updated course 13', '2026-10-20 06:20:33.124+00');
INSERT INTO public.activity_logs VALUES (761, 1, 'UPDATE_MAPPING', 'Updated course 13', '2026-10-20 09:45:52.504+00');
INSERT INTO public.activity_logs VALUES (762, 1295, 'LOGIN', 'User logged in', '2026-10-20 09:46:13.999+00');
INSERT INTO public.activity_logs VALUES (763, 1295, 'LOGIN', 'User logged in', '2026-10-20 09:46:22.268+00');
INSERT INTO public.activity_logs VALUES (764, 1295, 'LOGIN', 'User logged in', '2026-10-20 09:46:25.387+00');
INSERT INTO public.activity_logs VALUES (765, 1295, 'LOGIN', 'User logged in', '2026-10-20 09:46:54.329+00');
INSERT INTO public.activity_logs VALUES (766, 1, 'UPDATE_MAPPING', 'Updated course 5', '2026-10-20 09:47:03.064+00');
INSERT INTO public.activity_logs VALUES (767, 1, 'UPDATE_MAPPING', 'Updated course 13', '2026-10-20 09:47:22.841+00');
INSERT INTO public.activity_logs VALUES (768, 1295, 'EXTEND_PRACTICAL', 'Practical 17', '2026-10-20 09:47:53.091+00');
INSERT INTO public.activity_logs VALUES (769, 1295, 'CREATE_PRACTICAL', 'Practical 20', '2026-10-20 09:50:14.007+00');
INSERT INTO public.activity_logs VALUES (770, 1353, 'LOGIN', 'User logged in', '2026-10-20 09:50:54.649+00');
INSERT INTO public.activity_logs VALUES (771, 1, 'LOGIN', 'User logged in', '2026-10-20 15:48:17.646+00');
INSERT INTO public.activity_logs VALUES (772, 1, 'LOGIN', 'User logged in', '2026-10-21 11:05:48.88+00');
INSERT INTO public.activity_logs VALUES (773, 1, 'UPDATE_MAPPING', 'Updated course 13', '2026-10-21 11:06:27.123+00');
INSERT INTO public.activity_logs VALUES (774, 1295, 'LOGIN', 'User logged in', '2026-10-21 11:06:59.581+00');
INSERT INTO public.activity_logs VALUES (775, 1295, 'LOGIN', 'User logged in', '2026-10-21 11:07:22.242+00');
INSERT INTO public.activity_logs VALUES (776, 1338, 'LOGIN', 'User logged in', '2026-10-21 11:08:20.124+00');
INSERT INTO public.activity_logs VALUES (777, 1295, 'LOGIN', 'User logged in', '2026-10-21 14:55:36.068+00');
INSERT INTO public.activity_logs VALUES (778, 1295, 'LOGIN', 'User logged in', '2026-10-21 14:55:56.91+00');
INSERT INTO public.activity_logs VALUES (779, 1295, 'LOGIN', 'User logged in', '2026-10-21 15:15:53.498+00');
INSERT INTO public.activity_logs VALUES (780, 1295, 'LOGIN', 'User logged in', '2026-10-21 15:19:13.053+00');
INSERT INTO public.activity_logs VALUES (781, 1306, 'LOGIN', 'User logged in', '2026-10-21 15:19:13.884+00');
INSERT INTO public.activity_logs VALUES (782, 1306, 'LOGIN', 'User logged in', '2026-10-21 15:19:47.923+00');
INSERT INTO public.activity_logs VALUES (783, 1, 'LOGIN', 'User logged in', '2026-10-21 15:57:24.301+00');
INSERT INTO public.activity_logs VALUES (784, 1295, 'LOGIN', 'User logged in', '2026-10-21 15:58:06.34+00');
INSERT INTO public.activity_logs VALUES (785, 1329, 'LOGIN', 'User logged in', '2026-10-21 15:58:34.414+00');
INSERT INTO public.activity_logs VALUES (786, 1295, 'LOGIN', 'User logged in', '2026-10-21 16:04:24.081+00');
INSERT INTO public.activity_logs VALUES (787, 1295, 'LOGIN', 'User logged in', '2026-10-21 16:15:22.078+00');
INSERT INTO public.activity_logs VALUES (788, 1329, 'LOGIN', 'User logged in', '2026-10-21 16:41:55.526+00');
INSERT INTO public.activity_logs VALUES (789, 1295, 'LOGIN', 'User logged in', '2026-10-21 16:43:57.595+00');
INSERT INTO public.activity_logs VALUES (790, 1295, 'LOGIN', 'User logged in', '2026-10-22 03:03:00.185+00');
INSERT INTO public.activity_logs VALUES (791, 1295, 'LOGIN', 'User logged in', '2026-10-22 03:03:54.693+00');
INSERT INTO public.activity_logs VALUES (792, 1379, 'LOGIN', 'User logged in', '2026-10-22 03:05:07.633+00');
INSERT INTO public.activity_logs VALUES (793, 1379, 'UPDATE_USER', 'User 1329', '2026-10-22 03:05:56.985+00');
INSERT INTO public.activity_logs VALUES (794, 1329, 'LOGIN', 'User logged in', '2026-10-22 03:06:41.229+00');
INSERT INTO public.activity_logs VALUES (795, 1, 'LOGIN', 'User logged in', '2026-10-22 05:34:31.734+00');
INSERT INTO public.activity_logs VALUES (796, 1295, 'LOGIN', 'User logged in', '2026-10-22 05:34:59.234+00');
INSERT INTO public.activity_logs VALUES (798, 1, 'LOGIN', 'User logged in', '2026-10-22 19:03:26.152+00');
INSERT INTO public.activity_logs VALUES (799, 1329, 'LOGIN', 'User logged in', '2026-10-22 19:08:37.496+00');
INSERT INTO public.activity_logs VALUES (806, 1330, 'LOGIN', 'User logged in', '2026-10-23 04:49:39.093+00');
INSERT INTO public.activity_logs VALUES (807, 1, 'UPDATE_MAPPING', 'Updated course 13', '2026-10-23 04:51:46.469+00');
INSERT INTO public.activity_logs VALUES (808, 1, 'UPDATE_MAPPING', 'Updated course 11', '2026-10-23 04:51:49.434+00');
INSERT INTO public.activity_logs VALUES (809, 1295, 'LOGIN', 'User logged in', '2026-10-23 04:52:17.897+00');
INSERT INTO public.activity_logs VALUES (810, 1295, 'EXTEND_PRACTICAL', 'Practical 1', '2026-10-23 04:52:39.183+00');
INSERT INTO public.activity_logs VALUES (811, 1295, 'LOGIN', 'User logged in', '2026-10-23 06:27:33.975+00');
INSERT INTO public.activity_logs VALUES (812, 1295, 'LOGIN', 'User logged in', '2026-10-24 17:08:30.114+00');
INSERT INTO public.activity_logs VALUES (814, 1329, 'LOGIN', 'User logged in', '2026-10-24 19:05:43.818+00');
INSERT INTO public.activity_logs VALUES (815, 1333, 'LOGIN', 'User logged in', '2026-10-24 20:00:57.151+00');
INSERT INTO public.activity_logs VALUES (714, 1, 'LOGIN', 'User logged in', '2026-10-11 12:05:04.652+00');
INSERT INTO public.activity_logs VALUES (718, 1, 'LOGIN', 'User logged in', '2026-10-11 15:08:26.88+00');
INSERT INTO public.activity_logs VALUES (719, 1, 'UPDATE_MAPPING', 'Updated mapping for course 11, co-coordinator 1295', '2026-10-11 15:08:36.734+00');
INSERT INTO public.activity_logs VALUES (720, 1, 'UPDATE_MAPPING', 'Updated mapping for course 11, co-coordinator 1295', '2026-10-11 15:10:42.856+00');
INSERT INTO public.activity_logs VALUES (721, 1295, 'LOGIN', 'User logged in', '2026-10-11 15:11:10.517+00');
INSERT INTO public.activity_logs VALUES (728, 1295, 'LOGIN', 'User logged in', '2026-10-12 11:28:23.374+00');
INSERT INTO public.activity_logs VALUES (749, 1329, 'LOGIN', 'User logged in', '2026-10-20 05:16:59.176+00');
INSERT INTO public.activity_logs VALUES (797, 1339, 'LOGIN', 'User logged in', '2026-10-22 05:35:25.648+00');
INSERT INTO public.activity_logs VALUES (800, 1295, 'LOGIN', 'User logged in', '2026-10-22 19:20:14.319+00');
INSERT INTO public.activity_logs VALUES (801, 1, 'LOGIN', 'User logged in', '2026-10-22 19:22:48.09+00');
INSERT INTO public.activity_logs VALUES (802, 1, 'UPDATE_MAPPING', 'Updated course 5', '2026-10-22 19:23:05.304+00');
INSERT INTO public.activity_logs VALUES (803, 1, 'UPDATE_MAPPING', 'Updated course 11', '2026-10-22 19:23:06.669+00');
INSERT INTO public.activity_logs VALUES (804, 1, 'UPDATE_MAPPING', 'Updated course 13', '2026-10-22 19:23:09.96+00');
INSERT INTO public.activity_logs VALUES (805, 1, 'UPDATE_MAPPING', 'Updated course 11', '2026-10-22 19:23:11.745+00');
INSERT INTO public.activity_logs VALUES (813, 1295, 'EXTEND_PRACTICAL', 'Practical 17', '2026-10-24 17:09:36.879+00');
INSERT INTO public.activity_logs VALUES (750, 1295, 'LOGIN', 'User logged in', '2026-10-20 05:33:17.864+00');
INSERT INTO public.activity_logs VALUES (706, 1, 'LOGIN', 'User logged in', '2026-10-08 08:26:20.702+00');
INSERT INTO public.activity_logs VALUES (707, 1, 'UPDATE_MAPPING', 'Updated mapping for course 5, co-coordinator 659', '2026-10-08 08:26:41.479+00');
INSERT INTO public.activity_logs VALUES (708, 1, 'UPDATE_MAPPING', 'Updated mapping for course 11, co-coordinator 1267', '2026-10-08 08:26:42.82+00');
INSERT INTO public.activity_logs VALUES (709, 1, 'UPDATE_MAPPING', 'Updated mapping for course 13, co-coordinator 1287', '2026-10-08 08:26:44.303+00');
INSERT INTO public.activity_logs VALUES (751, 1295, 'RESET_SUBMISSION', 'Submission 56', '2026-10-20 05:42:14.213+00');
INSERT INTO public.activity_logs VALUES (752, 1295, 'RESET_SUBMISSION', 'Submission 47', '2026-10-20 05:42:46.217+00');
INSERT INTO public.activity_logs VALUES (753, 1295, 'RESET_SUBMISSION', 'Submission 45', '2026-10-20 05:43:06.331+00');
INSERT INTO public.activity_logs VALUES (754, 1295, 'RESET_SUBMISSION', 'Submission 46', '2026-10-20 05:44:40.77+00');
INSERT INTO public.activity_logs VALUES (816, 1379, 'LOGIN', 'User logged in', '2026-10-25 08:03:54.110701+00');
INSERT INTO public.activity_logs VALUES (817, 1379, 'LOGIN', 'User logged in', '2026-10-25 08:04:00.779912+00');
INSERT INTO public.activity_logs VALUES (818, 1379, 'LOGIN', 'User logged in', '2026-10-25 08:04:07.840646+00');
INSERT INTO public.activity_logs VALUES (819, 1379, 'LOGIN', 'User logged in', '2026-10-25 08:04:20.913735+00');
INSERT INTO public.activity_logs VALUES (820, 1379, 'LOGIN', 'User logged in', '2026-10-25 08:06:14.562081+00');
INSERT INTO public.activity_logs VALUES (821, 1379, 'LOGIN', 'User logged in', '2026-10-25 08:07:55.664972+00');
INSERT INTO public.activity_logs VALUES (822, 1379, 'LOGIN', 'User logged in', '2026-10-25 08:09:15.196155+00');
INSERT INTO public.activity_logs VALUES (823, 1, 'LOGIN', 'User logged in', '2026-10-25 10:10:54.695854+00');
INSERT INTO public.activity_logs VALUES (824, 1, 'LOGIN', 'User logged in', '2026-10-25 10:27:34.818142+00');
INSERT INTO public.activity_logs VALUES (825, 1295, 'LOGIN', 'User logged in', '2026-10-25 10:28:49.567952+00');
INSERT INTO public.activity_logs VALUES (826, 1336, 'LOGIN', 'User logged in', '2026-10-25 12:14:51.64003+00');
INSERT INTO public.activity_logs VALUES (827, 1, 'LOGIN', 'User logged in', '2026-10-25 13:55:07.014252+00');
INSERT INTO public.activity_logs VALUES (828, 1337, 'LOGIN', 'User logged in', '2026-10-25 14:00:34.538775+00');
INSERT INTO public.activity_logs VALUES (829, 1, 'LOGIN', 'User logged in', '2026-10-25 14:10:19.193257+00');
INSERT INTO public.activity_logs VALUES (830, 1, 'DEACTIVATE_USER', 'User 1329', '2026-10-25 14:11:12.448788+00');
INSERT INTO public.activity_logs VALUES (831, 1330, 'LOGIN', 'User logged in', '2026-10-25 14:11:34.53917+00');
INSERT INTO public.activity_logs VALUES (832, 1379, 'LOGIN', 'User logged in', '2026-10-25 15:25:25.739568+00');
INSERT INTO public.activity_logs VALUES (833, 1, 'LOGIN', 'User logged in', '2026-10-28 17:48:53.511731+00');
INSERT INTO public.activity_logs VALUES (834, 1379, 'LOGIN', 'User logged in', '2026-10-31 21:15:28.565595+00');
INSERT INTO public.activity_logs VALUES (835, 1379, 'LOGIN', 'User logged in', '2026-10-31 21:15:48.737397+00');
INSERT INTO public.activity_logs VALUES (836, 1304, 'LOGIN', 'User logged in', '2026-10-31 21:18:39.154333+00');
INSERT INTO public.activity_logs VALUES (837, 258, 'LOGIN', 'User logged in', '2026-10-31 21:18:40.213527+00');
INSERT INTO public.activity_logs VALUES (838, 1304, 'LOGIN', 'User logged in', '2026-11-01 11:57:34.741855+00');
INSERT INTO public.activity_logs VALUES (839, 1379, 'LOGIN', 'User logged in', '2026-11-01 12:08:16.931092+00');
INSERT INTO public.activity_logs VALUES (840, 1304, 'LOGIN', 'User logged in', '2026-11-01 12:08:17.138332+00');
INSERT INTO public.activity_logs VALUES (841, 258, 'LOGIN', 'User logged in', '2026-11-01 12:08:17.336688+00');
INSERT INTO public.activity_logs VALUES (842, 1379, 'LOGIN', 'User logged in', '2026-11-01 12:08:58.183623+00');
INSERT INTO public.activity_logs VALUES (843, 1304, 'LOGIN', 'User logged in', '2026-11-01 12:08:58.385688+00');
INSERT INTO public.activity_logs VALUES (844, 258, 'LOGIN', 'User logged in', '2026-11-01 12:08:58.608577+00');
INSERT INTO public.activity_logs VALUES (845, 1304, 'LOGIN', 'User logged in', '2026-11-01 12:12:48.85703+00');
INSERT INTO public.activity_logs VALUES (846, 258, 'LOGIN', 'User logged in', '2026-11-01 12:12:49.09301+00');
INSERT INTO public.activity_logs VALUES (847, 1304, 'LOGIN', 'User logged in', '2026-11-01 12:35:26.570135+00');
INSERT INTO public.activity_logs VALUES (848, 258, 'LOGIN', 'User logged in', '2026-11-01 12:35:26.757508+00');
INSERT INTO public.activity_logs VALUES (849, 1, 'CREATE_USER', 'User 1380', '2026-11-01 12:40:46.716946+00');
INSERT INTO public.activity_logs VALUES (850, 1380, 'LOGIN', 'User logged in', '2026-11-01 12:41:35.004713+00');
INSERT INTO public.activity_logs VALUES (851, 1, 'LOGIN', 'User logged in', '2026-11-01 12:41:49.736039+00');
INSERT INTO public.activity_logs VALUES (852, 1, 'UPDATE_MAPPING', 'Updated course 13', '2026-11-01 12:42:07.688475+00');
INSERT INTO public.activity_logs VALUES (853, 1380, 'LOGIN', 'User logged in', '2026-11-01 12:42:46.68252+00');
INSERT INTO public.activity_logs VALUES (854, 1, 'UPDATE_MAPPING', 'Updated course 13', '2026-11-01 12:43:02.444089+00');
INSERT INTO public.activity_logs VALUES (855, 1, 'UPDATE_MAPPING', 'Updated course 13', '2026-11-01 12:43:33.520372+00');
INSERT INTO public.activity_logs VALUES (856, 1, 'UPDATE_MAPPING', 'Updated course 11', '2026-11-01 12:43:39.431313+00');
INSERT INTO public.activity_logs VALUES (857, 1, 'UPDATE_MAPPING', 'Updated course 13', '2026-11-01 12:43:40.979013+00');
INSERT INTO public.activity_logs VALUES (858, 1380, 'EXTEND_PRACTICAL', 'Practical 17', '2026-11-01 12:43:54.110811+00');
INSERT INTO public.activity_logs VALUES (859, 1380, 'EXTEND_PRACTICAL', 'Practical 17', '2026-11-01 14:20:06.325782+00');
INSERT INTO public.activity_logs VALUES (860, 1, 'LOGIN', 'User logged in', '2026-11-01 14:23:09.887354+00');


--
-- Data for Name: coderank_migrations; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.coderank_migrations VALUES ('000_baseline.sql', '1f86d97708422cdf734c3d451e0f778e0096070501dac102ffec8353ee62e204', '2026-10-25 07:50:08.130338+00');
INSERT INTO public.coderank_migrations VALUES ('001_add_performance_indexes.sql', '933bb28909503dcdc4757bdfb48ffd71de028bb02c90efb74b67f038e56ca66b', '2026-10-25 07:50:08.335004+00');
INSERT INTO public.coderank_migrations VALUES ('002_submission_attempts.sql', 'a745d76ad672e31d820be3433a1b05bb763f236d48379efddda1928fc6a784ff', '2026-10-25 07:50:08.402691+00');
INSERT INTO public.coderank_migrations VALUES ('003_admin_transactions.sql', 'a5ea50806058fba51305babac9a228ec85b0c4f007e18b18f40bfc2eddbb7359', '2026-10-25 07:50:08.504501+00');
INSERT INTO public.coderank_migrations VALUES ('004_user_management.sql', 'dacec7d60838604067a2fc3610a6dcd7625cfd7bd80c734f215aff8c5cdfcd16', '2026-10-25 07:50:08.519612+00');
INSERT INTO public.coderank_migrations VALUES ('005_course_department_management.sql', 'e5598ee011e3b4131fb19442e97e477281cf290f19d81a0d109f59373122ee2c', '2026-10-25 07:50:08.532132+00');
INSERT INTO public.coderank_migrations VALUES ('006_authorized_submission_reset.sql', '44a25034144095c56b0fab5c858911812e1472de0b0c8810159494e486b28ae5', '2026-10-25 07:50:08.541319+00');
INSERT INTO public.coderank_migrations VALUES ('007_retention_and_report_indexes.sql', '049ae70c7f29492f94489d832afa66649147db2027c7d13a473db317e9b54c31', '2026-10-25 09:40:37.068751+00');


--
-- Data for Name: course_faculty; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.course_faculty VALUES (5, 659, true);
INSERT INTO public.course_faculty VALUES (5, 1295, false);
INSERT INTO public.course_faculty VALUES (5, 258, false);
INSERT INTO public.course_faculty VALUES (11, 1267, false);
INSERT INTO public.course_faculty VALUES (11, 1295, true);
INSERT INTO public.course_faculty VALUES (11, 1380, false);
INSERT INTO public.course_faculty VALUES (13, 1287, false);
INSERT INTO public.course_faculty VALUES (13, 1295, false);
INSERT INTO public.course_faculty VALUES (13, 1380, true);


--
-- Data for Name: courses; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.courses VALUES (5, 'CPP101', 'CPP', 1, 659, '2026-07-14 02:15:01.724+00');
INSERT INTO public.courses VALUES (11, 'JAVA301', 'Java', 3, 1295, '2026-08-23 08:54:48.445+00');
INSERT INTO public.courses VALUES (13, 'DSA501', 'Dsa', 5, 1380, '2026-09-30 05:27:25.586+00');


--
-- Data for Name: departments; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.departments VALUES (1, 'CSE', 'CSPIT', '2026-07-09 07:08:03.746+00');
INSERT INTO public.departments VALUES (5, 'CE', 'CSPIT', '2026-07-09 09:37:37.298+00');
INSERT INTO public.departments VALUES (7, 'IT', 'CSPIT', '2026-07-09 09:38:14.192+00');
INSERT INTO public.departments VALUES (9, 'AIML', 'CSPIT', '2026-07-09 09:38:30.585+00');
INSERT INTO public.departments VALUES (12, 'EC', 'CSPIT', '2026-09-30 02:05:41.796+00');


--
-- Data for Name: practical_submission_cases; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.practical_submission_cases VALUES (97, 48, 46, false, 0, 'ertett', '', 0);
INSERT INTO public.practical_submission_cases VALUES (98, 49, 44, true, 10, '0', '', 0);
INSERT INTO public.practical_submission_cases VALUES (104, 50, 33, true, 2, '6 6 5 4 3 2', '', 0);
INSERT INTO public.practical_submission_cases VALUES (105, 50, 34, true, 2, '5 4 3 2 1', '', 0);
INSERT INTO public.practical_submission_cases VALUES (106, 50, 35, true, 2, '99', '', 0);
INSERT INTO public.practical_submission_cases VALUES (107, 50, 36, true, 2, '40 30 20 10', '', 0);
INSERT INTO public.practical_submission_cases VALUES (108, 50, 37, true, 2, '-8 -7 -6 -5 -4 -3 -2 -1', '', 0);
INSERT INTO public.practical_submission_cases VALUES (109, 52, 44, true, 10, '0', '', 0);
INSERT INTO public.practical_submission_cases VALUES (113, 53, 40, true, 5, '2', '', 0);
INSERT INTO public.practical_submission_cases VALUES (114, 53, 41, true, 5, '-20', '', 0);
INSERT INTO public.practical_submission_cases VALUES (115, 53, 42, true, 5, '0', '', 0);
INSERT INTO public.practical_submission_cases VALUES (117, 58, 22, true, 1, '1', '', 235.69040000019595);
INSERT INTO public.practical_submission_cases VALUES (118, 59, 47, true, 5, '0', '', 222.12679999694228);
INSERT INTO public.practical_submission_cases VALUES (119, 59, 48, true, 5, '4', '', 229.70369999855757);
INSERT INTO public.practical_submission_cases VALUES (120, 59, 49, true, 5, '3', '', 213.09310000017285);
INSERT INTO public.practical_submission_cases VALUES (121, 60, 47, true, 5, '0', '', 263.2060000002384);
INSERT INTO public.practical_submission_cases VALUES (122, 60, 48, true, 5, '4', '', 219.5751000009477);
INSERT INTO public.practical_submission_cases VALUES (123, 60, 49, true, 5, '3', '', 221.4699999988079);
INSERT INTO public.practical_submission_cases VALUES (124, 61, 47, true, 5, '0', '', 208.73029999999562);
INSERT INTO public.practical_submission_cases VALUES (125, 61, 48, true, 5, '4', '', 214.8003999999928);
INSERT INTO public.practical_submission_cases VALUES (126, 61, 49, true, 5, '3', '', 295.2983999999997);
INSERT INTO public.practical_submission_cases VALUES (127, 62, 45, false, 0, 'sdsf', '', 263.05099999997765);
INSERT INTO public.practical_submission_cases VALUES (128, 63, 46, false, 0, 'ertett', '', 234.85209999978542);
INSERT INTO public.practical_submission_cases VALUES (129, 65, 47, true, 5, '0', '', 244.52160000056028);
INSERT INTO public.practical_submission_cases VALUES (130, 65, 48, true, 5, '4', '', 211.57019999995828);
INSERT INTO public.practical_submission_cases VALUES (131, 65, 49, true, 5, '3', '', 236.80629999935627);
INSERT INTO public.practical_submission_cases VALUES (132, 66, 46, false, 0, 'ertett', '', 213.57919999957085);
INSERT INTO public.practical_submission_cases VALUES (133, 67, 47, true, 5, '0', '', 235.70639999955893);
INSERT INTO public.practical_submission_cases VALUES (134, 67, 48, true, 5, '4', '', 231.62319999933243);
INSERT INTO public.practical_submission_cases VALUES (135, 67, 49, true, 5, '3', '', 220.16160000115633);
INSERT INTO public.practical_submission_cases VALUES (136, 70, 47, true, 5, '0', '', 223.82279999996535);
INSERT INTO public.practical_submission_cases VALUES (137, 70, 48, true, 5, '4', '', 210.36679999995977);
INSERT INTO public.practical_submission_cases VALUES (138, 70, 49, true, 5, '3', '', 221.3571000000229);
INSERT INTO public.practical_submission_cases VALUES (139, 71, 33, false, 0, 'arr', '', 223.11989999999787);
INSERT INTO public.practical_submission_cases VALUES (140, 71, 34, false, 0, 'arr', '', 195.81890000000567);
INSERT INTO public.practical_submission_cases VALUES (141, 71, 35, false, 0, 'arr', '', 195.64600000000064);
INSERT INTO public.practical_submission_cases VALUES (142, 71, 36, false, 0, 'arr', '', 234.170100000003);
INSERT INTO public.practical_submission_cases VALUES (143, 71, 37, false, 0, 'arr', '', 195.54539999999542);


--
-- Data for Name: practical_submissions; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.practical_submissions VALUES (59, 1353, 20, '\x23696e636c756465203c696f73747265616d3e0d0a23696e636c756465203c766563746f723e0d0a23696e636c756465203c737472696e673e0d0a23696e636c756465203c616c676f726974686d3e0d0a23696e636c756465203c7373747265616d3e0d0a23696e636c756465203c636d6174683e0d0a7573696e67206e616d657370616365207374643b0d0a0d0a696e74206d61696e2829207b0d0a20202020696e74206e3d303b0d0a2020202063696e3e3e6e3b0d0a20202020636f75743c3c6e3b0d0a202020200d0a202020200d0a2020202072657475726e20303b0d0a7d0d0a20', 'cpp', 'Accepted', 15, 10, 664.9235999956727, false, '2026-10-20 09:51:52.109+00');
INSERT INTO public.practical_submissions VALUES (60, 1329, 20, '\x23696e636c756465203c696f73747265616d3e0d0a7573696e67206e616d657370616365207374643b0d0a0d0a696e74206d61696e2829207b0d0a202020202f2f20577269746520796f757220432b2b20636f646520686572650d0a202020202f2f20526561642066726f6d2063696e20616e6420777269746520746f20636f75740d0a20202020696e74206e3d303b0d0a2020202063696e3e3e6e3b0d0a20202020636f75743c3c6e3b0d0a2020202072657475726e20303b0d0a7d', 'cpp', 'Accepted', 15, 10, 704.251099999994, false, '2026-10-21 16:42:38.024+00');
INSERT INTO public.practical_submissions VALUES (61, 1339, 20, '\x23696e636c756465203c696f73747265616d3e0d0a7573696e67206e616d657370616365207374643b0d0a0d0a696e74206d61696e2829207b0d0a20202020696e74206e3d303b0d0a2020202063696e3e3e6e3b0d0a20202020636f75743c3c6e3b0d0a2020202072657475726e20303b0d0a7d', 'cpp', 'Accepted', 15, 10, 718.8290999999881, false, '2026-10-22 05:40:21.89+00');
INSERT INTO public.practical_submissions VALUES (62, 1329, 18, '\x23696e636c756465203c696f73747265616d3e0d0a7573696e67206e616d657370616365207374643b0d0a0d0a696e74206d61696e2829207b0d0a20202020636f75743c3c2273647366223b0d0a2020202072657475726e20303b0d0a7d', 'cpp', 'Wrong Answer', 0, 0, 263.05099999997765, false, '2026-10-22 19:13:27.671+00');
INSERT INTO public.practical_submissions VALUES (63, 1329, 19, '\x23696e636c756465203c696f73747265616d3e0d0a7573696e67206e616d657370616365207374643b0d0a0d0a696e74206d61696e2829207b0d0a20202020636f75743c3c22657274657474223b0d0a2020202072657475726e20303b0d0a7d', 'cpp', 'Wrong Answer', 0, 0, 234.85209999978542, false, '2026-10-24 19:07:36.128+00');
INSERT INTO public.practical_submissions VALUES (65, 1333, 20, '\x23696e636c756465203c696f73747265616d3e0d0a7573696e67206e616d657370616365207374643b0d0a0d0a696e74206d61696e2829207b0d0a20202020696e74206e3d303b0d0a2020202063696e3e3e6e3b0d0a20202020636f75743c3c6e3b0d0a2020202072657475726e20303b0d0a7d', 'cpp', 'Accepted', 15, 10, 692.8980999998748, false, '2026-10-24 20:03:40.244+00');
INSERT INTO public.practical_submissions VALUES (66, 1333, 19, '\x23696e636c756465203c696f73747265616d3e0d0a7573696e67206e616d657370616365207374643b0d0a0d0a696e74206d61696e2829207b0d0a20202020636f75743c3c22657274657474223b0d0a2020202072657475726e20303b0d0a7d', 'cpp', 'Wrong Answer', 0, 0, 213.57919999957085, false, '2026-10-24 20:13:19.069+00');
INSERT INTO public.practical_submissions VALUES (48, 1330, 19, '\x23696e636c756465203c696f73747265616d3e0d0a23696e636c756465203c766563746f723e0d0a23696e636c756465203c737472696e673e0d0a23696e636c756465203c616c676f726974686d3e0d0a23696e636c756465203c7373747265616d3e0d0a23696e636c756465203c636d6174683e0d0a7573696e67206e616d657370616365207374643b0d0a0d0a696e74206d61696e2829207b0d0a202020202f2f205265616420696e707574207573696e672063696e0d0a202020202f2f205072696e74206f7574707574207573696e6720636f75740d0a202020202f2f204578616d706c653a20696e74206e3b2063696e203e3e206e3b0d0a20202020636f75743c3c22657274657474223b0d0a2020202072657475726e20303b0d0a7d0d0a', 'cpp', 'Wrong Answer', 0, 0, 0, false, '2026-10-13 04:31:17.896+00');
INSERT INTO public.practical_submissions VALUES (49, 1330, 17, '\x23696e636c756465203c696f73747265616d3e0d0a23696e636c756465203c766563746f723e0d0a23696e636c756465203c737472696e673e0d0a23696e636c756465203c616c676f726974686d3e0d0a23696e636c756465203c7373747265616d3e0d0a23696e636c756465203c636d6174683e0d0a7573696e67206e616d657370616365207374643b0d0a0d0a696e74206d61696e2829207b0d0a202020202f2f205265616420696e707574207573696e672063696e0d0a202020202f2f205072696e74206f7574707574207573696e6720636f75740d0a202020202f2f204578616d706c653a20696e74206e3b2063696e203e3e206e3b0d0a20202020696e74206e3b0d0a2020202063696e3e3e6e3b0d0a20202020696e74206172725b6e5d3b0d0a20202020666f7228696e742069203d303b693c6e3b692b2b290d0a202020207b0d0a20202020202063696e3e3e6172725b695d3b0d0a202020207d0d0a20202020696e74206d6178693d6172725b305d3b0d0a20202020666f7228696e7420693d303b693c6e3b692b2b290d0a202020207b0d0a2020202020206d6178693d6d6178286d6178692c206172725b695d293b0d0a202020207d0d0a20202020636f75743c3c6d6178693b0d0a2020202072657475726e20303b0d0a7d0d0a', 'cpp', 'Accepted', 10, 10, 0, true, '2026-10-13 05:18:13.561+00');
INSERT INTO public.practical_submissions VALUES (50, 1329, 10, '\x23696e636c756465203c696f73747265616d3e0d0a23696e636c756465203c766563746f723e0d0a23696e636c756465203c737472696e673e0d0a23696e636c756465203c616c676f726974686d3e0d0a23696e636c756465203c7373747265616d3e0d0a23696e636c756465203c636d6174683e0d0a7573696e67206e616d657370616365207374643b0d0a0d0a696e74206d61696e2829207b0d0a202020202f2f205265616420696e707574207573696e672063696e0d0a202020202f2f205072696e74206f7574707574207573696e6720636f75740d0a202020202f2f204578616d706c653a20696e74206e3b2063696e203e3e206e3b0d0a20202020696e74206e3d303b0d0a2020202063696e3e3e6e3b0d0a20202020696e74206172725b6e5d3b0d0a20202020666f7228696e742069203d303b693c6e3b692b2b290d0a202020207b0d0a20202020202063696e3e3e6172725b695d3b0d0a202020207d0d0a20202020696e74206d6178693d303b0d0a20202020666f7228696e742069203d6e2d313b693e3d303b692d2d290d0a202020207b0d0a202020202020636f75743c3c6172725b695d3c3c2220223b0d0a202020207d0d0a2020202072657475726e20303b0d0a7d', 'cpp', 'Accepted', 10, 10, 0, false, '2026-10-17 13:08:19.69+00');
INSERT INTO public.practical_submissions VALUES (52, 1329, 17, '\x23696e636c756465203c696f73747265616d3e0d0a23696e636c756465203c766563746f723e0d0a23696e636c756465203c737472696e673e0d0a23696e636c756465203c616c676f726974686d3e0d0a23696e636c756465203c7373747265616d3e0d0a23696e636c756465203c636d6174683e0d0a7573696e67206e616d657370616365207374643b0d0a0d0a696e74206d61696e2829207b0d0a202020202f2f205265616420696e707574207573696e672063696e0d0a202020202f2f205072696e74206f7574707574207573696e6720636f75740d0a202020202f2f204578616d706c653a20696e74206e3b2063696e203e3e206e3b0d0a20202020696e74206e3d303b0d0a2020202063696e3e3e6e3b0d0a20202020696e74206172725b6e5d3b0d0a20202020666f7228696e7420693d303b693c6e3b692b2b290d0a202020207b0d0a20202020202063696e3e3e6172725b695d3b0d0a202020207d0d0a20202020696e74206d6178693d303b0d0a20202020666f7228696e742069203d303b693c6e3b692b2b290d0a202020207b0d0a2020202020206d6178693d6d6178286d6178692c6172725b695d293b0d0a202020207d0d0a20202020636f75743c3c6d6178693b0d0a2020202072657475726e20303b0d0a7d', 'cpp', 'Accepted', 10, 10, 0, true, '2026-10-17 13:10:08.04+00');
INSERT INTO public.practical_submissions VALUES (53, 1329, 15, '\x23696e636c756465203c696f73747265616d3e0d0a23696e636c756465203c766563746f723e0d0a23696e636c756465203c737472696e673e0d0a23696e636c756465203c616c676f726974686d3e0d0a23696e636c756465203c7373747265616d3e0d0a23696e636c756465203c636d6174683e0d0a7573696e67206e616d657370616365207374643b0d0a0d0a696e74206d61696e2829207b0d0a202020202f2f205265616420696e707574207573696e672063696e0d0a202020202f2f205072696e74206f7574707574207573696e6720636f75740d0a202020202f2f204578616d706c653a20696e74206e3b2063696e203e3e206e3b0d0a20202020696e74206e3b0d0a2020202063696e3e3e6e3b0d0a20202020696e74206172725b6e5d3b0d0a20202020666f7228696e742069203d303b693c6e3b692b2b290d0a202020207b0d0a202020202020202063696e3e3e6172725b695d3b0d0a202020207d0d0a20202020696e74206d696e693d6172725b305d3b0d0a20202020666f7228696e7420693d303b693c6e3b692b2b290d0a202020207b0d0a20202020202020206d696e693d6d696e286d696e692c6172725b695d293b0d0a202020207d0d0a20202020636f75743c3c6d696e693b0d0a2020202072657475726e20303b0d0a7d', 'cpp', 'Accepted', 15, 10, 0, true, '2026-10-17 13:12:11.252+00');
INSERT INTO public.practical_submissions VALUES (58, 1329, 13, '\x23696e636c756465203c696f73747265616d3e0d0a23696e636c756465203c766563746f723e0d0a23696e636c756465203c737472696e673e0d0a23696e636c756465203c616c676f726974686d3e0d0a23696e636c756465203c7373747265616d3e0d0a23696e636c756465203c636d6174683e0d0a7573696e67206e616d657370616365207374643b0d0a0d0a696e74206d61696e2829207b0d0a20202020696e74206e3d303b0d0a2020202063696e3e3e6e3b0d0a20202020696e74206172725b6e5d3b0d0a20202020666f7228696e742069203d303b693c6e3b692b2b290d0a202020207b0d0a202020202020202063696e3e3e6172725b695d3b0d0a202020207d0d0a20202020696e74206d696e693d6172725b305d3b0d0a0d0a20202020666f7228696e7420693d303b693c6e3b692b2b290d0a202020207b0d0a20202020202020206d696e693d6d696e286d696e692c6172725b695d293b0d0a202020207d0d0a20202020636f75743c3c6d696e693b0d0a2020202072657475726e20303b0d0a7d0d0a', 'cpp', 'Accepted', 1, 10, 235.69040000019595, false, '2026-10-20 05:29:15.076+00');
INSERT INTO public.practical_submissions VALUES (67, 1337, 20, '\x23696e636c756465203c696f73747265616d3e0d0a7573696e67206e616d657370616365207374643b0d0a0d0a696e74206d61696e2829207b0d0a20202020696e74206e3d303b0d0a2020202063696e3e3e6e3b0d0a20202020636f75743c3c6e3b0d0a2020202072657475726e20303b0d0a7d', 'cpp', 'Accepted', 15, 10, 687.4912000000477, false, '2026-10-25 14:03:36.47+00');
INSERT INTO public.practical_submissions VALUES (70, 1330, 20, '\x23696e636c756465203c696f73747265616d3e0d0a7573696e67206e616d657370616365207374643b0d0a0d0a696e74206d61696e2829207b0d0a20202020696e74206e3b0d0a2020202063696e3e3e6e3b0d0a20202020636f75743c3c6e3b0d0a2020202072657475726e20303b0d0a7d', 'cpp', 'Accepted', 15, 10, 655.546699999948, false, '2026-10-26 11:40:32.484+00');
INSERT INTO public.practical_submissions VALUES (71, 1330, 10, '\x23696e636c756465203c696f73747265616d3e0d0a7573696e67206e616d657370616365207374643b0d0a0d0a696e74206d61696e2829207b0d0a202020636f75743c3c22617272223b0d0a2020202072657475726e20303b0d0a7d', 'cpp', 'Wrong Answer', 0, 0, 1044.3003000000026, false, '2026-10-29 13:09:51.598+00');


--
-- Data for Name: practical_test_cases; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.practical_test_cases VALUES (3, 2, '3
1 3 4', '2', 15, false, NULL, NULL, 0, 'Test Case 1');
INSERT INTO public.practical_test_cases VALUES (4, 3, '6 3
10 20 30 40 50 60', '40 50 60 10 20 30', 2, false, NULL, NULL, 0, 'Test Case 1');
INSERT INTO public.practical_test_cases VALUES (5, 3, '4 0
5 8 1 9', '5 8 1 9', 2, false, NULL, NULL, 1, 'Test Case 2');
INSERT INTO public.practical_test_cases VALUES (22, 13, '4
1 4 2 3', '1', 1, false, NULL, NULL, 0, 'Test Case 1');
INSERT INTO public.practical_test_cases VALUES (33, 10, '6
2 3 4 5 6 6', '6 6 5 4 3 2 ', 2, false, NULL, NULL, 0, 'Sample 1');
INSERT INTO public.practical_test_cases VALUES (34, 10, '5
1 2 3 4 5', '5 4 3 2 1 ', 2, false, NULL, NULL, 1, 'Sample 2');
INSERT INTO public.practical_test_cases VALUES (35, 10, '1
99', '99 ', 2, true, NULL, NULL, 2, 'Hidden 1 (Single element)');
INSERT INTO public.practical_test_cases VALUES (36, 10, '4
10 20 30 40', '40 30 20 10 ', 2, true, NULL, NULL, 3, 'Hidden 2');
INSERT INTO public.practical_test_cases VALUES (37, 10, '8
-1 -2 -3 -4 -5 -6 -7 -8', '-8 -7 -6 -5 -4 -3 -2 -1 ', 2, true, NULL, NULL, 4, 'Hidden 3');
INSERT INTO public.practical_test_cases VALUES (40, 15, '3
7 4 2', '2', 5, false, NULL, NULL, 0, 'Test Case 1');
INSERT INTO public.practical_test_cases VALUES (41, 15, '5
0 -3 -20 42 15', '-20', 5, false, NULL, NULL, 1, 'Test Case 2');
INSERT INTO public.practical_test_cases VALUES (42, 15, '2
0 0', '0', 5, false, NULL, NULL, 2, 'Test Case 3');
INSERT INTO public.practical_test_cases VALUES (44, 17, '5
0 -1 -1 -2 -6', '0', 10, false, 2, 256, 0, 'Test Case 1');
INSERT INTO public.practical_test_cases VALUES (45, 18, 'dsfsg', 'sdfgd', 5, false, 2, 256, 0, 'Test Case 1');
INSERT INTO public.practical_test_cases VALUES (46, 19, 'saf', 'asfe', 5, false, NULL, NULL, 0, 'Test Case 1');
INSERT INTO public.practical_test_cases VALUES (47, 20, '0
0', '0', 5, false, NULL, NULL, 0, 'Test Case 1');
INSERT INTO public.practical_test_cases VALUES (48, 20, '4
12 13 14 15', '4', 5, false, NULL, NULL, 1, 'Test Case 2');
INSERT INTO public.practical_test_cases VALUES (49, 20, '3
1 3 5', '3', 5, false, NULL, NULL, 2, 'Test Case 3');


--
-- Data for Name: practicals; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.practicals VALUES (15, 1295, 11, 'All', 'MINIMUM OF THE ARRAY ', 'NEED TO FIND THE MINIMUM NUMBER FROM THE ARRAY', '1<=n<100', 15, 'Medium', true, '{"cpp": "#include <iostream>\nusing namespace std;\n\nint main() {\n    // Write your C++ code here\n    // Read from cin and write to cout\n    return 0;\n}", "entry": {"type": "class-method", "className": "Solution", "methodName": "solution"}, "python": "# Write your Python code here\n# Read inputs using input() or sys.stdin\n", "allowed_languages": ["python", "cpp", "java", "c"]}', '5
1 2 3 4 5', '1', '', '[{"input":"6\n56 24 52 87 12 35","expected":"12"}]', '', 'ARRAY', 'active', '2026-09-29 10:35:00+00', '2026-10-02 17:36:04.335+00', '2026-09-29 10:39:45.061+00', '2026-10-20 04:48:13.677+00');
INSERT INTO public.practicals VALUES (13, 1295, 11, 'All', 'MINIMUM NUMBER OF ELEMENT', 'We need to find the minimum element from the reverse array', '', 1, 'Easy', true, '{"cpp": "#include <iostream>\nusing namespace std;\n\nint main() {\n    // Write your C++ code here\n    // Read from cin and write to cout\n    return 0;\n}", "entry": {"type": "class-method", "className": "Solution", "methodName": "solution"}, "python": "# Write your Python code here\n# Read inputs using input() or sys.stdin\n", "allowed_languages": ["cpp"]}', 'first line number of integer
second line elements of the integer', 'minimum of array', '', '[{"input":"5\n1 3 2 4 5","expected":"1"},{"input":"6\n98 99 97 100 11 13","expected":"11"}]', '', '', 'active', NULL, NULL, '2026-09-18 17:50:03.351+00', '2026-10-20 04:48:13.677+00');
INSERT INTO public.practicals VALUES (10, 1291, 11, 'All', 'reverse an array', 'do reverse of an array', '', 10, 'Easy', true, '{"cpp": "#include <iostream>\nusing namespace std;\n\nint main() {\n    // Write your C++ code here\n    // Read from cin and write to cout\n    return 0;\n}", "entry": {"type": "class-method", "className": "Solution", "methodName": "solution"}, "python": "# Write your Python code here\n# Read inputs using input() or sys.stdin\n", "allowed_languages": ["python", "cpp", "java", "c", "javascript"]}', 'first line number of input
second line the array', 'revers of the array', '', '[{"input":"5\n1 2 3 4 5","expected":"5 4 3 2 1 "}]', '', '', 'active', NULL, NULL, '2026-08-23 09:16:15.928+00', '2026-10-20 04:48:13.677+00');
INSERT INTO public.practicals VALUES (3, 1274, 5, 'All', 'Rotate Array to the Right', 'You are given an array of N integers and an integer K. Rotate the array to the right by K positions.

A right rotation moves the last element of the array to the front.', '1≤N≤2×10
5
0≤K≤10
9', 4, 'Medium', true, '{"cpp": "class Solution {\npublic:\n    void solution() {\n        \n    }\n};", "entry": {"type": "class-method", "className": "Solution", "methodName": "solution"}, "python": "class Solution:\n    def solution(self):\n        pass", "allowed_languages": ["python", "cpp"]}', 'First line contains two integers N and K.
Second line contains N space-separated integers.', 'Print the rotated array.', '', '5 2
1 2 3 4 5', '4 5 1 2 3', '', 'active', NULL, NULL, '2026-08-03 20:06:42.945+00', '2026-10-20 04:48:13.677+00');
INSERT INTO public.practicals VALUES (2, 1274, 5, 'All', 'MISSING NUMBER', 'WERTYUIOASDFGHJKL', '1<N<100', 15, 'Medium', true, '{"cpp": "class Solution {\npublic:\n    void solution() {\n        \n    }\n};", "entry": {"type": "class-method", "className": "Solution", "methodName": "solution"}, "python": "class Solution:\n    def solution(self):\n        pass"}', 'IUTRDSCVBNM', 'OIUYTGHJKL', '', '5
1 3 4 5 6', '2', '', 'active', NULL, NULL, '2026-08-03 12:54:20.398+00', '2026-10-20 04:48:13.677+00');
INSERT INTO public.practicals VALUES (18, 1295, 11, 'All', 'sdfgbn', 'sdfb', '', 5, 'Easy', true, '{"cpp": "#include <iostream>\nusing namespace std;\n\nint main() {\n    // Write your C++ code here\n    // Read from cin and write to cout\n    return 0;\n}", "entry": {"type": "class-method", "className": "Solution", "methodName": "solution"}, "python": "# Write your Python code here\n# Read inputs using input() or sys.stdin\n", "allowed_languages": ["python", "cpp"]}', 'sadfg', 'sdfg', '', '[{"input":"sdf","expected":"sdsf"}]', '', 'sadafg', 'active', NULL, NULL, '2026-10-02 17:08:42.9+00', '2026-10-20 04:48:13.677+00');
INSERT INTO public.practicals VALUES (19, 1295, 11, 'All', 'setwrtywwerw', 'qweqweaewrwet', '', 5, 'Easy', true, '{"cpp": "#include <iostream>\nusing namespace std;\n\nint main() {\n    // Write your C++ code here\n    // Read from cin and write to cout\n    return 0;\n}", "entry": {"type": "class-method", "className": "Solution", "methodName": "solution"}, "python": "# Write your Python code here\n# Read inputs using input() or sys.stdin\n", "allowed_languages": ["python", "cpp"]}', 'w45w46qwerwe4t', 'erwt', '', '[{"input":"wert4","expected":"ertett"}]', '', 'ewrt', 'active', NULL, NULL, '2026-10-12 08:09:01.719+00', '2026-10-20 04:48:13.677+00');
INSERT INTO public.practicals VALUES (1, 1274, 5, 'All', 'reverse of array', 'wertyuiopsdfghjkl.', '', 5, 'Easy', true, '{"cpp": "class Solution {\npublic:\n    void solution() {\n        \n    }\n};", "entry": {"type": "class-method", "className": "Solution", "methodName": "solution"}, "python": "class Solution:\n    def solution(self):\n        pass"}', 'The first line contains an integer N, the number of elements in the array.
The second line contains N space-separated integers.', 'Print the elements of the reversed array separated by a single space.', '', '4
10 20 30 40', '40 30 20 10', '', 'active', NULL, '2026-10-23 05:07:39.183+00', '2026-08-03 12:36:27.448+00', '2026-10-23 04:52:39.183+00');
INSERT INTO public.practicals VALUES (20, 1295, 11, 'All', 'SIZE OF THE ARRAY', 'YOU NEED TO FIND THE SIZE OF THE ARRAY', '1<=N<=100', 15, 'Easy', true, '{"cpp": "#include <iostream>\nusing namespace std;\n\nint main() {\n    // Write your C++ code here\n    // Read from cin and write to cout\n    return 0;\n}", "entry": {"type": "class-method", "className": "Solution", "methodName": "solution"}, "python": "# Write your Python code here\n# Read inputs using input() or sys.stdin\n", "allowed_languages": ["python", "cpp"]}', 'FIRST LINE NUMBER OF ELEMENTS 
SECOND LINE ELEMENTS', 'SIZE OF THE ARRAY', '', '[{"input":"5\n1 2 3 4 5","expected":"5"}]', '', 'ARRAYS', 'active', NULL, NULL, '2026-10-20 09:50:14.007+00', '2026-10-20 09:50:14.007+00');
INSERT INTO public.practicals VALUES (17, 1295, 11, 'All', 'MAXIMUM OF THW ARRAY', 'Find maximum of the array', '', 10, 'Easy', true, '{"cpp": "#include <iostream>\nusing namespace std;\n\nint main() {\n    // Write your C++ code here\n    // Read from cin and write to cout\n    return 0;\n}", "entry": {"type": "class-method", "className": "Solution", "methodName": "solution"}, "python": "# Write your Python code here\n# Read inputs using input() or sys.stdin\n", "allowed_languages": ["cpp", "c"]}', 'Number of size of array
Elements of the array', 'maximum element', '', '[{"input":"5\n2 3 1 5 6","expected":"6"}]', '', 'Arrays', 'active', NULL, '2026-11-01 14:21:06.325782+00', '2026-10-02 16:45:17.251+00', '2026-11-01 14:20:06.325782+00');


--
-- Data for Name: student_workspaces; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.student_workspaces VALUES (1305, 15, 'python', '\x7072696e74282254657374696e6720776f726b737061636520636f646520736176652026206c6f61642229', '2026-10-12 03:21:15.562+00');
INSERT INTO public.student_workspaces VALUES (1329, 18, 'python', '\x2320577269746520796f757220507974686f6e20636f646520686572650a23205265616420696e70757473207573696e6720696e7075742829206f72207379732e737464696e0a', '2026-10-22 19:08:58.671+00');
INSERT INTO public.student_workspaces VALUES (1330, 17, 'cpp', '\x23696e636c756465203c696f73747265616d3e0d0a23696e636c756465203c766563746f723e0d0a23696e636c756465203c737472696e673e0d0a23696e636c756465203c616c676f726974686d3e0d0a23696e636c756465203c7373747265616d3e0d0a23696e636c756465203c636d6174683e0d0a7573696e67206e616d657370616365207374643b0d0a0d0a696e74206d61696e2829207b0d0a202020202f2f205265616420696e707574207573696e672063696e0d0a202020202f2f205072696e74206f7574707574207573696e6720636f75740d0a202020202f2f204578616d706c653a20696e74206e3b2063696e203e3e206e3b0d0a20202020696e74206e3b0d0a2020202063696e3e3e6e3b0d0a20202020696e74206172725b6e5d3b0d0a20202020666f7228696e742069203d303b693c6e3b692b2b290d0a202020207b0d0a20202020202063696e3e3e6172725b695d3b0d0a202020207d0d0a20202020696e74206d6178693d6172725b305d3b0d0a20202020666f7228696e7420693d303b693c6e3b692b2b290d0a202020207b0d0a2020202020206d6178693d6d6178286d6178692c206172725b695d293b0d0a202020207d0d0a20202020636f75743c3c6d6178693b0d0a2020202072657475726e20303b0d0a7d0d0a', '2026-10-13 05:18:25.105+00');
INSERT INTO public.student_workspaces VALUES (1329, 10, 'cpp', '\x23696e636c756465203c696f73747265616d3e0d0a23696e636c756465203c766563746f723e0d0a23696e636c756465203c737472696e673e0d0a23696e636c756465203c616c676f726974686d3e0d0a23696e636c756465203c7373747265616d3e0d0a23696e636c756465203c636d6174683e0d0a7573696e67206e616d657370616365207374643b0d0a0d0a696e74206d61696e2829207b0d0a202020202f2f205265616420696e707574207573696e672063696e0d0a202020202f2f205072696e74206f7574707574207573696e6720636f75740d0a202020202f2f204578616d706c653a20696e74206e3b2063696e203e3e206e3b0d0a20202020696e74206e3d303b0d0a2020202063696e3e3e6e3b0d0a20202020696e74206172725b6e5d3b0d0a20202020666f7228696e742069203d303b693c6e3b692b2b290d0a202020207b0d0a20202020202063696e3e3e6172725b695d3b0d0a202020207d0d0a20202020696e74206d6178693d303b0d0a20202020666f7228696e742069203d6e2d313b693e3d303b692d2d290d0a202020207b0d0a202020202020636f75743c3c6172725b695d3c3c2220223b0d0a202020207d0d0a2020202072657475726e20303b0d0a7d', '2026-10-17 13:08:07.41+00');
INSERT INTO public.student_workspaces VALUES (1329, 17, 'cpp', '\x23696e636c756465203c696f73747265616d3e0d0a23696e636c756465203c766563746f723e0d0a23696e636c756465203c737472696e673e0d0a23696e636c756465203c616c676f726974686d3e0d0a23696e636c756465203c7373747265616d3e0d0a23696e636c756465203c636d6174683e0d0a7573696e67206e616d657370616365207374643b0d0a0d0a696e74206d61696e2829207b0d0a202020202f2f205265616420696e707574207573696e672063696e0d0a202020202f2f205072696e74206f7574707574207573696e6720636f75740d0a202020202f2f204578616d706c653a20696e74206e3b2063696e203e3e206e3b0d0a20202020696e74206e3d303b0d0a2020202063696e3e3e6e3b0d0a20202020696e74206172725b6e5d3b0d0a20202020666f7228696e7420693d303b693c6e3b692b2b290d0a202020207b0d0a20202020202063696e3e3e6172725b695d3b0d0a202020207d0d0a20202020696e74206d6178693d303b0d0a20202020666f7228696e742069203d303b693c6e3b692b2b290d0a202020207b0d0a2020202020206d6178693d6d6178286d6178692c6172725b695d293b0d0a202020207d0d0a20202020636f75743c3c6d6178693b0d0a2020202072657475726e20303b0d0a7d', '2026-10-17 13:10:03.031+00');
INSERT INTO public.student_workspaces VALUES (1329, 18, 'cpp', '\x23696e636c756465203c696f73747265616d3e0d0a7573696e67206e616d657370616365207374643b0d0a0d0a696e74206d61696e2829207b0d0a20202020636f75743c3c2273647366223b0d0a2020202072657475726e20303b0d0a7d', '2026-10-22 19:13:25.464+00');
INSERT INTO public.student_workspaces VALUES (1329, 13, 'cpp', '\x23696e636c756465203c696f73747265616d3e0d0a23696e636c756465203c766563746f723e0d0a23696e636c756465203c737472696e673e0d0a23696e636c756465203c616c676f726974686d3e0d0a23696e636c756465203c7373747265616d3e0d0a23696e636c756465203c636d6174683e0d0a7573696e67206e616d657370616365207374643b0d0a0d0a696e74206d61696e2829207b0d0a20202020696e74206e3d303b0d0a2020202063696e3e3e6e3b0d0a20202020696e74206172725b6e5d3b0d0a20202020666f7228696e742069203d303b693c6e3b692b2b290d0a202020207b0d0a202020202020202063696e3e3e6172725b695d3b0d0a202020207d0d0a20202020696e74206d696e693d6172725b305d3b0d0a0d0a20202020666f7228696e7420693d303b693c6e3b692b2b290d0a202020207b0d0a20202020202020206d696e693d6d696e286d696e692c6172725b695d293b0d0a202020207d0d0a20202020636f75743c3c6d696e693b0d0a2020202072657475726e20303b0d0a7d0d0a', '2026-10-20 05:29:13.315+00');
INSERT INTO public.student_workspaces VALUES (1353, 20, 'cpp', '\x23696e636c756465203c696f73747265616d3e0d0a23696e636c756465203c766563746f723e0d0a23696e636c756465203c737472696e673e0d0a23696e636c756465203c616c676f726974686d3e0d0a23696e636c756465203c7373747265616d3e0d0a23696e636c756465203c636d6174683e0d0a7573696e67206e616d657370616365207374643b0d0a0d0a696e74206d61696e2829207b0d0a20202020696e74206e3d303b0d0a2020202063696e3e3e6e3b0d0a20202020636f75743c3c6e3b0d0a202020200d0a202020200d0a2020202072657475726e20303b0d0a7d0d0a20', '2026-10-20 09:51:50.097+00');
INSERT INTO public.student_workspaces VALUES (1329, 15, 'cpp', '\x23696e636c756465203c696f73747265616d3e0d0a23696e636c756465203c766563746f723e0d0a23696e636c756465203c737472696e673e0d0a23696e636c756465203c616c676f726974686d3e0d0a23696e636c756465203c7373747265616d3e0d0a23696e636c756465203c636d6174683e0d0a7573696e67206e616d657370616365207374643b0d0a0d0a696e74206d61696e2829207b0d0a202020202f2f205265616420696e707574207573696e672063696e0d0a202020202f2f205072696e74206f7574707574207573696e6720636f75740d0a202020202f2f204578616d706c653a20696e74206e3b2063696e203e3e206e3b0d0a20202020696e74206e3b0d0a2020202063696e3e3e6e3b0d0a20202020696e74206172725b6e5d3b0d0a20202020666f7228696e742069203d303b693c6e3b692b2b290d0a202020207b0d0a202020202020202063696e3e3e6172725b695d3b0d0a202020207d0d0a20202020696e74206d696e693d6172725b305d3b0d0a20202020666f7228696e7420693d303b693c6e3b692b2b290d0a202020207b0d0a20202020202020206d696e693d6d696e286d696e692c6172725b695d293b0d0a202020207d0d0a20202020636f75743c3c6d696e693b0d0a2020202072657475726e20303b0d0a7d', '2026-10-17 13:12:03.253+00');
INSERT INTO public.student_workspaces VALUES (1338, 20, 'python', '\x7072696e74282268656c6c6f20776f726c642229', '2026-10-21 11:24:30.688+00');
INSERT INTO public.student_workspaces VALUES (1329, 20, 'python', '\x2320577269746520796f757220507974686f6e20636f646520686572650a23205265616420696e70757473207573696e6720696e7075742829206f72207379732e737464696e0a', '2026-10-22 03:06:58.482+00');
INSERT INTO public.student_workspaces VALUES (1329, 20, 'cpp', '\x23696e636c756465203c696f73747265616d3e0d0a7573696e67206e616d657370616365207374643b0d0a0d0a696e74206d61696e2829207b0d0a202020202f2f20577269746520796f757220432b2b20636f646520686572650d0a202020202f2f20526561642066726f6d2063696e20616e6420777269746520746f20636f75740d0a20202020696e74206e3d303b0d0a2020202063696e3e3e6e3b0d0a20202020636f75743c3c6e3b0d0a2020202072657475726e20303b0d0a7d', '2026-10-22 03:07:22.815+00');
INSERT INTO public.student_workspaces VALUES (1339, 10, 'cpp', '\x23696e636c756465203c696f73747265616d3e0d0a7573696e67206e616d657370616365207374643b0d0a0d0a696e74206d61696e2829207b0d0a20202020696e74206e3b0d0a2020202063696e3e3e6e3b0d0a20202020636f75743c3c6e3b0d0a2020202072657475726e20303b0d0a7d', '2026-10-22 05:39:45.005+00');
INSERT INTO public.student_workspaces VALUES (1339, 20, 'cpp', '\x23696e636c756465203c696f73747265616d3e0d0a7573696e67206e616d657370616365207374643b0d0a0d0a696e74206d61696e2829207b0d0a20202020696e74206e3d303b0d0a2020202063696e3e3e6e3b0d0a20202020636f75743c3c6e3b0d0a2020202072657475726e20303b0d0a7d', '2026-10-22 05:40:20.451+00');
INSERT INTO public.student_workspaces VALUES (1329, 19, 'cpp', '\x23696e636c756465203c696f73747265616d3e0d0a7573696e67206e616d657370616365207374643b0d0a0d0a696e74206d61696e2829207b0d0a20202020636f75743c3c22657274657474223b0d0a2020202072657475726e20303b0d0a7d', '2026-10-24 19:07:58.014+00');
INSERT INTO public.student_workspaces VALUES (1333, 19, 'cpp', '\x23696e636c756465203c696f73747265616d3e0d0a7573696e67206e616d657370616365207374643b0d0a0d0a696e74206d61696e2829207b0d0a20202020636f75743c3c22657274657474223b0d0a2020202072657475726e20303b0d0a7d', '2026-10-25 06:47:43.481+00');
INSERT INTO public.student_workspaces VALUES (1333, 13, 'cpp', '\x23696e636c756465203c696f73747265616d3e0a7573696e67206e616d657370616365207374643b0a0a696e74206d61696e2829207b0a20202020636f75743c3c313b0a2020202072657475726e20303b0a7d', '2026-10-24 20:02:17.728+00');
INSERT INTO public.student_workspaces VALUES (1333, 20, 'python', '\x2320577269746520796f757220507974686f6e20636f646520686572650a23205265616420696e70757473207573696e6720696e7075742829206f72207379732e737464696e0a', '2026-10-24 20:02:40.868+00');
INSERT INTO public.student_workspaces VALUES (1333, 20, 'cpp', '\x23696e636c756465203c696f73747265616d3e0d0a7573696e67206e616d657370616365207374643b0d0a0d0a696e74206d61696e2829207b0d0a20202020696e74206e3d303b0d0a2020202063696e3e3e6e3b0d0a20202020636f75743c3c6e3b0d0a2020202072657475726e20303b0d0a7d', '2026-10-24 20:03:40.147+00');
INSERT INTO public.student_workspaces VALUES (1330, 19, 'cpp', '\x23696e636c756465203c696f73747265616d3e0d0a23696e636c756465203c766563746f723e0d0a23696e636c756465203c737472696e673e0d0a23696e636c756465203c616c676f726974686d3e0d0a23696e636c756465203c7373747265616d3e0d0a23696e636c756465203c636d6174683e0d0a7573696e67206e616d657370616365207374643b0d0a0d0a696e74206d61696e2829207b0d0a20202020636f75743c3c22657274657474223b0d0a2020202072657475726e20303b0d0a7d0d0a', '2026-10-26 11:40:14.958105+00');
INSERT INTO public.student_workspaces VALUES (1337, 20, 'cpp', '\x23696e636c756465203c696f73747265616d3e0d0a7573696e67206e616d657370616365207374643b0d0a0d0a696e74206d61696e2829207b0d0a20202020696e74206e3d303b0d0a2020202063696e3e3e6e3b0d0a20202020636f75743c3c6e3b0d0a2020202072657475726e20303b0d0a7d', '2026-10-25 14:03:36.470111+00');
INSERT INTO public.student_workspaces VALUES (1330, 13, 'cpp', '\x23696e636c756465203c696f73747265616d3e0d0a23696e636c756465203c766563746f723e0d0a23696e636c756465203c737472696e673e0d0a23696e636c756465203c616c676f726974686d3e0d0a23696e636c756465203c7373747265616d3e0d0a23696e636c756465203c636d6174683e0d0a7573696e67206e616d657370616365207374643b0d0a0d0a696e74206d61696e2829207b0d0a202020202f2f205265616420696e707574207573696e672063696e0d0a202020202f2f205072696e74206f7574707574207573696e6720636f75740d0a202020202f2f204578616d706c653a20696e74206e3b2063696e203e3e206e3b0d0a202020207768696c652831290d0a202020207b0d0a202020202020636f75743c3c313b0d0a202020207d0d0a2020202072657475726e20303b0d0a7d0d0a', '2026-10-25 14:32:56.767182+00');
INSERT INTO public.student_workspaces VALUES (1307, 3, 'cpp', '\x2f2f204c6f63616c20444220566572696669636174696f6e20546573740a23696e636c756465203c696f73747265616d3e0a696e74206d61696e2829207b207374643a3a636f7574203c3c20224c6f63616c204442204f7065726174696f6e616c22203c3c207374643a3a656e646c3b2072657475726e20303b207d0a', '2026-10-25 15:25:26.38623+00');
INSERT INTO public.student_workspaces VALUES (1330, 20, 'cpp', '\x23696e636c756465203c696f73747265616d3e0d0a7573696e67206e616d657370616365207374643b0d0a0d0a696e74206d61696e2829207b0d0a20202020696e74206e3b0d0a2020202063696e3e3e6e3b0d0a20202020636f75743c3c6e3b0d0a2020202072657475726e20303b0d0a7d', '2026-10-26 11:40:32.484498+00');
INSERT INTO public.student_workspaces VALUES (1330, 10, 'cpp', '\x23696e636c756465203c696f73747265616d3e0d0a7573696e67206e616d657370616365207374643b0d0a0d0a696e74206d61696e2829207b0d0a202020636f75743c3c22617272223b0d0a2020202072657475726e20303b0d0a7d', '2026-10-29 13:09:56.847861+00');
INSERT INTO public.student_workspaces VALUES (1304, 1, 'python', '\x0a64656620666163746f7269616c286e293a0a202020206966206e203c3d20313a2072657475726e20310a2020202072657475726e206e202a20666163746f7269616c286e2d31290a0a6e203d20696e7428696e7075742829290a7072696e7428666163746f7269616c286e29290a', '2026-11-01 12:38:09.449649+00');
INSERT INTO public.student_workspaces VALUES (1304, 1, 'c', '\x0a23696e636c756465203c737464696f2e683e0a696e74206d61696e2829207b0a20202020696e74206e2c2073756d203d20303b0a202020207363616e6628222564222c20266e293b0a20202020666f722028696e742069203d20313b2069203c3d206e3b20692b2b292073756d202b3d20693b0a202020207072696e7466282225645c6e222c2073756d293b0a2020202072657475726e20303b0a7d0a', '2026-11-01 12:38:09.451632+00');
INSERT INTO public.student_workspaces VALUES (1304, 1, 'java', '\x0a696d706f7274206a6176612e7574696c2e5363616e6e65723b0a7075626c696320636c617373204d61696e207b0a202020207075626c69632073746174696320766f6964206d61696e28537472696e675b5d206172677329207b0a20202020202020205363616e6e6572207363203d206e6577205363616e6e65722853797374656d2e696e293b0a2020202020202020696e74206e203d2073632e6e657874496e7428293b0a20202020202020206c6f6e6720666962203d20312c2070726576203d20303b0a2020202020202020666f722028696e742069203d20313b2069203c206e3b20692b2b29207b0a2020202020202020202020206c6f6e67206e657874203d20666962202b20707265763b0a20202020202020202020202070726576203d206669623b0a202020202020202020202020666962203d206e6578743b0a20202020202020207d0a202020202020202053797374656d2e6f75742e7072696e746c6e28666962293b0a202020207d0a7d0a', '2026-11-01 12:38:05.636627+00');
INSERT INTO public.student_workspaces VALUES (1304, 1, 'cpp', '\x0a23696e636c756465203c696f73747265616d3e0a23696e636c756465203c766563746f723e0a23696e636c756465203c616c676f726974686d3e0a7573696e67206e616d657370616365207374643b0a696e74206d61696e2829207b0a20202020696e74206e3b2063696e203e3e206e3b0a20202020766563746f723c696e743e2076286e293b0a20202020666f7220286175746f262078203a2076292063696e203e3e20783b0a20202020736f727428762e626567696e28292c20762e656e642829293b0a20202020666f7220286175746f2078203a20762920636f7574203c3c2078203c3c202220223b0a2020202072657475726e20303b0a7d0a', '2026-11-01 12:38:07.085359+00');


--
-- Data for Name: submission_attempts; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.submission_attempts VALUES ('eaa93715-adc1-412e-bf66-f64dca355ecb', 1329, 19, '\x23696e636c756465203c696f73747265616d3e0d0a23696e636c756465203c766563746f723e0d0a23696e636c756465203c737472696e673e0d0a23696e636c756465203c616c676f726974686d3e0d0a23696e636c756465203c7373747265616d3e0d0a23696e636c756465203c636d6174683e0d0a7573696e67206e616d657370616365207374643b0d0a0d0a696e74206d61696e2829207b0d0a202020202f2f205265616420696e707574207573696e672063696e0d0a202020202f2f205072696e74206f7574707574207573696e6720636f75740d0a202020202f2f204578616d706c653a20696e74206e3b2063696e203e3e206e3b0d0a20202020636f75743c3c22657274657474223b0d0a2020202072657475726e20303b0d0a7d', 'cpp', 0, 0, '[{"passed": false, "test_case_id": 46, "actual_output": "ertett", "error_message": "", "marks_awarded": 0, "execution_time_ms": 262.0699999999488}]', '{"cases": [{"id": 46, "index": 1, "input": "saf", "label": "Test Case 1", "actual": "ertett", "hidden": false, "passed": false, "status": "wrong_answer", "stderr": "", "stdout": "ertett", "expected": "asfe", "is_hidden": false, "max_marks": "5", "runtimeMs": 262.07, "actual_output": "ertett", "error_message": "", "marks_awarded": 0, "expected_output": "asfe", "execution_time_ms": 262.07}], "status": "wrong_answer", "summary": "0 / 1 cases passed", "exitCode": 0, "rawMarks": 0, "attemptId": "eaa93715-adc1-412e-bf66-f64dca355ecb", "compileError": null, "runtimeError": null, "submissionId": 56, "overallStatus": "Wrong Answer", "normalizedMarks": 0}', '2026-10-20 05:19:29.33+00', '2026-10-20 05:19:34.356+00');
INSERT INTO public.submission_attempts VALUES ('ef59bee5-5499-44da-bb70-d9a0f4d07691', 1329, 19, '\x23696e636c756465203c696f73747265616d3e0d0a23696e636c756465203c766563746f723e0d0a23696e636c756465203c737472696e673e0d0a23696e636c756465203c616c676f726974686d3e0d0a23696e636c756465203c7373747265616d3e0d0a23696e636c756465203c636d6174683e0d0a7573696e67206e616d657370616365207374643b0d0a0d0a696e74206d61696e2829207b0d0a202020202f2f205265616420696e707574207573696e672063696e0d0a202020202f2f205072696e74206f7574707574207573696e6720636f75740d0a202020202f2f204578616d706c653a20696e74206e3b2063696e203e3e206e3b0d0a20202020636f75743c3c22657274657474223b0d0a2020202072657475726e20303b0d0a7d', 'cpp', 0, 0, '[{"passed": false, "test_case_id": 46, "actual_output": "ertett", "error_message": "", "marks_awarded": 0, "execution_time_ms": 246.64949999994133}]', '{"cases": [{"id": 46, "index": 1, "input": "saf", "label": "Test Case 1", "actual": "ertett", "hidden": false, "passed": false, "status": "wrong_answer", "stderr": "", "stdout": "ertett", "expected": "asfe", "is_hidden": false, "max_marks": "5", "runtimeMs": 246.65, "actual_output": "ertett", "error_message": "", "marks_awarded": 0, "expected_output": "asfe", "execution_time_ms": 246.65}], "status": "wrong_answer", "summary": "0 / 1 cases passed", "exitCode": 0, "rawMarks": 0, "attemptId": "ef59bee5-5499-44da-bb70-d9a0f4d07691", "compileError": null, "runtimeError": null, "submissionId": 56, "overallStatus": "Wrong Answer", "normalizedMarks": 0}', '2026-10-20 05:22:13.483+00', '2026-10-20 05:22:20.321+00');
INSERT INTO public.submission_attempts VALUES ('30c2954d-9e61-4764-bd23-8434972c209a', 1329, 13, '\x23696e636c756465203c696f73747265616d3e0d0a23696e636c756465203c766563746f723e0d0a23696e636c756465203c737472696e673e0d0a23696e636c756465203c616c676f726974686d3e0d0a23696e636c756465203c7373747265616d3e0d0a23696e636c756465203c636d6174683e0d0a7573696e67206e616d657370616365207374643b0d0a0d0a696e74206d61696e2829207b0d0a20202020696e74206e3d303b0d0a2020202063696e3e3e6e3b0d0a20202020696e74206172725b6e5d3b0d0a20202020666f7228696e742069203d303b693c6e3b692b2b290d0a202020207b0d0a202020202020202063696e3e3e6172725b695d3b0d0a202020207d0d0a20202020696e74206d696e693d6172725b305d3b0d0a0d0a20202020666f7228696e7420693d303b693c6e3b692b2b290d0a202020207b0d0a20202020202020206d696e693d6d696e286d696e692c6172725b695d293b0d0a202020207d0d0a20202020636f75743c3c6d696e693b0d0a2020202072657475726e20303b0d0a7d0d0a', 'cpp', 10, 1, '[{"passed": true, "test_case_id": 22, "actual_output": "1", "error_message": "", "marks_awarded": 1, "execution_time_ms": 235.69040000019595}]', '{"cases": [{"id": 22, "index": 1, "input": "4\n1 4 2 3", "label": "Test Case 1", "actual": "1", "hidden": false, "passed": true, "status": "passed", "stderr": "", "stdout": "1", "expected": "1", "is_hidden": false, "max_marks": "1", "runtimeMs": 235.69, "actual_output": "1", "error_message": "", "marks_awarded": 1, "expected_output": "1", "execution_time_ms": 235.69}], "status": "accepted", "summary": "All test cases passed", "exitCode": 0, "rawMarks": 1, "attemptId": "30c2954d-9e61-4764-bd23-8434972c209a", "compileError": null, "runtimeError": null, "submissionId": 58, "overallStatus": "Accepted", "normalizedMarks": 10}', '2026-10-20 05:29:15.076+00', '2026-10-20 05:29:19.782+00');
INSERT INTO public.submission_attempts VALUES ('b3125613-6586-416e-81a5-2eb0daffd9af', 1353, 20, '\x23696e636c756465203c696f73747265616d3e0d0a23696e636c756465203c766563746f723e0d0a23696e636c756465203c737472696e673e0d0a23696e636c756465203c616c676f726974686d3e0d0a23696e636c756465203c7373747265616d3e0d0a23696e636c756465203c636d6174683e0d0a7573696e67206e616d657370616365207374643b0d0a0d0a696e74206d61696e2829207b0d0a20202020696e74206e3d303b0d0a2020202063696e3e3e6e3b0d0a20202020636f75743c3c6e3b0d0a202020200d0a202020200d0a2020202072657475726e20303b0d0a7d0d0a20', 'cpp', 10, 15, '[{"passed": true, "test_case_id": 47, "actual_output": "0", "error_message": "", "marks_awarded": 5, "execution_time_ms": 222.12679999694228}, {"passed": true, "test_case_id": 48, "actual_output": "4", "error_message": "", "marks_awarded": 5, "execution_time_ms": 229.70369999855757}, {"passed": true, "test_case_id": 49, "actual_output": "3", "error_message": "", "marks_awarded": 5, "execution_time_ms": 213.09310000017285}]', '{"cases": [{"id": 47, "index": 1, "input": "0\n0", "label": "Test Case 1", "actual": "0", "hidden": false, "passed": true, "status": "passed", "stderr": "", "stdout": "0", "expected": "0", "is_hidden": false, "max_marks": "5", "runtimeMs": 222.13, "actual_output": "0", "error_message": "", "marks_awarded": 5, "expected_output": "0", "execution_time_ms": 222.13}, {"id": 48, "index": 2, "input": "4\n12 13 14 15", "label": "Test Case 2", "actual": "4", "hidden": false, "passed": true, "status": "passed", "stderr": "", "stdout": "4", "expected": "4", "is_hidden": false, "max_marks": "5", "runtimeMs": 229.7, "actual_output": "4", "error_message": "", "marks_awarded": 5, "expected_output": "4", "execution_time_ms": 229.7}, {"id": 49, "index": 3, "input": "3\n1 3 5", "label": "Test Case 3", "actual": "3", "hidden": false, "passed": true, "status": "passed", "stderr": "", "stdout": "3", "expected": "3", "is_hidden": false, "max_marks": "5", "runtimeMs": 213.09, "actual_output": "3", "error_message": "", "marks_awarded": 5, "expected_output": "3", "execution_time_ms": 213.09}], "status": "accepted", "summary": "All test cases passed", "exitCode": 0, "rawMarks": 15, "attemptId": "b3125613-6586-416e-81a5-2eb0daffd9af", "compileError": null, "runtimeError": null, "submissionId": 59, "overallStatus": "Accepted", "normalizedMarks": 10}', '2026-10-20 09:51:52.109+00', '2026-10-20 09:51:56.376+00');
INSERT INTO public.submission_attempts VALUES ('08b39b4e-d18e-4208-8262-7b4d2e5539a4', 1329, 20, '\x23696e636c756465203c696f73747265616d3e0d0a7573696e67206e616d657370616365207374643b0d0a0d0a696e74206d61696e2829207b0d0a202020202f2f20577269746520796f757220432b2b20636f646520686572650d0a202020202f2f20526561642066726f6d2063696e20616e6420777269746520746f20636f75740d0a20202020696e74206e3d303b0d0a2020202063696e3e3e6e3b0d0a20202020636f75743c3c6e3b0d0a2020202072657475726e20303b0d0a7d', 'cpp', 10, 15, '[{"passed": true, "test_case_id": 47, "actual_output": "0", "error_message": "", "marks_awarded": 5, "execution_time_ms": 263.2060000002384}, {"passed": true, "test_case_id": 48, "actual_output": "4", "error_message": "", "marks_awarded": 5, "execution_time_ms": 219.5751000009477}, {"passed": true, "test_case_id": 49, "actual_output": "3", "error_message": "", "marks_awarded": 5, "execution_time_ms": 221.4699999988079}]', '{"cases": [{"id": 47, "index": 1, "input": "0\n0", "label": "Test Case 1", "actual": "0", "hidden": false, "passed": true, "status": "passed", "stderr": "", "stdout": "0", "expected": "0", "is_hidden": false, "max_marks": "5", "runtimeMs": 263.21, "actual_output": "0", "error_message": "", "marks_awarded": 5, "expected_output": "0", "execution_time_ms": 263.21}, {"id": 48, "index": 2, "input": "4\n12 13 14 15", "label": "Test Case 2", "actual": "4", "hidden": false, "passed": true, "status": "passed", "stderr": "", "stdout": "4", "expected": "4", "is_hidden": false, "max_marks": "5", "runtimeMs": 219.58, "actual_output": "4", "error_message": "", "marks_awarded": 5, "expected_output": "4", "execution_time_ms": 219.58}, {"id": 49, "index": 3, "input": "3\n1 3 5", "label": "Test Case 3", "actual": "3", "hidden": false, "passed": true, "status": "passed", "stderr": "", "stdout": "3", "expected": "3", "is_hidden": false, "max_marks": "5", "runtimeMs": 221.47, "actual_output": "3", "error_message": "", "marks_awarded": 5, "expected_output": "3", "execution_time_ms": 221.47}], "status": "accepted", "summary": "All test cases passed", "exitCode": 0, "rawMarks": 15, "attemptId": "08b39b4e-d18e-4208-8262-7b4d2e5539a4", "compileError": null, "runtimeError": null, "submissionId": 60, "overallStatus": "Accepted", "normalizedMarks": 10}', '2026-10-21 16:42:38.024+00', '2026-10-21 16:42:42.151+00');
INSERT INTO public.submission_attempts VALUES ('86f020ef-73db-4fbe-872e-21924d8e9f55', 1333, 19, '\x23696e636c756465203c696f73747265616d3e0d0a7573696e67206e616d657370616365207374643b0d0a0d0a696e74206d61696e2829207b0d0a20202020636f75743c3c22657274657474223b0d0a2020202072657475726e20303b0d0a7d', 'cpp', 0, 0, '[{"passed": false, "test_case_id": 46, "actual_output": "ertett", "error_message": "", "marks_awarded": 0, "execution_time_ms": 320.54329999536276}]', '{"cases": [{"id": 46, "index": 1, "input": "saf", "label": "Test Case 1", "actual": "ertett", "hidden": false, "passed": false, "status": "wrong_answer", "stderr": "", "stdout": "ertett", "expected": "asfe", "is_hidden": false, "max_marks": "5", "runtimeMs": 320.54, "actual_output": "ertett", "error_message": "", "marks_awarded": 0, "expected_output": "asfe", "execution_time_ms": 320.54}], "status": "wrong_answer", "summary": "0 / 1 cases passed", "exitCode": 0, "rawMarks": 0, "attemptId": "86f020ef-73db-4fbe-872e-21924d8e9f55", "compileError": null, "runtimeError": null, "submissionId": 66, "overallStatus": "Wrong Answer", "normalizedMarks": 0}', '2026-10-25 06:47:44.147+00', '2026-10-25 06:47:48.88+00');
INSERT INTO public.submission_attempts VALUES ('6d8440f1-17eb-48ab-b8a5-f95cf8a2407e', 1339, 20, '\x23696e636c756465203c696f73747265616d3e0d0a7573696e67206e616d657370616365207374643b0d0a0d0a696e74206d61696e2829207b0d0a20202020696e74206e3d303b0d0a2020202063696e3e3e6e3b0d0a20202020636f75743c3c6e3b0d0a2020202072657475726e20303b0d0a7d', 'cpp', 10, 15, '[{"passed": true, "test_case_id": 47, "actual_output": "0", "error_message": "", "marks_awarded": 5, "execution_time_ms": 208.73029999999562}, {"passed": true, "test_case_id": 48, "actual_output": "4", "error_message": "", "marks_awarded": 5, "execution_time_ms": 214.8003999999928}, {"passed": true, "test_case_id": 49, "actual_output": "3", "error_message": "", "marks_awarded": 5, "execution_time_ms": 295.2983999999997}]', '{"cases": [{"id": 47, "index": 1, "input": "0\n0", "label": "Test Case 1", "actual": "0", "hidden": false, "passed": true, "status": "passed", "stderr": "", "stdout": "0", "expected": "0", "is_hidden": false, "max_marks": "5", "runtimeMs": 208.73, "actual_output": "0", "error_message": "", "marks_awarded": 5, "expected_output": "0", "execution_time_ms": 208.73}, {"id": 48, "index": 2, "input": "4\n12 13 14 15", "label": "Test Case 2", "actual": "4", "hidden": false, "passed": true, "status": "passed", "stderr": "", "stdout": "4", "expected": "4", "is_hidden": false, "max_marks": "5", "runtimeMs": 214.8, "actual_output": "4", "error_message": "", "marks_awarded": 5, "expected_output": "4", "execution_time_ms": 214.8}, {"id": 49, "index": 3, "input": "3\n1 3 5", "label": "Test Case 3", "actual": "3", "hidden": false, "passed": true, "status": "passed", "stderr": "", "stdout": "3", "expected": "3", "is_hidden": false, "max_marks": "5", "runtimeMs": 295.3, "actual_output": "3", "error_message": "", "marks_awarded": 5, "expected_output": "3", "execution_time_ms": 295.3}], "status": "accepted", "summary": "All test cases passed", "exitCode": 0, "rawMarks": 15, "attemptId": "6d8440f1-17eb-48ab-b8a5-f95cf8a2407e", "compileError": null, "runtimeError": null, "submissionId": 61, "overallStatus": "Accepted", "normalizedMarks": 10}', '2026-10-22 05:40:21.89+00', '2026-10-22 05:40:24.705+00');
INSERT INTO public.submission_attempts VALUES ('e00ae21f-a456-4f11-acd8-2df1ce2307fb', 1329, 18, '\x23696e636c756465203c696f73747265616d3e0d0a7573696e67206e616d657370616365207374643b0d0a0d0a696e74206d61696e2829207b0d0a20202020636f75743c3c2273647366223b0d0a2020202072657475726e20303b0d0a7d', 'cpp', 0, 0, '[{"passed": false, "test_case_id": 45, "actual_output": "sdsf", "error_message": "", "marks_awarded": 0, "execution_time_ms": 263.05099999997765}]', '{"cases": [{"id": 45, "index": 1, "input": "dsfsg", "label": "Test Case 1", "actual": "sdsf", "hidden": false, "passed": false, "status": "wrong_answer", "stderr": "", "stdout": "sdsf", "expected": "sdfgd", "is_hidden": false, "max_marks": "5", "runtimeMs": 263.05, "actual_output": "sdsf", "error_message": "", "marks_awarded": 0, "expected_output": "sdfgd", "execution_time_ms": 263.05}], "status": "wrong_answer", "summary": "0 / 1 cases passed", "exitCode": 0, "rawMarks": 0, "attemptId": "e00ae21f-a456-4f11-acd8-2df1ce2307fb", "compileError": null, "runtimeError": null, "submissionId": 62, "overallStatus": "Wrong Answer", "normalizedMarks": 0}', '2026-10-22 19:13:27.671+00', '2026-10-22 19:13:30.547+00');
INSERT INTO public.submission_attempts VALUES ('7039c649-cf9d-4e2e-b9a9-a056dd2d0a72', 1329, 19, '\x23696e636c756465203c696f73747265616d3e0d0a7573696e67206e616d657370616365207374643b0d0a0d0a696e74206d61696e2829207b0d0a20202020636f75743c3c22657274657474223b0d0a2020202072657475726e20303b0d0a7d', 'cpp', 0, 0, '[{"passed": false, "test_case_id": 46, "actual_output": "ertett", "error_message": "", "marks_awarded": 0, "execution_time_ms": 234.85209999978542}]', '{"cases": [{"id": 46, "index": 1, "input": "saf", "label": "Test Case 1", "actual": "ertett", "hidden": false, "passed": false, "status": "wrong_answer", "stderr": "", "stdout": "ertett", "expected": "asfe", "is_hidden": false, "max_marks": "5", "runtimeMs": 234.85, "actual_output": "ertett", "error_message": "", "marks_awarded": 0, "expected_output": "asfe", "execution_time_ms": 234.85}], "status": "wrong_answer", "summary": "0 / 1 cases passed", "exitCode": 0, "rawMarks": 0, "attemptId": "7039c649-cf9d-4e2e-b9a9-a056dd2d0a72", "compileError": null, "runtimeError": null, "submissionId": 63, "overallStatus": "Wrong Answer", "normalizedMarks": 0}', '2026-10-24 19:07:36.128+00', '2026-10-24 19:07:41.127+00');
INSERT INTO public.submission_attempts VALUES ('ca89d3c0-5458-4bb1-a0dd-cf932322c554', 1329, 19, '\x23696e636c756465203c696f73747265616d3e0d0a7573696e67206e616d657370616365207374643b0d0a0d0a696e74206d61696e2829207b0d0a20202020636f75743c3c22657274657474223b0d0a2020202072657475726e20303b0d0a7d', 'cpp', 0, 0, '[{"passed": false, "test_case_id": 46, "actual_output": "ertett", "error_message": "", "marks_awarded": 0, "execution_time_ms": 293.5586999999359}]', '{"cases": [{"id": 46, "index": 1, "input": "saf", "label": "Test Case 1", "actual": "ertett", "hidden": false, "passed": false, "status": "wrong_answer", "stderr": "", "stdout": "ertett", "expected": "asfe", "is_hidden": false, "max_marks": "5", "runtimeMs": 293.56, "actual_output": "ertett", "error_message": "", "marks_awarded": 0, "expected_output": "asfe", "execution_time_ms": 293.56}], "status": "wrong_answer", "summary": "0 / 1 cases passed", "exitCode": 0, "rawMarks": 0, "attemptId": "ca89d3c0-5458-4bb1-a0dd-cf932322c554", "compileError": null, "runtimeError": null, "submissionId": 63, "overallStatus": "Wrong Answer", "normalizedMarks": 0}', '2026-10-24 19:07:59.452+00', '2026-10-24 19:08:03.878+00');
INSERT INTO public.submission_attempts VALUES ('277ea191-52c1-40e5-ae44-38a5699fd746', 1333, 20, '\x23696e636c756465203c696f73747265616d3e0d0a7573696e67206e616d657370616365207374643b0d0a0d0a696e74206d61696e2829207b0d0a20202020696e74206e3d303b0d0a2020202063696e3e3e6e3b0d0a20202020636f75743c3c6e3b0d0a2020202072657475726e20303b0d0a7d', 'cpp', 10, 15, '[{"passed": true, "test_case_id": 47, "actual_output": "0", "error_message": "", "marks_awarded": 5, "execution_time_ms": 244.52160000056028}, {"passed": true, "test_case_id": 48, "actual_output": "4", "error_message": "", "marks_awarded": 5, "execution_time_ms": 211.57019999995828}, {"passed": true, "test_case_id": 49, "actual_output": "3", "error_message": "", "marks_awarded": 5, "execution_time_ms": 236.80629999935627}]', '{"cases": [{"id": 47, "index": 1, "input": "0\n0", "label": "Test Case 1", "actual": "0", "hidden": false, "passed": true, "status": "passed", "stderr": "", "stdout": "0", "expected": "0", "is_hidden": false, "max_marks": "5", "runtimeMs": 244.52, "actual_output": "0", "error_message": "", "marks_awarded": 5, "expected_output": "0", "execution_time_ms": 244.52}, {"id": 48, "index": 2, "input": "4\n12 13 14 15", "label": "Test Case 2", "actual": "4", "hidden": false, "passed": true, "status": "passed", "stderr": "", "stdout": "4", "expected": "4", "is_hidden": false, "max_marks": "5", "runtimeMs": 211.57, "actual_output": "4", "error_message": "", "marks_awarded": 5, "expected_output": "4", "execution_time_ms": 211.57}, {"id": 49, "index": 3, "input": "3\n1 3 5", "label": "Test Case 3", "actual": "3", "hidden": false, "passed": true, "status": "passed", "stderr": "", "stdout": "3", "expected": "3", "is_hidden": false, "max_marks": "5", "runtimeMs": 236.81, "actual_output": "3", "error_message": "", "marks_awarded": 5, "expected_output": "3", "execution_time_ms": 236.81}], "status": "accepted", "summary": "All test cases passed", "exitCode": 0, "rawMarks": 15, "attemptId": "277ea191-52c1-40e5-ae44-38a5699fd746", "compileError": null, "runtimeError": null, "submissionId": 65, "overallStatus": "Accepted", "normalizedMarks": 10}', '2026-10-24 20:03:40.244+00', '2026-10-24 20:03:44.786+00');
INSERT INTO public.submission_attempts VALUES ('3c153382-d834-4cf3-ad8f-3ae7483aed6d', 1333, 19, '\x23696e636c756465203c696f73747265616d3e0d0a7573696e67206e616d657370616365207374643b0d0a0d0a696e74206d61696e2829207b0d0a20202020636f75743c3c22657274657474223b0d0a2020202072657475726e20303b0d0a7d', 'cpp', 0, 0, '[{"passed": false, "test_case_id": 46, "actual_output": "ertett", "error_message": "", "marks_awarded": 0, "execution_time_ms": 213.57919999957085}]', '{"cases": [{"id": 46, "index": 1, "input": "saf", "label": "Test Case 1", "actual": "ertett", "hidden": false, "passed": false, "status": "wrong_answer", "stderr": "", "stdout": "ertett", "expected": "asfe", "is_hidden": false, "max_marks": "5", "runtimeMs": 213.58, "actual_output": "ertett", "error_message": "", "marks_awarded": 0, "expected_output": "asfe", "execution_time_ms": 213.58}], "status": "wrong_answer", "summary": "0 / 1 cases passed", "exitCode": 0, "rawMarks": 0, "attemptId": "3c153382-d834-4cf3-ad8f-3ae7483aed6d", "compileError": null, "runtimeError": null, "submissionId": 66, "overallStatus": "Wrong Answer", "normalizedMarks": 0}', '2026-10-24 20:13:19.069+00', '2026-10-24 20:13:23.486+00');
INSERT INTO public.submission_attempts VALUES ('2e02024a-cb10-49df-8741-32c2a151a49d', 1337, 20, '\x23696e636c756465203c696f73747265616d3e0d0a7573696e67206e616d657370616365207374643b0d0a0d0a696e74206d61696e2829207b0d0a20202020696e74206e3d303b0d0a2020202063696e3e3e6e3b0d0a20202020636f75743c3c6e3b0d0a2020202072657475726e20303b0d0a7d', 'cpp', 10, 15, '[{"passed": true, "test_case_id": 47, "actual_output": "0", "error_message": "", "marks_awarded": 5, "execution_time_ms": 235.70639999955893}, {"passed": true, "test_case_id": 48, "actual_output": "4", "error_message": "", "marks_awarded": 5, "execution_time_ms": 231.62319999933243}, {"passed": true, "test_case_id": 49, "actual_output": "3", "error_message": "", "marks_awarded": 5, "execution_time_ms": 220.16160000115633}]', '{"cases": [{"id": 47, "index": 1, "input": "0\n0", "label": "Test Case 1", "actual": "0", "hidden": false, "passed": true, "status": "passed", "stderr": "", "stdout": "0", "expected": "0", "is_hidden": false, "max_marks": "5", "runtimeMs": 235.71, "actual_output": "0", "error_message": "", "marks_awarded": 5, "expected_output": "0", "execution_time_ms": 235.71}, {"id": 48, "index": 2, "input": "4\n12 13 14 15", "label": "Test Case 2", "actual": "4", "hidden": false, "passed": true, "status": "passed", "stderr": "", "stdout": "4", "expected": "4", "is_hidden": false, "max_marks": "5", "runtimeMs": 231.62, "actual_output": "4", "error_message": "", "marks_awarded": 5, "expected_output": "4", "execution_time_ms": 231.62}, {"id": 49, "index": 3, "input": "3\n1 3 5", "label": "Test Case 3", "actual": "3", "hidden": false, "passed": true, "status": "passed", "stderr": "", "stdout": "3", "expected": "3", "is_hidden": false, "max_marks": "5", "runtimeMs": 220.16, "actual_output": "3", "error_message": "", "marks_awarded": 5, "expected_output": "3", "execution_time_ms": 220.16}], "status": "accepted", "summary": "All test cases passed", "exitCode": 0, "rawMarks": 15, "attemptId": "2e02024a-cb10-49df-8741-32c2a151a49d", "compileError": null, "runtimeError": null, "submissionId": 67, "overallStatus": "Accepted", "normalizedMarks": 10}', '2026-10-25 14:03:36.47+00', '2026-10-25 14:03:38.538691+00');
INSERT INTO public.submission_attempts VALUES ('82dc6b71-70da-4ab9-95b3-570632db55d0', 1330, 19, '\x23696e636c756465203c696f73747265616d3e0d0a23696e636c756465203c766563746f723e0d0a23696e636c756465203c737472696e673e0d0a23696e636c756465203c616c676f726974686d3e0d0a23696e636c756465203c7373747265616d3e0d0a23696e636c756465203c636d6174683e0d0a7573696e67206e616d657370616365207374643b0d0a0d0a696e74206d61696e2829207b0d0a20202020636f75743c3c22657274657474223b0d0a2020202072657475726e20303b0d0a7d0d0a', 'cpp', 0, 0, '[{"passed": false, "test_case_id": 46, "actual_output": "ertett", "error_message": "", "marks_awarded": 0, "execution_time_ms": 248.44330000132322}]', '{"cases": [{"id": 46, "index": 1, "input": "saf", "label": "Test Case 1", "actual": "ertett", "hidden": false, "passed": false, "status": "wrong_answer", "stderr": "", "stdout": "ertett", "expected": "asfe", "is_hidden": false, "max_marks": "5", "runtimeMs": 248.44, "actual_output": "ertett", "error_message": "", "marks_awarded": 0, "expected_output": "asfe", "execution_time_ms": 248.44}], "status": "wrong_answer", "summary": "0 / 1 cases passed", "exitCode": 0, "rawMarks": 0, "attemptId": "82dc6b71-70da-4ab9-95b3-570632db55d0", "compileError": null, "runtimeError": null, "submissionId": 48, "overallStatus": "Wrong Answer", "normalizedMarks": 0}', '2026-10-25 19:27:28.898+00', '2026-10-25 19:27:31.016635+00');
INSERT INTO public.submission_attempts VALUES ('cb701205-7380-4a84-a303-21df3e029bd9', 1330, 19, '\x23696e636c756465203c696f73747265616d3e0d0a23696e636c756465203c766563746f723e0d0a23696e636c756465203c737472696e673e0d0a23696e636c756465203c616c676f726974686d3e0d0a23696e636c756465203c7373747265616d3e0d0a23696e636c756465203c636d6174683e0d0a7573696e67206e616d657370616365207374643b0d0a0d0a696e74206d61696e2829207b0d0a20202020636f75743c3c22657274657474223b0d0a2020202072657475726e20303b0d0a7d0d0a', 'cpp', 0, 0, '[{"passed": false, "test_case_id": 46, "actual_output": "ertett", "error_message": "", "marks_awarded": 0, "execution_time_ms": 214.1437000000151}]', '{"cases": [{"id": 46, "index": 1, "input": "saf", "label": "Test Case 1", "actual": "ertett", "hidden": false, "passed": false, "status": "wrong_answer", "stderr": "", "stdout": "ertett", "expected": "asfe", "is_hidden": false, "max_marks": "5", "runtimeMs": 214.14, "actual_output": "ertett", "error_message": "", "marks_awarded": 0, "expected_output": "asfe", "execution_time_ms": 214.14}], "status": "wrong_answer", "summary": "0 / 1 cases passed", "exitCode": 0, "rawMarks": 0, "attemptId": "cb701205-7380-4a84-a303-21df3e029bd9", "compileError": null, "runtimeError": null, "submissionId": 48, "overallStatus": "Wrong Answer", "normalizedMarks": 0}', '2026-10-26 11:40:07.761+00', '2026-10-26 11:40:09.902552+00');
INSERT INTO public.submission_attempts VALUES ('c8e38ea7-b78f-49cf-9f28-335cc613a8b6', 1330, 20, '\x23696e636c756465203c696f73747265616d3e0d0a7573696e67206e616d657370616365207374643b0d0a0d0a696e74206d61696e2829207b0d0a20202020696e74206e3b0d0a2020202063696e3e3e6e3b0d0a20202020636f75743c3c6e3b0d0a2020202072657475726e20303b0d0a7d', 'cpp', 10, 15, '[{"passed": true, "test_case_id": 47, "actual_output": "0", "error_message": "", "marks_awarded": 5, "execution_time_ms": 223.82279999996535}, {"passed": true, "test_case_id": 48, "actual_output": "4", "error_message": "", "marks_awarded": 5, "execution_time_ms": 210.36679999995977}, {"passed": true, "test_case_id": 49, "actual_output": "3", "error_message": "", "marks_awarded": 5, "execution_time_ms": 221.3571000000229}]', '{"cases": [{"id": 47, "index": 1, "input": "0\n0", "label": "Test Case 1", "actual": "0", "hidden": false, "passed": true, "status": "passed", "stderr": "", "stdout": "0", "expected": "0", "is_hidden": false, "max_marks": "5", "runtimeMs": 223.82, "actual_output": "0", "error_message": "", "marks_awarded": 5, "expected_output": "0", "execution_time_ms": 223.82}, {"id": 48, "index": 2, "input": "4\n12 13 14 15", "label": "Test Case 2", "actual": "4", "hidden": false, "passed": true, "status": "passed", "stderr": "", "stdout": "4", "expected": "4", "is_hidden": false, "max_marks": "5", "runtimeMs": 210.37, "actual_output": "4", "error_message": "", "marks_awarded": 5, "expected_output": "4", "execution_time_ms": 210.37}, {"id": 49, "index": 3, "input": "3\n1 3 5", "label": "Test Case 3", "actual": "3", "hidden": false, "passed": true, "status": "passed", "stderr": "", "stdout": "3", "expected": "3", "is_hidden": false, "max_marks": "5", "runtimeMs": 221.36, "actual_output": "3", "error_message": "", "marks_awarded": 5, "expected_output": "3", "execution_time_ms": 221.36}], "status": "accepted", "summary": "All test cases passed", "exitCode": 0, "rawMarks": 15, "attemptId": "c8e38ea7-b78f-49cf-9f28-335cc613a8b6", "compileError": null, "runtimeError": null, "submissionId": 70, "overallStatus": "Accepted", "normalizedMarks": 10}', '2026-10-26 11:40:32.484+00', '2026-10-26 11:40:34.155086+00');
INSERT INTO public.submission_attempts VALUES ('4fca9a3d-f574-432b-9790-1c4f70965aa8', 1330, 10, '\x23696e636c756465203c696f73747265616d3e0d0a7573696e67206e616d657370616365207374643b0d0a0d0a696e74206d61696e2829207b0d0a202020636f75743c3c6172723b0d0a2020202072657475726e20303b0d0a7d', 'cpp', 0, 0, '[]', '{"cases": [], "status": "compile_error", "summary": "Compile Error", "exitCode": 1, "rawMarks": 0, "attemptId": "4fca9a3d-f574-432b-9790-1c4f70965aa8", "compileError": "solution.cpp: In function ''int main()'':\nsolution.cpp:5:10: error: ''arr'' was not declared in this scope\n    5 |    cout<<arr;\n      |          ^~~\n", "runtimeError": null, "submissionId": 71, "overallStatus": "Compile Error", "normalizedMarks": 0}', '2026-10-29 13:09:42.487+00', '2026-10-29 13:09:43.446873+00');
INSERT INTO public.submission_attempts VALUES ('44aa078d-6245-486c-8ee2-2a2819704ac7', 1330, 10, '\x23696e636c756465203c696f73747265616d3e0d0a7573696e67206e616d657370616365207374643b0d0a0d0a696e74206d61696e2829207b0d0a202020636f75743c3c22617272223b0d0a2020202072657475726e20303b0d0a7d', 'cpp', 0, 0, '[{"passed": false, "test_case_id": 33, "actual_output": "arr", "error_message": "", "marks_awarded": 0, "execution_time_ms": 223.11989999999787}, {"passed": false, "test_case_id": 34, "actual_output": "arr", "error_message": "", "marks_awarded": 0, "execution_time_ms": 195.81890000000567}, {"passed": false, "test_case_id": 35, "actual_output": "arr", "error_message": "", "marks_awarded": 0, "execution_time_ms": 195.64600000000064}, {"passed": false, "test_case_id": 36, "actual_output": "arr", "error_message": "", "marks_awarded": 0, "execution_time_ms": 234.170100000003}, {"passed": false, "test_case_id": 37, "actual_output": "arr", "error_message": "", "marks_awarded": 0, "execution_time_ms": 195.54539999999542}]', '{"cases": [{"id": 33, "index": 1, "input": "6\n2 3 4 5 6 6", "label": "Sample 1", "actual": "arr", "hidden": false, "passed": false, "status": "wrong_answer", "stderr": "", "stdout": "arr", "expected": "6 6 5 4 3 2 ", "is_hidden": false, "max_marks": "2", "runtimeMs": 223.12, "actual_output": "arr", "error_message": "", "marks_awarded": 0, "expected_output": "6 6 5 4 3 2 ", "execution_time_ms": 223.12}, {"id": 34, "index": 2, "input": "5\n1 2 3 4 5", "label": "Sample 2", "actual": "arr", "hidden": false, "passed": false, "status": "wrong_answer", "stderr": "", "stdout": "arr", "expected": "5 4 3 2 1 ", "is_hidden": false, "max_marks": "2", "runtimeMs": 195.82, "actual_output": "arr", "error_message": "", "marks_awarded": 0, "expected_output": "5 4 3 2 1 ", "execution_time_ms": 195.82}, {"id": 35, "index": 3, "label": "Hidden 1 (Single element)", "hidden": true, "passed": false, "status": "wrong_answer", "is_hidden": true, "max_marks": "2", "runtimeMs": 195.65, "marks_awarded": 0, "execution_time_ms": 195.65}, {"id": 36, "index": 4, "label": "Hidden 2", "hidden": true, "passed": false, "status": "wrong_answer", "is_hidden": true, "max_marks": "2", "runtimeMs": 234.17, "marks_awarded": 0, "execution_time_ms": 234.17}, {"id": 37, "index": 5, "label": "Hidden 3", "hidden": true, "passed": false, "status": "wrong_answer", "is_hidden": true, "max_marks": "2", "runtimeMs": 195.55, "marks_awarded": 0, "execution_time_ms": 195.55}], "status": "wrong_answer", "summary": "0 / 5 cases passed", "exitCode": 0, "rawMarks": 0, "attemptId": "44aa078d-6245-486c-8ee2-2a2819704ac7", "compileError": null, "runtimeError": null, "submissionId": 71, "overallStatus": "Wrong Answer", "normalizedMarks": 0}', '2026-10-29 13:09:51.598+00', '2026-10-29 13:09:53.642706+00');


--
-- Data for Name: submission_resets; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.submission_resets VALUES (1329, 19, '2026-10-20 05:42:14.219+00');
INSERT INTO public.submission_resets VALUES (1337, 10, '2026-10-20 05:42:46.218+00');
INSERT INTO public.submission_resets VALUES (1335, 10, '2026-10-20 05:43:06.332+00');
INSERT INTO public.submission_resets VALUES (1330, 10, '2026-10-20 05:44:40.77+00');


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.users VALUES (1310, '26ce007', '', '26ce007', '26ce007@charusat.edu.in', '$2b$10$bePgyLsILFEx4Bvgi6nZKOUR9n9MFnTbj3ITP5ZWhF21NDzZsGRXm', 'student', 'active', '{"division": "CE1", "semester": "1", "department": "CE", "roll_number": "26ce007"}', '86029ea4-df40-4f4b-abcb-8289f87b0615', '2026-09-30 05:27:08.589+00');
INSERT INTO public.users VALUES (1380, 'DEE', 'DEE', 'DEE DEE', 'dee@charusat.ac.in', '$2b$10$vXduNATMLU.xYzR2Tl.mCesWAr7RPOAkfvXarA9GCYAbU14IRRFsS', 'faculty', 'active', '{"facultyId": "11", "department": "CE", "designation": ""}', 'e0d12fc5-e866-463b-a500-dcadf1fa97b8', '2026-11-01 12:40:46.716946+00');
INSERT INTO public.users VALUES (1311, '26ce008', '', '26ce008', '26ce008@charusat.edu.in', '$2b$10$bePgyLsILFEx4Bvgi6nZKOUR9n9MFnTbj3ITP5ZWhF21NDzZsGRXm', 'student', 'active', '{"division": "CE1", "semester": "1", "department": "CE", "roll_number": "26ce008"}', '86029ea4-df40-4f4b-abcb-8289f87b0615', '2026-09-30 05:27:08.908+00');
INSERT INTO public.users VALUES (1312, '26ce009', '', '26ce009', '26ce009@charusat.edu.in', '$2b$10$bePgyLsILFEx4Bvgi6nZKOUR9n9MFnTbj3ITP5ZWhF21NDzZsGRXm', 'student', 'active', '{"division": "CE1", "semester": "1", "department": "CE", "roll_number": "26ce009"}', '86029ea4-df40-4f4b-abcb-8289f87b0615', '2026-09-30 05:27:09.146+00');
INSERT INTO public.users VALUES (1313, '26ce010', '', '26ce010', '26ce010@charusat.edu.in', '$2b$10$bePgyLsILFEx4Bvgi6nZKOUR9n9MFnTbj3ITP5ZWhF21NDzZsGRXm', 'student', 'active', '{"division": "CE1", "semester": "1", "department": "CE", "roll_number": "26ce010"}', '86029ea4-df40-4f4b-abcb-8289f87b0615', '2026-09-30 05:27:09.388+00');
INSERT INTO public.users VALUES (1314, '26ce011', '', '26ce011', '26ce011@charusat.edu.in', '$2b$10$bePgyLsILFEx4Bvgi6nZKOUR9n9MFnTbj3ITP5ZWhF21NDzZsGRXm', 'student', 'active', '{"division": "CE1", "semester": "1", "department": "CE", "roll_number": "26ce011"}', '86029ea4-df40-4f4b-abcb-8289f87b0615', '2026-09-30 05:27:09.76+00');
INSERT INTO public.users VALUES (1336, '25ce008', '', '25ce008', '25ce008@charusat.edu.in', '$2b$10$bePgyLsILFEx4Bvgi6nZKOUR9n9MFnTbj3ITP5ZWhF21NDzZsGRXm', 'student', 'active', '{"division": "CE1", "semester": "3", "department": "CE", "roll_number": "25ce008"}', '0884229c-30f3-4160-9156-bf42a53d7bdc', '2026-09-30 05:27:14.726+00');
INSERT INTO public.users VALUES (1315, '26ce012', '', '26ce012', '26ce012@charusat.edu.in', '$2b$10$bePgyLsILFEx4Bvgi6nZKOUR9n9MFnTbj3ITP5ZWhF21NDzZsGRXm', 'student', 'active', '{"division": "CE1", "semester": "1", "department": "CE", "roll_number": "26ce012"}', '86029ea4-df40-4f4b-abcb-8289f87b0615', '2026-09-30 05:27:09.982+00');
INSERT INTO public.users VALUES (1316, '26ce013', '', '26ce013', '26ce013@charusat.edu.in', '$2b$10$bePgyLsILFEx4Bvgi6nZKOUR9n9MFnTbj3ITP5ZWhF21NDzZsGRXm', 'student', 'active', '{"division": "CE1", "semester": "1", "department": "CE", "roll_number": "26ce013"}', '86029ea4-df40-4f4b-abcb-8289f87b0615', '2026-09-30 05:27:10.21+00');
INSERT INTO public.users VALUES (1317, '26ce014', '', '26ce014', '26ce014@charusat.edu.in', '$2b$10$bePgyLsILFEx4Bvgi6nZKOUR9n9MFnTbj3ITP5ZWhF21NDzZsGRXm', 'student', 'active', '{"division": "CE1", "semester": "1", "department": "CE", "roll_number": "26ce014"}', '86029ea4-df40-4f4b-abcb-8289f87b0615', '2026-09-30 05:27:10.433+00');
INSERT INTO public.users VALUES (1327, '26ce024', '', '26ce024', '26ce024@charusat.edu.in', '$2b$10$bePgyLsILFEx4Bvgi6nZKOUR9n9MFnTbj3ITP5ZWhF21NDzZsGRXm', 'student', 'active', '{"division": "CE1", "semester": "1", "department": "CE", "roll_number": "26ce024"}', '86029ea4-df40-4f4b-abcb-8289f87b0615', '2026-09-30 05:27:12.7+00');
INSERT INTO public.users VALUES (1329, 'abs', 'xyz', 'abs xyz', '25ce001@charusat.edu.in', '$2b$10$OwYF773f45JxXUdrSGbV1OlUHBUsvZEJ9AeQPfHx8HHoirMhPCk5e', 'student', 'inactive', '{"division": "CE1", "semester": "3", "department": "CE", "roll_number": "25ce001"}', 'ea83e7a91e8091704ec3242f55e9846a', '2026-09-30 05:27:13.169+00');
INSERT INTO public.users VALUES (1283, 'MANTHAN', 'RAITHATHA', 'MANTHAN RAITHATHA', 'hardipatel@charusat.ac.in', '$2b$10$bePgyLsILFEx4Bvgi6nZKOUR9n9MFnTbj3ITP5ZWhF21NDzZsGRXm', 'faculty', 'active', '{"facultyId": "04", "department": "CE", "designation": "head"}', '82067fdc-425d-46e2-a6f0-47dad27e2fc7', '2026-08-07 14:29:19.133+00');
INSERT INTO public.users VALUES (1361, '24ce008', '', '24ce008', '24ce008@charusat.edu.in', '$2b$10$bePgyLsILFEx4Bvgi6nZKOUR9n9MFnTbj3ITP5ZWhF21NDzZsGRXm', 'student', 'active', '{"division": "CE1", "semester": "5", "department": "CE", "roll_number": "24ce008"}', '86029ea4-df40-4f4b-abcb-8289f87b0615', '2026-09-30 05:27:20.431+00');
INSERT INTO public.users VALUES (1260, 'RESHMA', 'MAM', 'RESHMA MAM', 'abc@charusat.ac.in', '$2b$10$bePgyLsILFEx4Bvgi6nZKOUR9n9MFnTbj3ITP5ZWhF21NDzZsGRXm', 'faculty', 'active', '{"facultyId": "10", "department": "CE", "designation": ""}', '82067fdc-425d-46e2-a6f0-47dad27e2fc7', '2026-07-09 12:09:50.634+00');
INSERT INTO public.users VALUES (1265, 'Manthan', 'Raithatha', 'Manthan Raithatha', 'manthan.ce01@charusat.ac.in', '$2b$10$bePgyLsILFEx4Bvgi6nZKOUR9n9MFnTbj3ITP5ZWhF21NDzZsGRXm', 'faculty', 'active', '{"facultyId": "08", "department": "IT", "designation": ""}', '82067fdc-425d-46e2-a6f0-47dad27e2fc7', '2026-07-09 12:20:58.646+00');
INSERT INTO public.users VALUES (1379, NULL, NULL, 'Super Admin', 'admin@example.com', '$2b$10$pKC5Uz7C0OxvxsO9eO/uSuaRG1LRM6EKnuNyHjYy9zLcDoQXQApi6', 'admin', 'active', '{}', '0c8095e3-78b6-427e-9812-37e5f67bae59', '2026-10-20 05:05:11.479+00');
INSERT INTO public.users VALUES (258, 'Hardi', 'Agola ', 'Hardi Agola ', 'hardi.agola@charusat.ac.in', '$2b$10$bePgyLsILFEx4Bvgi6nZKOUR9n9MFnTbj3ITP5ZWhF21NDzZsGRXm', 'faculty', 'active', '{"facultyId": "12", "department": "CE", "designation": "Professor"}', '93abe181-18fe-4dca-9823-9df32878c386', '2026-04-16 17:28:14.877+00');
INSERT INTO public.users VALUES (1, 'Admin', '', 'Admin', 'manthanraithatha01@gmail.com', '$2b$10$LjV7nsUuvAQagApbS08DHOMz363c5JErkC0OvvkOuxTJEWoD6L1ke', 'admin', 'active', '{}', '899e291e-1df6-45bf-83bc-a337fa8dcdb8', '2026-04-16 08:23:28.702+00');
INSERT INTO public.users VALUES (257, 'Mam', '', 'Mam', 'abc@gmail.com', '$2b$10$TeI9HvM.6yVoiQ3QsvzOYewIkGv2WjyFxDCmYvCzB4jVcflJhj6k2', 'faculty', 'inactive', '{"department": "ce", "designation": "professor"}', '82067fdc-425d-46e2-a6f0-47dad27e2fc7', '2026-04-16 17:04:16.138+00');
INSERT INTO public.users VALUES (659, 'Dhriti', 'Patel', 'Dhriti Patel', '25ce074@charusat.ac.in', '$2b$10$bePgyLsILFEx4Bvgi6nZKOUR9n9MFnTbj3ITP5ZWhF21NDzZsGRXm', 'faculty', 'active', '{"facultyId": "11", "department": "AIML", "designation": ""}', '82067fdc-425d-46e2-a6f0-47dad27e2fc7', '2026-06-09 09:38:31.255+00');
INSERT INTO public.users VALUES (1318, '26ce015', '', '26ce015', '26ce015@charusat.edu.in', '$2b$10$bePgyLsILFEx4Bvgi6nZKOUR9n9MFnTbj3ITP5ZWhF21NDzZsGRXm', 'student', 'active', '{"division": "CE1", "semester": "1", "department": "CE", "roll_number": "26ce015"}', '86029ea4-df40-4f4b-abcb-8289f87b0615', '2026-09-30 05:27:10.663+00');
INSERT INTO public.users VALUES (1319, '26ce016', '', '26ce016', '26ce016@charusat.edu.in', '$2b$10$bePgyLsILFEx4Bvgi6nZKOUR9n9MFnTbj3ITP5ZWhF21NDzZsGRXm', 'student', 'active', '{"division": "CE1", "semester": "1", "department": "CE", "roll_number": "26ce016"}', '86029ea4-df40-4f4b-abcb-8289f87b0615', '2026-09-30 05:27:10.892+00');
INSERT INTO public.users VALUES (1320, '26ce017', '', '26ce017', '26ce017@charusat.edu.in', '$2b$10$bePgyLsILFEx4Bvgi6nZKOUR9n9MFnTbj3ITP5ZWhF21NDzZsGRXm', 'student', 'active', '{"division": "CE1", "semester": "1", "department": "CE", "roll_number": "26ce017"}', '86029ea4-df40-4f4b-abcb-8289f87b0615', '2026-09-30 05:27:11.114+00');
INSERT INTO public.users VALUES (1321, '26ce018', '', '26ce018', '26ce018@charusat.edu.in', '$2b$10$bePgyLsILFEx4Bvgi6nZKOUR9n9MFnTbj3ITP5ZWhF21NDzZsGRXm', 'student', 'active', '{"division": "CE1", "semester": "1", "department": "CE", "roll_number": "26ce018"}', '86029ea4-df40-4f4b-abcb-8289f87b0615', '2026-09-30 05:27:11.353+00');
INSERT INTO public.users VALUES (1322, '26ce019', '', '26ce019', '26ce019@charusat.edu.in', '$2b$10$bePgyLsILFEx4Bvgi6nZKOUR9n9MFnTbj3ITP5ZWhF21NDzZsGRXm', 'student', 'active', '{"division": "CE1", "semester": "1", "department": "CE", "roll_number": "26ce019"}', '86029ea4-df40-4f4b-abcb-8289f87b0615', '2026-09-30 05:27:11.58+00');
INSERT INTO public.users VALUES (1323, '26ce020', '', '26ce020', '26ce020@charusat.edu.in', '$2b$10$bePgyLsILFEx4Bvgi6nZKOUR9n9MFnTbj3ITP5ZWhF21NDzZsGRXm', 'student', 'active', '{"division": "CE1", "semester": "1", "department": "CE", "roll_number": "26ce020"}', '86029ea4-df40-4f4b-abcb-8289f87b0615', '2026-09-30 05:27:11.802+00');
INSERT INTO public.users VALUES (1324, '26ce021', '', '26ce021', '26ce021@charusat.edu.in', '$2b$10$bePgyLsILFEx4Bvgi6nZKOUR9n9MFnTbj3ITP5ZWhF21NDzZsGRXm', 'student', 'active', '{"division": "CE1", "semester": "1", "department": "CE", "roll_number": "26ce021"}', '86029ea4-df40-4f4b-abcb-8289f87b0615', '2026-09-30 05:27:12.019+00');
INSERT INTO public.users VALUES (1325, '26ce022', '', '26ce022', '26ce022@charusat.edu.in', '$2b$10$bePgyLsILFEx4Bvgi6nZKOUR9n9MFnTbj3ITP5ZWhF21NDzZsGRXm', 'student', 'active', '{"division": "CE1", "semester": "1", "department": "CE", "roll_number": "26ce022"}', '86029ea4-df40-4f4b-abcb-8289f87b0615', '2026-09-30 05:27:12.246+00');
INSERT INTO public.users VALUES (1326, '26ce023', '', '26ce023', '26ce023@charusat.edu.in', '$2b$10$bePgyLsILFEx4Bvgi6nZKOUR9n9MFnTbj3ITP5ZWhF21NDzZsGRXm', 'student', 'active', '{"division": "CE1", "semester": "1", "department": "CE", "roll_number": "26ce023"}', '86029ea4-df40-4f4b-abcb-8289f87b0615', '2026-09-30 05:27:12.472+00');
INSERT INTO public.users VALUES (1305, '26ce002', '', '26ce002', '26ce002@charusat.edu.in', '$2b$10$bePgyLsILFEx4Bvgi6nZKOUR9n9MFnTbj3ITP5ZWhF21NDzZsGRXm', 'student', 'active', '{"division": "CE1", "semester": "1", "department": "CE", "roll_number": "26ce002"}', '86029ea4-df40-4f4b-abcb-8289f87b0615', '2026-09-30 05:27:07.28+00');
INSERT INTO public.users VALUES (1331, '25ce003', '', '25ce003', '25ce003@charusat.edu.in', '$2b$10$bePgyLsILFEx4Bvgi6nZKOUR9n9MFnTbj3ITP5ZWhF21NDzZsGRXm', 'student', 'active', '{"division": "CE1", "semester": "3", "department": "CE", "roll_number": "25ce003"}', '86029ea4-df40-4f4b-abcb-8289f87b0615', '2026-09-30 05:27:13.607+00');
INSERT INTO public.users VALUES (1332, '25ce004', '', '25ce004', '25ce004@charusat.edu.in', '$2b$10$bePgyLsILFEx4Bvgi6nZKOUR9n9MFnTbj3ITP5ZWhF21NDzZsGRXm', 'student', 'active', '{"division": "CE1", "semester": "3", "department": "CE", "roll_number": "25ce004"}', '86029ea4-df40-4f4b-abcb-8289f87b0615', '2026-09-30 05:27:13.828+00');
INSERT INTO public.users VALUES (1334, '25ce006', '', '25ce006', '25ce006@charusat.edu.in', '$2b$10$bePgyLsILFEx4Bvgi6nZKOUR9n9MFnTbj3ITP5ZWhF21NDzZsGRXm', 'student', 'active', '{"division": "CE1", "semester": "3", "department": "CE", "roll_number": "25ce006"}', '86029ea4-df40-4f4b-abcb-8289f87b0615', '2026-09-30 05:27:14.266+00');
INSERT INTO public.users VALUES (1340, '25ce012', '', '25ce012', '25ce012@charusat.edu.in', '$2b$10$bePgyLsILFEx4Bvgi6nZKOUR9n9MFnTbj3ITP5ZWhF21NDzZsGRXm', 'student', 'active', '{"division": "CE1", "semester": "3", "department": "CE", "roll_number": "25ce012"}', '86029ea4-df40-4f4b-abcb-8289f87b0615', '2026-09-30 05:27:15.63+00');
INSERT INTO public.users VALUES (1341, '25ce013', '', '25ce013', '25ce013@charusat.edu.in', '$2b$10$bePgyLsILFEx4Bvgi6nZKOUR9n9MFnTbj3ITP5ZWhF21NDzZsGRXm', 'student', 'active', '{"division": "CE1", "semester": "3", "department": "CE", "roll_number": "25ce013"}', '86029ea4-df40-4f4b-abcb-8289f87b0615', '2026-09-30 05:27:15.854+00');
INSERT INTO public.users VALUES (1342, '25ce014', '', '25ce014', '25ce014@charusat.edu.in', '$2b$10$bePgyLsILFEx4Bvgi6nZKOUR9n9MFnTbj3ITP5ZWhF21NDzZsGRXm', 'student', 'active', '{"division": "CE1", "semester": "3", "department": "CE", "roll_number": "25ce014"}', '86029ea4-df40-4f4b-abcb-8289f87b0615', '2026-09-30 05:27:16.077+00');
INSERT INTO public.users VALUES (1343, '25ce015', '', '25ce015', '25ce015@charusat.edu.in', '$2b$10$bePgyLsILFEx4Bvgi6nZKOUR9n9MFnTbj3ITP5ZWhF21NDzZsGRXm', 'student', 'active', '{"division": "CE1", "semester": "3", "department": "CE", "roll_number": "25ce015"}', '86029ea4-df40-4f4b-abcb-8289f87b0615', '2026-09-30 05:27:16.299+00');
INSERT INTO public.users VALUES (1344, '25ce016', '', '25ce016', '25ce016@charusat.edu.in', '$2b$10$bePgyLsILFEx4Bvgi6nZKOUR9n9MFnTbj3ITP5ZWhF21NDzZsGRXm', 'student', 'active', '{"division": "CE1", "semester": "3", "department": "CE", "roll_number": "25ce016"}', '86029ea4-df40-4f4b-abcb-8289f87b0615', '2026-09-30 05:27:16.515+00');
INSERT INTO public.users VALUES (1345, '25ce017', '', '25ce017', '25ce017@charusat.edu.in', '$2b$10$bePgyLsILFEx4Bvgi6nZKOUR9n9MFnTbj3ITP5ZWhF21NDzZsGRXm', 'student', 'active', '{"division": "CE1", "semester": "3", "department": "CE", "roll_number": "25ce017"}', '86029ea4-df40-4f4b-abcb-8289f87b0615', '2026-09-30 05:27:16.741+00');
INSERT INTO public.users VALUES (1346, '25ce018', '', '25ce018', '25ce018@charusat.edu.in', '$2b$10$bePgyLsILFEx4Bvgi6nZKOUR9n9MFnTbj3ITP5ZWhF21NDzZsGRXm', 'student', 'active', '{"division": "CE1", "semester": "3", "department": "CE", "roll_number": "25ce018"}', '86029ea4-df40-4f4b-abcb-8289f87b0615', '2026-09-30 05:27:16.96+00');
INSERT INTO public.users VALUES (1347, '25ce019', '', '25ce019', '25ce019@charusat.edu.in', '$2b$10$bePgyLsILFEx4Bvgi6nZKOUR9n9MFnTbj3ITP5ZWhF21NDzZsGRXm', 'student', 'active', '{"division": "CE1", "semester": "3", "department": "CE", "roll_number": "25ce019"}', '86029ea4-df40-4f4b-abcb-8289f87b0615', '2026-09-30 05:27:17.192+00');
INSERT INTO public.users VALUES (1348, '25ce020', '', '25ce020', '25ce020@charusat.edu.in', '$2b$10$bePgyLsILFEx4Bvgi6nZKOUR9n9MFnTbj3ITP5ZWhF21NDzZsGRXm', 'student', 'active', '{"division": "CE1", "semester": "3", "department": "CE", "roll_number": "25ce020"}', '86029ea4-df40-4f4b-abcb-8289f87b0615', '2026-09-30 05:27:17.46+00');
INSERT INTO public.users VALUES (1349, '25ce021', '', '25ce021', '25ce021@charusat.edu.in', '$2b$10$bePgyLsILFEx4Bvgi6nZKOUR9n9MFnTbj3ITP5ZWhF21NDzZsGRXm', 'student', 'active', '{"division": "CE1", "semester": "3", "department": "CE", "roll_number": "25ce021"}', '86029ea4-df40-4f4b-abcb-8289f87b0615', '2026-09-30 05:27:17.692+00');
INSERT INTO public.users VALUES (1350, '25ce022', '', '25ce022', '25ce022@charusat.edu.in', '$2b$10$bePgyLsILFEx4Bvgi6nZKOUR9n9MFnTbj3ITP5ZWhF21NDzZsGRXm', 'student', 'active', '{"division": "CE1", "semester": "3", "department": "CE", "roll_number": "25ce022"}', '86029ea4-df40-4f4b-abcb-8289f87b0615', '2026-09-30 05:27:17.94+00');
INSERT INTO public.users VALUES (1351, '25ce023', '', '25ce023', '25ce023@charusat.edu.in', '$2b$10$bePgyLsILFEx4Bvgi6nZKOUR9n9MFnTbj3ITP5ZWhF21NDzZsGRXm', 'student', 'active', '{"division": "CE1", "semester": "3", "department": "CE", "roll_number": "25ce023"}', '86029ea4-df40-4f4b-abcb-8289f87b0615', '2026-09-30 05:27:18.164+00');
INSERT INTO public.users VALUES (1352, '25ce024', '', '25ce024', '25ce024@charusat.edu.in', '$2b$10$bePgyLsILFEx4Bvgi6nZKOUR9n9MFnTbj3ITP5ZWhF21NDzZsGRXm', 'student', 'active', '{"division": "CE1", "semester": "3", "department": "CE", "roll_number": "25ce024"}', '86029ea4-df40-4f4b-abcb-8289f87b0615', '2026-09-30 05:27:18.43+00');
INSERT INTO public.users VALUES (1355, '24ce002', '', '24ce002', '24ce002@charusat.edu.in', '$2b$10$bePgyLsILFEx4Bvgi6nZKOUR9n9MFnTbj3ITP5ZWhF21NDzZsGRXm', 'student', 'active', '{"division": "CE1", "semester": "5", "department": "CE", "roll_number": "24ce002"}', '86029ea4-df40-4f4b-abcb-8289f87b0615', '2026-09-30 05:27:19.096+00');
INSERT INTO public.users VALUES (1356, '24ce003', '', '24ce003', '24ce003@charusat.edu.in', '$2b$10$bePgyLsILFEx4Bvgi6nZKOUR9n9MFnTbj3ITP5ZWhF21NDzZsGRXm', 'student', 'active', '{"division": "CE1", "semester": "5", "department": "CE", "roll_number": "24ce003"}', '86029ea4-df40-4f4b-abcb-8289f87b0615', '2026-09-30 05:27:19.328+00');
INSERT INTO public.users VALUES (1357, '24ce004', '', '24ce004', '24ce004@charusat.edu.in', '$2b$10$bePgyLsILFEx4Bvgi6nZKOUR9n9MFnTbj3ITP5ZWhF21NDzZsGRXm', 'student', 'active', '{"division": "CE1", "semester": "5", "department": "CE", "roll_number": "24ce004"}', '86029ea4-df40-4f4b-abcb-8289f87b0615', '2026-09-30 05:27:19.553+00');
INSERT INTO public.users VALUES (1335, '25ce007', '', '25ce007', '25ce007@charusat.edu.in', '$2b$10$bePgyLsILFEx4Bvgi6nZKOUR9n9MFnTbj3ITP5ZWhF21NDzZsGRXm', 'student', 'active', '{"division": "CE1", "semester": "3", "department": "CE", "roll_number": "25ce007"}', '86029ea4-df40-4f4b-abcb-8289f87b0615', '2026-09-30 05:27:14.492+00');
INSERT INTO public.users VALUES (1338, '25ce010', '', '25ce010', '25ce010@charusat.edu.in', '$2b$10$bePgyLsILFEx4Bvgi6nZKOUR9n9MFnTbj3ITP5ZWhF21NDzZsGRXm', 'student', 'active', '{"division": "CE1", "semester": "3", "department": "CE", "roll_number": "25ce010"}', '86029ea4-df40-4f4b-abcb-8289f87b0615', '2026-09-30 05:27:15.178+00');
INSERT INTO public.users VALUES (1354, '24ce001', '', '24ce001', '24ce001@charusat.edu.in', '$2b$10$bePgyLsILFEx4Bvgi6nZKOUR9n9MFnTbj3ITP5ZWhF21NDzZsGRXm', 'student', 'active', '{"division": "CE1", "semester": "5", "department": "CE", "roll_number": "24ce001"}', '86029ea4-df40-4f4b-abcb-8289f87b0615', '2026-09-30 05:27:18.876+00');
INSERT INTO public.users VALUES (1353, '25ce025', '', '25ce025', '25ce025@charusat.edu.in', '$2b$10$bePgyLsILFEx4Bvgi6nZKOUR9n9MFnTbj3ITP5ZWhF21NDzZsGRXm', 'student', 'active', '{"division": "CE1", "semester": "3", "department": "CE", "roll_number": "25ce025"}', '86029ea4-df40-4f4b-abcb-8289f87b0615', '2026-09-30 05:27:18.65+00');
INSERT INTO public.users VALUES (1339, '25ce011', '', '25ce011', '25ce011@charusat.edu.in', '$2b$10$bePgyLsILFEx4Bvgi6nZKOUR9n9MFnTbj3ITP5ZWhF21NDzZsGRXm', 'student', 'active', '{"division": "CE1", "semester": "3", "department": "CE", "roll_number": "25ce011"}', '86029ea4-df40-4f4b-abcb-8289f87b0615', '2026-09-30 05:27:15.408+00');
INSERT INTO public.users VALUES (1337, '25ce009', '', '25ce009', '25ce009@charusat.edu.in', '$2b$10$bePgyLsILFEx4Bvgi6nZKOUR9n9MFnTbj3ITP5ZWhF21NDzZsGRXm', 'student', 'active', '{"division": "CE1", "semester": "3", "department": "CE", "roll_number": "25ce009"}', '2fe4e089-fb1e-412a-a505-d3fc34a085f3', '2026-09-30 05:27:14.958+00');
INSERT INTO public.users VALUES (1330, '25ce002', '', '25ce002', '25ce002@charusat.edu.in', '$2b$10$bePgyLsILFEx4Bvgi6nZKOUR9n9MFnTbj3ITP5ZWhF21NDzZsGRXm', 'student', 'active', '{"division": "CE1", "semester": "3", "department": "CE", "roll_number": "25ce002"}', 'f9784b99-1ddf-4007-a1ea-2b0f45286a80', '2026-09-30 05:27:13.386+00');
INSERT INTO public.users VALUES (1308, '26ce005', '', '26ce005', '26ce005@charusat.edu.in', '$2b$10$bePgyLsILFEx4Bvgi6nZKOUR9n9MFnTbj3ITP5ZWhF21NDzZsGRXm', 'student', 'active', '{"division": "CE1", "semester": "1", "department": "CE", "roll_number": "26ce005"}', '86029ea4-df40-4f4b-abcb-8289f87b0615', '2026-09-30 05:27:08.105+00');
INSERT INTO public.users VALUES (1309, '26ce006', '', '26ce006', '26ce006@charusat.edu.in', '$2b$10$bePgyLsILFEx4Bvgi6nZKOUR9n9MFnTbj3ITP5ZWhF21NDzZsGRXm', 'student', 'active', '{"division": "CE1", "semester": "1", "department": "CE", "roll_number": "26ce006"}', '86029ea4-df40-4f4b-abcb-8289f87b0615', '2026-09-30 05:27:08.333+00');
INSERT INTO public.users VALUES (1333, '25ce005', '', '25ce005', '25ce005@charusat.edu.in', '$2b$10$bePgyLsILFEx4Bvgi6nZKOUR9n9MFnTbj3ITP5ZWhF21NDzZsGRXm', 'student', 'active', '{"division": "CE1", "semester": "3", "department": "CE", "roll_number": "25ce005"}', '86029ea4-df40-4f4b-abcb-8289f87b0615', '2026-09-30 05:27:14.05+00');
INSERT INTO public.users VALUES (1358, '24ce005', '', '24ce005', '24ce005@charusat.edu.in', '$2b$10$bePgyLsILFEx4Bvgi6nZKOUR9n9MFnTbj3ITP5ZWhF21NDzZsGRXm', 'student', 'active', '{"division": "CE1", "semester": "5", "department": "CE", "roll_number": "24ce005"}', '86029ea4-df40-4f4b-abcb-8289f87b0615', '2026-09-30 05:27:19.768+00');
INSERT INTO public.users VALUES (1359, '24ce006', '', '24ce006', '24ce006@charusat.edu.in', '$2b$10$bePgyLsILFEx4Bvgi6nZKOUR9n9MFnTbj3ITP5ZWhF21NDzZsGRXm', 'student', 'active', '{"division": "CE1", "semester": "5", "department": "CE", "roll_number": "24ce006"}', '86029ea4-df40-4f4b-abcb-8289f87b0615', '2026-09-30 05:27:19.987+00');
INSERT INTO public.users VALUES (1360, '24ce007', '', '24ce007', '24ce007@charusat.edu.in', '$2b$10$bePgyLsILFEx4Bvgi6nZKOUR9n9MFnTbj3ITP5ZWhF21NDzZsGRXm', 'student', 'active', '{"division": "CE1", "semester": "5", "department": "CE", "roll_number": "24ce007"}', '86029ea4-df40-4f4b-abcb-8289f87b0615', '2026-09-30 05:27:20.2+00');
INSERT INTO public.users VALUES (1362, '24ce009', '', '24ce009', '24ce009@charusat.edu.in', '$2b$10$bePgyLsILFEx4Bvgi6nZKOUR9n9MFnTbj3ITP5ZWhF21NDzZsGRXm', 'student', 'active', '{"division": "CE1", "semester": "5", "department": "CE", "roll_number": "24ce009"}', '86029ea4-df40-4f4b-abcb-8289f87b0615', '2026-09-30 05:27:20.647+00');
INSERT INTO public.users VALUES (1363, '24ce010', '', '24ce010', '24ce010@charusat.edu.in', '$2b$10$bePgyLsILFEx4Bvgi6nZKOUR9n9MFnTbj3ITP5ZWhF21NDzZsGRXm', 'student', 'active', '{"division": "CE1", "semester": "5", "department": "CE", "roll_number": "24ce010"}', '86029ea4-df40-4f4b-abcb-8289f87b0615', '2026-09-30 05:27:20.89+00');
INSERT INTO public.users VALUES (1364, '24ce011', '', '24ce011', '24ce011@charusat.edu.in', '$2b$10$bePgyLsILFEx4Bvgi6nZKOUR9n9MFnTbj3ITP5ZWhF21NDzZsGRXm', 'student', 'active', '{"division": "CE1", "semester": "5", "department": "CE", "roll_number": "24ce011"}', '86029ea4-df40-4f4b-abcb-8289f87b0615', '2026-09-30 05:27:21.112+00');
INSERT INTO public.users VALUES (1365, '24ce012', '', '24ce012', '24ce012@charusat.edu.in', '$2b$10$bePgyLsILFEx4Bvgi6nZKOUR9n9MFnTbj3ITP5ZWhF21NDzZsGRXm', 'student', 'active', '{"division": "CE1", "semester": "5", "department": "CE", "roll_number": "24ce012"}', '86029ea4-df40-4f4b-abcb-8289f87b0615', '2026-09-30 05:27:21.334+00');
INSERT INTO public.users VALUES (1366, '24ce013', '', '24ce013', '24ce013@charusat.edu.in', '$2b$10$bePgyLsILFEx4Bvgi6nZKOUR9n9MFnTbj3ITP5ZWhF21NDzZsGRXm', 'student', 'active', '{"division": "CE1", "semester": "5", "department": "CE", "roll_number": "24ce013"}', '86029ea4-df40-4f4b-abcb-8289f87b0615', '2026-09-30 05:27:21.548+00');
INSERT INTO public.users VALUES (1367, '24ce014', '', '24ce014', '24ce014@charusat.edu.in', '$2b$10$bePgyLsILFEx4Bvgi6nZKOUR9n9MFnTbj3ITP5ZWhF21NDzZsGRXm', 'student', 'active', '{"division": "CE1", "semester": "5", "department": "CE", "roll_number": "24ce014"}', '86029ea4-df40-4f4b-abcb-8289f87b0615', '2026-09-30 05:27:21.773+00');
INSERT INTO public.users VALUES (1306, '26ce003', '', '26ce003', '26ce003@charusat.edu.in', '$2b$10$bePgyLsILFEx4Bvgi6nZKOUR9n9MFnTbj3ITP5ZWhF21NDzZsGRXm', 'student', 'active', '{"division": "CE1", "semester": "1", "department": "CE", "roll_number": "26ce003"}', '86029ea4-df40-4f4b-abcb-8289f87b0615', '2026-09-30 05:27:07.51+00');
INSERT INTO public.users VALUES (1307, '26ce004', '', '26ce004', '26ce004@charusat.edu.in', '$2b$10$bePgyLsILFEx4Bvgi6nZKOUR9n9MFnTbj3ITP5ZWhF21NDzZsGRXm', 'student', 'active', '{"division": "CE1", "semester": "1", "department": "CE", "roll_number": "26ce004"}', 'd5567a1f-1851-493b-9a9d-c8ccda5018ec', '2026-09-30 05:27:07.88+00');
INSERT INTO public.users VALUES (1374, '24ce021', '', '24ce021', '24ce021@charusat.edu.in', '$2b$10$bePgyLsILFEx4Bvgi6nZKOUR9n9MFnTbj3ITP5ZWhF21NDzZsGRXm', 'student', 'active', '{"division": "CE1", "semester": "5", "department": "CE", "roll_number": "24ce021"}', '86029ea4-df40-4f4b-abcb-8289f87b0615', '2026-09-30 05:27:23.331+00');
INSERT INTO public.users VALUES (1375, '24ce022', '', '24ce022', '24ce022@charusat.edu.in', '$2b$10$bePgyLsILFEx4Bvgi6nZKOUR9n9MFnTbj3ITP5ZWhF21NDzZsGRXm', 'student', 'active', '{"division": "CE1", "semester": "5", "department": "CE", "roll_number": "24ce022"}', '86029ea4-df40-4f4b-abcb-8289f87b0615', '2026-09-30 05:27:23.562+00');
INSERT INTO public.users VALUES (1376, '24ce023', '', '24ce023', '24ce023@charusat.edu.in', '$2b$10$bePgyLsILFEx4Bvgi6nZKOUR9n9MFnTbj3ITP5ZWhF21NDzZsGRXm', 'student', 'active', '{"division": "CE1", "semester": "5", "department": "CE", "roll_number": "24ce023"}', '86029ea4-df40-4f4b-abcb-8289f87b0615', '2026-09-30 05:27:23.775+00');
INSERT INTO public.users VALUES (1377, '24ce024', '', '24ce024', '24ce024@charusat.edu.in', '$2b$10$bePgyLsILFEx4Bvgi6nZKOUR9n9MFnTbj3ITP5ZWhF21NDzZsGRXm', 'student', 'active', '{"division": "CE1", "semester": "5", "department": "CE", "roll_number": "24ce024"}', '86029ea4-df40-4f4b-abcb-8289f87b0615', '2026-09-30 05:27:23.994+00');
INSERT INTO public.users VALUES (1378, '24ce025', '', '24ce025', '24ce025@charusat.edu.in', '$2b$10$bePgyLsILFEx4Bvgi6nZKOUR9n9MFnTbj3ITP5ZWhF21NDzZsGRXm', 'student', 'active', '{"division": "CE1", "semester": "5", "department": "CE", "roll_number": "24ce025"}', '86029ea4-df40-4f4b-abcb-8289f87b0615', '2026-09-30 05:27:24.21+00');
INSERT INTO public.users VALUES (1328, '26ce025', '', '26ce025', '26ce025@charusat.edu.in', '$2b$10$bePgyLsILFEx4Bvgi6nZKOUR9n9MFnTbj3ITP5ZWhF21NDzZsGRXm', 'student', 'active', '{"division": "CE1", "semester": "1", "department": "CE", "roll_number": "26ce025"}', '86029ea4-df40-4f4b-abcb-8289f87b0615', '2026-09-30 05:27:12.923+00');
INSERT INTO public.users VALUES (1304, '26ce001', '', '26ce001', '26ce001@charusat.edu.in', '$2b$10$bePgyLsILFEx4Bvgi6nZKOUR9n9MFnTbj3ITP5ZWhF21NDzZsGRXm', 'student', 'active', '{"division": "CE1", "semester": "1", "department": "CE", "roll_number": "26ce001"}', 'f743e243-8dfb-4893-aa48-5f13ac2677c2', '2026-09-30 05:27:06.557+00');
INSERT INTO public.users VALUES (1295, 'riya', 'patel', 'riya patel', 'reyapatel@charusat.ac.in', '$2b$10$bePgyLsILFEx4Bvgi6nZKOUR9n9MFnTbj3ITP5ZWhF21NDzZsGRXm', 'faculty', 'active', '{"facultyId": "01", "department": "AIML", "designation": "Assistance prof"}', 'aafa894f-8628-4995-9f43-54a157ed1217', '2026-09-17 07:32:13.647+00');
INSERT INTO public.users VALUES (1287, 'Megh', 'Rana', 'Megh Rana', '25ce099@charusat.ac.in', '$2b$10$bePgyLsILFEx4Bvgi6nZKOUR9n9MFnTbj3ITP5ZWhF21NDzZsGRXm', 'faculty', 'active', '{"facultyId": "03", "department": "CSE", "designation": "proff"}', '82067fdc-425d-46e2-a6f0-47dad27e2fc7', '2026-08-11 05:14:33.322+00');
INSERT INTO public.users VALUES (1281, 'Arya ', 'Shah', 'Arya  Shah', '25ce107@charusat.ac.in', '$2b$10$bePgyLsILFEx4Bvgi6nZKOUR9n9MFnTbj3ITP5ZWhF21NDzZsGRXm', 'faculty', 'active', '{"facultyId": "05", "department": "CE", "designation": "proff"}', '82067fdc-425d-46e2-a6f0-47dad27e2fc7', '2026-08-06 08:10:44.448+00');
INSERT INTO public.users VALUES (1274, 'Ishika', 'Ghadeshiya', 'Ishika Ghadeshiya', 'ishika123@charusat.ac.in', '$2b$10$bePgyLsILFEx4Bvgi6nZKOUR9n9MFnTbj3ITP5ZWhF21NDzZsGRXm', 'faculty', 'active', '{"facultyId": "06", "department": "CE", "designation": "proff"}', '82067fdc-425d-46e2-a6f0-47dad27e2fc7', '2026-08-03 12:02:21.797+00');
INSERT INTO public.users VALUES (1267, 'Suhana ', 'Bose', 'Suhana  Bose', 'dfghjk@charusat.ac.in', '$2b$10$bePgyLsILFEx4Bvgi6nZKOUR9n9MFnTbj3ITP5ZWhF21NDzZsGRXm', 'faculty', 'active', '{"facultyId": "07", "department": "CE", "designation": ""}', '82067fdc-425d-46e2-a6f0-47dad27e2fc7', '2026-07-09 12:25:47.993+00');
INSERT INTO public.users VALUES (1261, 'sarita', 'mam', 'sarita mam', 'sdcsf@charusat.ac.in', '$2b$10$bePgyLsILFEx4Bvgi6nZKOUR9n9MFnTbj3ITP5ZWhF21NDzZsGRXm', 'faculty', 'active', '{"facultyId": "09", "department": "CSE", "designation": "Professor"}', '82067fdc-425d-46e2-a6f0-47dad27e2fc7', '2026-07-09 12:10:49.162+00');
INSERT INTO public.users VALUES (1291, 'Hardi', 'Agola', 'Hardi Agola', '25ce001@charusat.ac.in', '$2b$10$bePgyLsILFEx4Bvgi6nZKOUR9n9MFnTbj3ITP5ZWhF21NDzZsGRXm', 'faculty', 'active', '{"facultyId": "02", "department": "CE", "designation": "proff"}', '82067fdc-425d-46e2-a6f0-47dad27e2fc7', '2026-08-23 09:09:31.052+00');
INSERT INTO public.users VALUES (1368, '24ce015', '', '24ce015', '24ce015@charusat.edu.in', '$2b$10$bePgyLsILFEx4Bvgi6nZKOUR9n9MFnTbj3ITP5ZWhF21NDzZsGRXm', 'student', 'active', '{"division": "CE1", "semester": "5", "department": "CE", "roll_number": "24ce015"}', '86029ea4-df40-4f4b-abcb-8289f87b0615', '2026-09-30 05:27:21.992+00');
INSERT INTO public.users VALUES (1369, '24ce016', '', '24ce016', '24ce016@charusat.edu.in', '$2b$10$bePgyLsILFEx4Bvgi6nZKOUR9n9MFnTbj3ITP5ZWhF21NDzZsGRXm', 'student', 'active', '{"division": "CE1", "semester": "5", "department": "CE", "roll_number": "24ce016"}', '86029ea4-df40-4f4b-abcb-8289f87b0615', '2026-09-30 05:27:22.21+00');
INSERT INTO public.users VALUES (1370, '24ce017', '', '24ce017', '24ce017@charusat.edu.in', '$2b$10$bePgyLsILFEx4Bvgi6nZKOUR9n9MFnTbj3ITP5ZWhF21NDzZsGRXm', 'student', 'active', '{"division": "CE1", "semester": "5", "department": "CE", "roll_number": "24ce017"}', '86029ea4-df40-4f4b-abcb-8289f87b0615', '2026-09-30 05:27:22.441+00');
INSERT INTO public.users VALUES (1371, '24ce018', '', '24ce018', '24ce018@charusat.edu.in', '$2b$10$bePgyLsILFEx4Bvgi6nZKOUR9n9MFnTbj3ITP5ZWhF21NDzZsGRXm', 'student', 'active', '{"division": "CE1", "semester": "5", "department": "CE", "roll_number": "24ce018"}', '86029ea4-df40-4f4b-abcb-8289f87b0615', '2026-09-30 05:27:22.664+00');
INSERT INTO public.users VALUES (1372, '24ce019', '', '24ce019', '24ce019@charusat.edu.in', '$2b$10$bePgyLsILFEx4Bvgi6nZKOUR9n9MFnTbj3ITP5ZWhF21NDzZsGRXm', 'student', 'active', '{"division": "CE1", "semester": "5", "department": "CE", "roll_number": "24ce019"}', '86029ea4-df40-4f4b-abcb-8289f87b0615', '2026-09-30 05:27:22.88+00');
INSERT INTO public.users VALUES (1373, '24ce020', '', '24ce020', '24ce020@charusat.edu.in', '$2b$10$bePgyLsILFEx4Bvgi6nZKOUR9n9MFnTbj3ITP5ZWhF21NDzZsGRXm', 'student', 'active', '{"division": "CE1", "semester": "5", "department": "CE", "roll_number": "24ce020"}', '86029ea4-df40-4f4b-abcb-8289f87b0615', '2026-09-30 05:27:23.109+00');


--
-- Name: activity_logs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.activity_logs_id_seq', 860, true);


--
-- Name: courses_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.courses_id_seq', 13, true);


--
-- Name: departments_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.departments_id_seq', 12, true);


--
-- Name: practical_submission_cases_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.practical_submission_cases_id_seq', 143, true);


--
-- Name: practical_submissions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.practical_submissions_id_seq', 72, true);


--
-- Name: practical_test_cases_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.practical_test_cases_id_seq', 49, true);


--
-- Name: practicals_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.practicals_id_seq', 20, true);


--
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.users_id_seq', 1380, true);


--
-- Name: activity_logs activity_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.activity_logs
    ADD CONSTRAINT activity_logs_pkey PRIMARY KEY (id);


--
-- Name: coderank_migrations coderank_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.coderank_migrations
    ADD CONSTRAINT coderank_migrations_pkey PRIMARY KEY (name);


--
-- Name: course_faculty course_faculty_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.course_faculty
    ADD CONSTRAINT course_faculty_pkey PRIMARY KEY (course_id, faculty_id);


--
-- Name: courses courses_course_code_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.courses
    ADD CONSTRAINT courses_course_code_key UNIQUE (course_code);


--
-- Name: courses courses_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.courses
    ADD CONSTRAINT courses_pkey PRIMARY KEY (id);


--
-- Name: departments departments_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT departments_name_key UNIQUE (name);


--
-- Name: departments departments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT departments_pkey PRIMARY KEY (id);


--
-- Name: practical_submission_cases practical_submission_cases_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.practical_submission_cases
    ADD CONSTRAINT practical_submission_cases_pkey PRIMARY KEY (id);


--
-- Name: practical_submissions practical_submissions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.practical_submissions
    ADD CONSTRAINT practical_submissions_pkey PRIMARY KEY (id);


--
-- Name: practical_test_cases practical_test_cases_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.practical_test_cases
    ADD CONSTRAINT practical_test_cases_pkey PRIMARY KEY (id);


--
-- Name: practicals practicals_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.practicals
    ADD CONSTRAINT practicals_pkey PRIMARY KEY (id);


--
-- Name: student_workspaces student_workspaces_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.student_workspaces
    ADD CONSTRAINT student_workspaces_pkey PRIMARY KEY (student_id, practical_id, language);


--
-- Name: submission_attempts submission_attempts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.submission_attempts
    ADD CONSTRAINT submission_attempts_pkey PRIMARY KEY (job_id);


--
-- Name: submission_resets submission_resets_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.submission_resets
    ADD CONSTRAINT submission_resets_pkey PRIMARY KEY (student_id, practical_id);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: idx_activity_logs_retention; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_activity_logs_retention ON public.activity_logs USING btree (created_at, id);


--
-- Name: idx_attempts_student_practical_time; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_attempts_student_practical_time ON public.submission_attempts USING btree (student_id, practical_id, submitted_at DESC);


--
-- Name: idx_cases_practical_order; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_cases_practical_order ON public.practical_test_cases USING btree (practical_id, order_index);


--
-- Name: idx_course_faculty_course; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_course_faculty_course ON public.course_faculty USING btree (course_id);


--
-- Name: idx_course_faculty_faculty; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_course_faculty_faculty ON public.course_faculty USING btree (faculty_id);


--
-- Name: idx_courses_course_code; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_courses_course_code ON public.courses USING btree (course_code);


--
-- Name: idx_courses_semester; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_courses_semester ON public.courses USING btree (semester);


--
-- Name: idx_departments_name; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_departments_name ON public.departments USING btree (name);


--
-- Name: idx_practical_submissions_practical; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_practical_submissions_practical ON public.practical_submissions USING btree (practical_id);


--
-- Name: idx_practical_submissions_student; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_practical_submissions_student ON public.practical_submissions USING btree (student_id);


--
-- Name: idx_practicals_active_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_practicals_active_id ON public.practicals USING btree (id DESC) WHERE (status = 'active'::text);


--
-- Name: idx_practicals_course_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_practicals_course_status ON public.practicals USING btree (course_id, status);


--
-- Name: idx_results_submission; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_results_submission ON public.practical_submission_cases USING btree (submission_id);


--
-- Name: idx_users_active_students_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_users_active_students_id ON public.users USING btree (id) WHERE ((role = 'student'::text) AND (status = 'active'::text));


--
-- Name: idx_users_role; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_users_role ON public.users USING btree (role);


--
-- Name: idx_users_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_users_status ON public.users USING btree (status);


--
-- Name: idx_workspaces_retention; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_workspaces_retention ON public.student_workspaces USING btree (saved_at, student_id, practical_id, language);


--
-- Name: uq_submission_student_practical; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX uq_submission_student_practical ON public.practical_submissions USING btree (student_id, practical_id);


--
-- Name: course_faculty course_faculty_course_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.course_faculty
    ADD CONSTRAINT course_faculty_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id) ON DELETE CASCADE;


--
-- Name: course_faculty course_faculty_faculty_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.course_faculty
    ADD CONSTRAINT course_faculty_faculty_id_fkey FOREIGN KEY (faculty_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: courses courses_assigned_faculty_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.courses
    ADD CONSTRAINT courses_assigned_faculty_fkey FOREIGN KEY (assigned_faculty) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: practical_submission_cases practical_submission_cases_submission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.practical_submission_cases
    ADD CONSTRAINT practical_submission_cases_submission_id_fkey FOREIGN KEY (submission_id) REFERENCES public.practical_submissions(id) ON DELETE CASCADE;


--
-- Name: practical_submission_cases practical_submission_cases_test_case_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.practical_submission_cases
    ADD CONSTRAINT practical_submission_cases_test_case_id_fkey FOREIGN KEY (test_case_id) REFERENCES public.practical_test_cases(id) ON DELETE CASCADE;


--
-- Name: practical_submissions practical_submissions_practical_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.practical_submissions
    ADD CONSTRAINT practical_submissions_practical_id_fkey FOREIGN KEY (practical_id) REFERENCES public.practicals(id) ON DELETE CASCADE;


--
-- Name: practical_submissions practical_submissions_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.practical_submissions
    ADD CONSTRAINT practical_submissions_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: practical_test_cases practical_test_cases_practical_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.practical_test_cases
    ADD CONSTRAINT practical_test_cases_practical_id_fkey FOREIGN KEY (practical_id) REFERENCES public.practicals(id) ON DELETE CASCADE;


--
-- Name: practicals practicals_course_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.practicals
    ADD CONSTRAINT practicals_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id) ON DELETE CASCADE;


--
-- Name: practicals practicals_faculty_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.practicals
    ADD CONSTRAINT practicals_faculty_id_fkey FOREIGN KEY (faculty_id) REFERENCES public.users(id);


--
-- Name: student_workspaces student_workspaces_practical_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.student_workspaces
    ADD CONSTRAINT student_workspaces_practical_id_fkey FOREIGN KEY (practical_id) REFERENCES public.practicals(id) ON DELETE CASCADE;


--
-- Name: student_workspaces student_workspaces_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.student_workspaces
    ADD CONSTRAINT student_workspaces_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: submission_attempts submission_attempts_practical_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.submission_attempts
    ADD CONSTRAINT submission_attempts_practical_id_fkey FOREIGN KEY (practical_id) REFERENCES public.practicals(id) ON DELETE CASCADE;


--
-- Name: submission_attempts submission_attempts_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.submission_attempts
    ADD CONSTRAINT submission_attempts_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: submission_resets submission_resets_practical_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.submission_resets
    ADD CONSTRAINT submission_resets_practical_id_fkey FOREIGN KEY (practical_id) REFERENCES public.practicals(id) ON DELETE CASCADE;


--
-- Name: submission_resets submission_resets_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.submission_resets
    ADD CONSTRAINT submission_resets_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--


