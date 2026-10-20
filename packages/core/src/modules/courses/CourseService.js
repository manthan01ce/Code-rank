import { CourseManagementService } from './CourseManagementService.js';
import sql from '../../db/client.js';
import { listPage } from './list-pagination.js';

export class CourseService {
  /**
   * List courses with optional filtering
   */
  static async listCourses(user, options = {}) {
    if (!user || !['admin', 'student', 'faculty'].includes(user.role)) {
      throw { status: 401, message: 'Unauthorized' };
    }
    const { cursor, limit } = listPage(options);
    const search = options.search?.trim() || null;
    const semester = options.semester == null || options.semester === '' ? null : Number(options.semester);
    if (semester !== null && (!Number.isSafeInteger(semester) || semester < 1)) {
      throw { status: 400, message: 'Invalid semester' };
    }
    return sql`
      SELECT * FROM courses
      WHERE (${search}::text IS NULL OR name ILIKE ${`%${search || ''}%`} OR course_code ILIKE ${`%${search || ''}%`})
        AND (${semester}::integer IS NULL OR semester = ${semester})
        AND (${cursor}::integer IS NULL OR id < ${cursor})
      ORDER BY id DESC LIMIT ${limit}
    `;
  }

  /**
   * Create a course (admin only)
   */
  static async createCourse(adminUser, body) {
    const result = await CourseManagementService.mutate(adminUser, 'course', null, 'create', body);
    return result;
  }

  /**
   * Update a course (admin only)
   */
  static async updateCourse(adminUser, id, body) {
    const result = await CourseManagementService.mutate(adminUser, 'course', id, 'update', body);
    return result;
  }

  /**
   * Delete a course (admin only)
   */
  static async deleteCourse(adminUser, id) {
    await CourseManagementService.mutate(adminUser, 'course', id, 'delete');
    return { success: true };
  }

  /**
   * List departments
   */
  static async listDepartments(adminUser, options = {}) {
    if (!adminUser || adminUser.role !== 'admin') {
      throw { status: 401, message: 'Unauthorized' };
    }
    const { cursor, limit } = listPage(options);
    const search = options.search?.trim() || null;
    return sql`
      SELECT * FROM departments
      WHERE (${search}::text IS NULL OR name ILIKE ${`%${search || ''}%`} OR institute_name ILIKE ${`%${search || ''}%`})
        AND (${cursor}::integer IS NULL OR id < ${cursor})
      ORDER BY id DESC LIMIT ${limit}
    `;
  }

  /**
   * Create department
   */
  static async createDepartment(adminUser, body) {
    const result = await CourseManagementService.mutate(adminUser, 'department', null, 'create', body);
    return result;
  }

  /**
   * Update department
   */
  static async updateDepartment(adminUser, id, body) {
    const result = await CourseManagementService.mutate(adminUser, 'department', id, 'update', body);
    return result;
  }

  /**
   * Delete department
   */
  static async deleteDepartment(adminUser, id) {
    await CourseManagementService.mutate(adminUser, 'department', id, 'delete');
    return { success: true };
  }

  /**
   * Get courses assigned to a faculty member
   */
  static async getFacultyCourses(facultyUser, options = {}) {
    if (!facultyUser || facultyUser.role !== 'faculty') {
      throw { status: 401, message: 'Unauthorized' };
    }

    const { cursor, limit } = listPage(options);
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
