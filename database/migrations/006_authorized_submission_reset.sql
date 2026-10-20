CREATE OR REPLACE FUNCTION coderank_reset_submission(p_actor integer,p_submission integer)
RETURNS jsonb LANGUAGE plpgsql AS $function$
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
$function$;
