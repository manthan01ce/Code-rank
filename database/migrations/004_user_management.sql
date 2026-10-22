-- Existing deployed practical tables predate updated_at. IF NOT EXISTS baseline
-- creation alone does not add columns to existing tables.
ALTER TABLE practicals ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
-- statement-breakpoint
CREATE OR REPLACE FUNCTION coderank_manage_user(p_admin integer,p_id integer,p_action text,p_body jsonb)
RETURNS jsonb LANGUAGE plpgsql AS $function$
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
$function$;
-- statement-breakpoint
CREATE OR REPLACE FUNCTION coderank_replace_mapping(p_admin integer, p_course integer, p_faculty integer[], p_co integer)
RETURNS void LANGUAGE plpgsql AS $function$
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
$function$;
