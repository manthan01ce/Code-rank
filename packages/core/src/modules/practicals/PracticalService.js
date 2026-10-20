import sql from '../../db/client.js';
import { assertPracticalPolicy } from '../../security/execution.js';

export class PracticalService {
  static async authorize(user, id, options = {}) {
    if (!user || user.role === 'guest') throw { status: 401, message: 'Authentication required' };
    if (!Number.isSafeInteger(Number(id)) || Number(id) <= 0) throw { status: 400, message: 'Invalid practical ID' };
    const [practical] = await sql`
      SELECT p.*, c.semester FROM practicals p JOIN courses c ON c.id = p.course_id WHERE p.id = ${Number(id)}
    `;
    let profile;
    let assignedFaculty = false;
    if (user.role === 'student') {
      [profile] = await sql`SELECT status, extra_info, session_token FROM users WHERE id = ${user.id}`;
    } else if (user.role === 'faculty' && practical) {
      const rows = await sql`SELECT 1 FROM course_faculty WHERE course_id = ${practical.course_id} AND faculty_id = ${user.id}`;
      assignedFaculty = rows.length > 0;
    }
    assertPracticalPolicy(user, practical, profile, { ...options, assignedFaculty });
    return practical;
  }
}
