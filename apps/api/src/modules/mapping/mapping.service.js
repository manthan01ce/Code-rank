import sql from '@coderank/database';

function fail(status, message) {
  throw { status, message };
}

function positiveId(value) {
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id <= 0) fail(400, 'Invalid identifier');
  return id;
}

export class MappingService {
  static admin(user) {
    if (!user || user.role !== 'admin') fail(401, 'Unauthorized');
  }

  static async list(user) {
    this.admin(user);
    const rows = await sql`
      SELECT cf.course_id, cf.faculty_id, cf.is_co_coordinator, u.name, u.email, u.first_name, u.last_name
      FROM course_faculty cf
      JOIN users u ON u.id = cf.faculty_id
      ORDER BY cf.course_id, cf.faculty_id
    `;
    return rows.reduce((group, m) => {
      (group[m.course_id] ||= []).push({
        id: m.faculty_id,
        name: m.name || `${m.first_name} ${m.last_name}`,
        email: m.email,
        is_co_coordinator: !!m.is_co_coordinator,
      });
      return group;
    }, {});
  }

  static async replace(user, body) {
    this.admin(user);
    if (!body || !Array.isArray(body.faculty_ids) || body.faculty_ids.length > 4) {
      fail(400, 'Provide up to four faculty IDs');
    }
    const course = positiveId(body.course_id);
    const ids = body.faculty_ids.map(positiveId);
    if (new Set(ids).size !== ids.length) {
      fail(400, 'Duplicate faculty IDs');
    }
    const requested = Number(body.co_coordinator_id);
    const co = ids.includes(requested) ? requested : (ids[0] || null);
    try {
      await sql.query('SELECT coderank_replace_mapping($1,$2,$3::int[],$4)', [user.id, course, ids, co]);
    } catch (error) {
      if (error.code === '42501') fail(403, 'Course authorization required');
      if (error.code === 'P0002') fail(404, 'Resource not found');
      if (['22023', '23514'].includes(error.code)) fail(409, error.message);
      throw error;
    }
    return { success: true };
  }
}
