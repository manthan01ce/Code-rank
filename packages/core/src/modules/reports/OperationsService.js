import sql from '../../db/client.js';

export class OperationsService {
  static admin(user) {
    if (!user || user.role !== 'admin') throw { status: 401, message: 'Unauthorized' };
  }

  static async stats(user) {
    this.admin(user);
    const [counts] = await sql`
      SELECT (SELECT COUNT(*)::int FROM users WHERE role = 'faculty') as faculty,
             (SELECT COUNT(*)::int FROM users WHERE role = 'student') as students,
             (SELECT COUNT(*)::int FROM courses) as courses
    `;
    return counts;
  }

  static async logs(user, requestedLimit = null) {
    this.admin(user);
    const limit = requestedLimit === null ? 50 : Number(requestedLimit);
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) throw { status: 400, message: 'Invalid log limit' };
    return sql`
      SELECT al.id, al.user_id, al.action, al.details, al.created_at,
             u.name AS user_name, u.email AS user_email
      FROM activity_logs al
      LEFT JOIN users u ON u.id = al.user_id
      ORDER BY al.created_at DESC, al.id DESC
      LIMIT ${limit}
    `;
  }
}
