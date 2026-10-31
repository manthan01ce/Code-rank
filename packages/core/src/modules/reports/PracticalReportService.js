import sql from '../../db/client.js';
import { listPage } from '../courses/list-pagination.js';

export class PracticalReportService {
  static async stats(user, id, options = {}) {
    if (!user || !['faculty', 'admin'].includes(user.role)) throw { status: 401, message: 'Unauthorized' };
    const practicalId = Number(id);
    if (!Number.isSafeInteger(practicalId) || practicalId <= 0) throw { status: 400, message: 'Invalid practical ID' };
    const { cursor, limit } = listPage({ limit: 50, ...options });
    if (limit > 100) throw { status: 400, message: 'Maximum report page size is 100' };
    // Authorization, cohort, global totals and the bounded grade page share one
    // PostgreSQL statement snapshot. No reads escape this authorization CTE.
    const [row] = await sql.query(`WITH authorized AS (
      SELECT p.id,p.title,p.batch_id,p.total_marks,c.name AS course_name,c.course_code,c.semester
      FROM practicals p JOIN courses c ON c.id=p.course_id
      WHERE p.id=$1 AND EXISTS (
        SELECT 1 FROM users actor WHERE actor.id=$2 AND actor.status='active'
        AND actor.role=$3 AND actor.session_token IS NOT DISTINCT FROM $4
        AND (actor.role='admin' OR (actor.role='faculty' AND EXISTS (
          SELECT 1 FROM course_faculty cf WHERE cf.course_id=p.course_id AND cf.faculty_id=actor.id
        )))
      )
    ), eligible AS (
      SELECT u.id,u.name,u.email,u.extra_info->>'roll_number' AS roll_number
      FROM users u CROSS JOIN authorized p
      WHERE u.role='student' AND u.status='active'
        AND CASE WHEN u.extra_info->>'semester' ~ '^[0-9]{1,2}$' THEN (u.extra_info->>'semester')::int END=p.semester
        AND (coalesce(btrim(p.batch_id),'')='' OR lower(btrim(p.batch_id))='all'
          OR lower(btrim(u.extra_info->>'batch'))=lower(btrim(p.batch_id))
          OR lower(btrim(u.extra_info->>'division'))=lower(btrim(p.batch_id)))
    ), student_page AS (
      SELECT * FROM eligible WHERE ($5::int IS NULL OR id>$5) ORDER BY id LIMIT $6
    ), graded AS (
      SELECT s.id,s.name,s.email,coalesce(nullif(s.roll_number,''),'—') AS roll_number,
        best.student_id IS NOT NULL AS attempted,
        coalesce(best.raw_marks,0) AS raw_marks,coalesce(best.normalized_marks,0) AS normalized_marks,
        best.submitted_at,coalesce(best.status,'Not Attempted') AS status
      FROM student_page s LEFT JOIN LATERAL (
        SELECT ps.* FROM practical_submissions ps CROSS JOIN authorized p
        WHERE ps.student_id=s.id AND ps.practical_id=p.id
        ORDER BY normalized_marks DESC NULLS LAST,submitted_at DESC,id DESC LIMIT 1
      ) best ON true
    ), totals AS (
      SELECT coalesce(round(avg(normalized_marks)::numeric,2),0) AS average_marks,
        count(*)::int AS submissions_count,count(DISTINCT student_id)::int AS attempted_count
      FROM practical_submissions ps JOIN authorized p ON ps.practical_id=p.id
    ) SELECT jsonb_build_object(
      'practical',(SELECT jsonb_build_object('id',p.id,'title',p.title,'course_code',p.course_code,
        'course_name',p.course_name,'batch_id',p.batch_id,'total_marks',p.total_marks) FROM authorized p),
      'stats',(SELECT to_jsonb(t)||jsonb_build_object('total_students',(SELECT count(*)::int FROM eligible)) FROM totals t),
      'students',coalesce((SELECT jsonb_agg(g ORDER BY id) FROM graded g),'[]'::jsonb),
      'pagination',jsonb_build_object('limit',$6::int,'nextCursor',
        CASE WHEN EXISTS(SELECT 1 FROM eligible WHERE id>(SELECT max(id) FROM student_page))
          THEN (SELECT max(id)::text FROM student_page) END)
    ) AS report`, [practicalId,user.id,user.role,user.session_token ?? null,cursor,limit]);
    if (!row?.report?.practical) throw { status: 404, message: 'Practical not found or access denied' };
    return row.report;
  }
}
