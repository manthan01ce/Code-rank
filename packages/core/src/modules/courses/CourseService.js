import sql from '../../db/client.js';
import { listPage } from '../../shared/pagination.js';

export class CourseService {
  /**
   * Get courses assigned to a faculty member.
   * Admins are also allowed — they see ALL courses (not filtered by faculty_id).
   */
  static async getFacultyCourses(facultyUser, options = {}) {
    if (!facultyUser || !['faculty', 'admin'].includes(facultyUser.role)) {
      throw { status: 401, message: 'Unauthorized' };
    }

    const { cursor, limit } = listPage(options);

    // Admins see all courses; faculty see only their assigned courses
    if (facultyUser.role === 'admin') {
      return await sql`
        SELECT c.id, c.course_code, c.name, c.semester, false AS is_co_coordinator
        FROM courses c
        WHERE (${cursor}::integer IS NULL OR c.id < ${cursor})
        ORDER BY c.id DESC LIMIT ${limit}
      `;
    }

    return await sql`
      SELECT c.id, c.course_code, c.name, c.semester, cf.is_co_coordinator 
      FROM course_faculty cf 
      JOIN courses c ON cf.course_id = c.id 
      WHERE cf.faculty_id = ${facultyUser.id}
        AND (${cursor}::integer IS NULL OR c.id < ${cursor})
      ORDER BY c.id DESC LIMIT ${limit}
    `;
  }

  /**
   * Get distinct student batches
   */
  static async getBatches(user, options = {}) {
    if (!user) throw { status: 401, message: 'Unauthorized' };

    const { cursor, limit } = listPage(options, { textCursor: true });
    const result = await sql`
      SELECT DISTINCT extra_info->>'batch' as batch 
      FROM users 
      WHERE role = 'student' 
        AND status = 'active' 
        AND extra_info->>'batch' IS NOT NULL 
        AND extra_info->>'batch' != ''
        AND (${cursor}::text IS NULL OR extra_info->>'batch' < ${cursor})
      ORDER BY batch DESC LIMIT ${limit}
    `;

    return result.map(r => r.batch);
  }
}
