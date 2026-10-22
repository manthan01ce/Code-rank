import sql from '../../db/client.js';
import { positiveId } from '../practicals/PracticalManagementService.js';
const fail = (status, message) => { throw { status, message }; };

export function validateCatalog(entity, body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) fail(400, 'Invalid catalog payload');
  const out = {};
  for (const key of entity === 'course' ? ['name', 'course_code'] : ['name', 'institute_name']) {
    if (typeof body[key] !== 'string' || !body[key].trim() || body[key].trim().length > (key === 'course_code' ? 100 : 300)) fail(400, `Invalid ${key}`);
    out[key] = body[key].trim();
  }
  if (entity === 'course') {
    if (!['string', 'number'].includes(typeof body.semester) || !/^[1-9][0-9]{0,2}$/.test(String(body.semester))) fail(400, 'Invalid semester');
    out.semester = Number(body.semester);
  }
  return out;
}

export class CourseManagementService {
  static async mutate(admin, entity, id, action, body = {}) {
    if (!admin || admin.role !== 'admin') fail(401, 'Unauthorized');
    if (!['course', 'department'].includes(entity) || !['create', 'update', 'delete'].includes(action)) fail(400, 'Invalid catalog operation');
    const target = action === 'create' ? null : positiveId(id);
    const payload = action === 'delete' ? {} : validateCatalog(entity, body);
    try {
      const [row] = await sql.query('SELECT coderank_manage_catalog($1,$2,$3,$4,$5::jsonb) item', [admin.id, entity, target, action, JSON.stringify(payload)]);
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
}
