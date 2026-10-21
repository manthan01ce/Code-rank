import sql from "../../db/client.js";
import { positiveId } from "../practicals/PracticalManagementService.js";
export class CourseReportService {
  static async marks(user, id, params = new URLSearchParams()) {
    if (!user || user.role !== "faculty")
      throw { status: 401, message: "Unauthorized" };
    id = positiveId(id);
    const limit = positiveId(params.get("limit") || 100),
      practicalLimit = positiveId(params.get("practicalLimit") || 25);
    if (limit > 200 || practicalLimit > 50)
      throw { status: 400, message: "Report page exceeds maximum size" };
    const studentCursor = params.get("studentCursor")
        ? positiveId(params.get("studentCursor"))
        : 0,
      practicalCursor = params.get("practicalCursor")
        ? positiveId(params.get("practicalCursor"))
        : 0;
    const department = params.get("department") || null;
    if (department && department.length > 200)
      throw { status: 400, message: "Invalid department" };
    // One statement gives authorization and every matrix slice one snapshot.
    const [row] = await sql.query(
      `WITH course AS (
   SELECT c.* FROM courses c WHERE c.id=$1 AND EXISTS(SELECT 1 FROM course_faculty f WHERE f.course_id=c.id AND f.faculty_id=$2)
  ), eligible AS (
   SELECT u.id,u.name,u.email,u.extra_info->>'roll_number' roll_number,u.extra_info->>'batch' batch,
    u.extra_info->>'department' department,u.extra_info->>'division' division
   FROM users u JOIN course c ON c.semester=CASE WHEN u.extra_info->>'semester' ~ '^[0-9]{1,2}$' THEN (u.extra_info->>'semester')::int END
   WHERE u.role='student' AND u.status='active'
  ), student_page AS (
   SELECT * FROM eligible WHERE id>$3 AND ($7::text IS NULL OR department=$7) ORDER BY id LIMIT $5
  ), practical_page AS (
   SELECT p.id,p.title,p.total_marks FROM practicals p JOIN course c ON c.id=p.course_id
   WHERE p.status='active' AND p.id>$4 ORDER BY p.id LIMIT $6
  ) SELECT jsonb_build_object(
   'course',(SELECT to_jsonb(c) FROM course c),
   'students',coalesce((SELECT jsonb_agg(s ORDER BY id) FROM student_page s),'[]'),
   'practicals',coalesce((SELECT jsonb_agg(p ORDER BY id) FROM practical_page p),'[]'),
   'submissions',coalesce((SELECT jsonb_agg(jsonb_build_object('student_id',s.student_id,'practical_id',s.practical_id,'normalized_marks',s.normalized_marks,'is_late',s.is_late,'submitted_at',s.submitted_at))
    FROM practical_submissions s JOIN student_page u ON u.id=s.student_id JOIN practical_page p ON p.id=s.practical_id),'[]'),
   'departments',coalesce((SELECT jsonb_agg(d) FROM (SELECT department,count(*)::int count FROM eligible GROUP BY department ORDER BY department LIMIT 100) d),'[]')
  ) AS report`,
      [
        id,
        user.id,
        studentCursor,
        practicalCursor,
        limit,
        practicalLimit,
        department,
      ],
    );
    const report = row.report;
    if (!report.course)
      throw { status: 404, message: "Course not found or not allocated" };
    report.pagination = {
      studentCursor:
        report.students.length === limit
          ? String(report.students.at(-1).id)
          : null,
      practicalCursor:
        report.practicals.length === practicalLimit
          ? String(report.practicals.at(-1).id)
          : null,
      limit,
      practicalLimit,
    };
    return report;
  }
}
