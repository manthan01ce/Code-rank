-- Entity writes and their audit records commit together. Match the lock order
-- used by user deactivation and faculty mapping before locking a course row.
CREATE OR REPLACE FUNCTION coderank_manage_catalog(p_admin integer,p_entity text,p_id integer,p_action text,p_body jsonb)
RETURNS jsonb LANGUAGE plpgsql AS $function$
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
$function$;
