import sql from '@coderank/database';
import { listPage } from '@coderank/core/pagination';

function fail(status, message) {
  throw { status, message };
}

export function positiveId(value) {
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id <= 0) fail(400, 'Invalid identifier');
  return id;
}

export function validateCatalog(entity, body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) fail(400, 'Invalid catalog payload');
  const out = {};
  for (const key of entity === 'course' ? ['name', 'course_code'] : ['name', 'institute_name']) {
    if (typeof body[key] !== 'string' || !body[key].trim() || body[key].trim().length > (key === 'course_code' ? 100 : 300)) {
      fail(400, `Invalid ${key}`);
    }
    out[key] = body[key].trim();
  }
  if (entity === 'course') {
    if (!['string', 'number'].includes(typeof body.semester) || !/^[1-9][0-9]{0,2}$/.test(String(body.semester))) {
      fail(400, 'Invalid semester');
    }
    out.semester = Number(body.semester);
  }
  return out;
}

export class CoursesService {
  static async mutate(admin, entity, id, action, body = {}) {
    if (!admin || admin.role !== 'admin') fail(401, 'Unauthorized');
    if (!['course', 'department'].includes(entity) || !['create', 'update', 'delete'].includes(action)) {
      fail(400, 'Invalid catalog operation');
    }
    const target = action === 'create' ? null : positiveId(id);
    const payload = action === 'delete' ? {} : validateCatalog(entity, body);
    try {
      const [row] = await sql.query('SELECT coderank_manage_catalog($1,$2,$3,$4,$5::jsonb) AS item', [
        admin.id,
        entity,
        target,
        action,
        JSON.stringify(payload),
      ]);
      return row.item;
    } catch (error) {
      if (error.code === '23505') fail(409, `${entity === 'course' ? 'Course code' : 'Department name'} already exists`);
      if (error.code === '23503') fail(409, entity === 'course' ? 'Course contains practicals; preserve its grading history' : 'Department is assigned to users');
      if (error.code === '42501') fail(403, 'Active administrator required');
      if (error.code === 'P0002') fail(404, `${entity === 'course' ? 'Course' : 'Department'} not found`);
      if (error.code === '22023') fail(400, error.message);
      throw error;
    }
  }

  static async listCourses(user, options = {}) {
    if (!user || !['admin', 'student', 'faculty'].includes(user.role)) {
      fail(401, 'Unauthorized');
    }
    const { cursor, limit } = listPage(options);
    const search = options.search?.trim() || null;
    const semester = options.semester == null || options.semester === '' ? null : Number(options.semester);
    if (semester !== null && (!Number.isSafeInteger(semester) || semester < 1)) {
      fail(400, 'Invalid semester');
    }
    return sql`
      SELECT * FROM courses
      WHERE (${search}::text IS NULL OR name ILIKE ${`%${search || ''}%`} OR course_code ILIKE ${`%${search || ''}%`})
        AND (${semester}::integer IS NULL OR semester = ${semester})
        AND (${cursor}::integer IS NULL OR id < ${cursor})
      ORDER BY id DESC LIMIT ${limit}
    `;
  }

  static async createCourse(adminUser, body) {
    return this.mutate(adminUser, 'course', null, 'create', body);
  }

  static async updateCourse(adminUser, id, body) {
    return this.mutate(adminUser, 'course', id, 'update', body);
  }

  static async deleteCourse(adminUser, id) {
    await this.mutate(adminUser, 'course', id, 'delete');
    return { success: true };
  }

  static async listDepartments(adminUser, options = {}) {
    if (!adminUser || adminUser.role !== 'admin') {
      fail(401, 'Unauthorized');
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

  static async createDepartment(adminUser, body) {
    return this.mutate(adminUser, 'department', null, 'create', body);
  }

  static async updateDepartment(adminUser, id, body) {
    return this.mutate(adminUser, 'department', id, 'update', body);
  }

  static async deleteDepartment(adminUser, id) {
    await this.mutate(adminUser, 'department', id, 'delete');
    return { success: true };
  }
}
