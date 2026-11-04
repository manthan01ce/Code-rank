import sql from '@coderank/database';
import { AccountService } from '../auth/account.service.js';

export class ProfileService {
  static async getProfileByUsername(actor, username) {
    if (!actor) throw { status: 401, message: 'Unauthorized' };
    return this.getStudentProfileByUsername(username);
  }
  static updateProfile(actor, body) { return AccountService.updateProfile(actor, body); }
  static async getStudentProfileByUsername(username) {
    if (
      typeof username !== "string" ||
      !/^[a-zA-Z0-9.@+_-]{1,254}$/.test(username)
    )
      throw { status: 400, message: "Invalid profile handle" };
    const escaped = username.replaceAll("_", "\\_");
    const users = await sql`
      SELECT id, name, email, role, extra_info, created_at
      FROM users
      WHERE email ILIKE ${escaped} OR email ILIKE ${`${escaped}@%`} OR name ILIKE ${escaped}
      ORDER BY id
      LIMIT 1
    `;

    if (users.length === 0) {
      throw { status: 404, message: "User not found" };
    }

    const user = users[0];
    const submissions = await sql`
      SELECT ps.id,ps.practical_id,ps.language,ps.status,ps.raw_marks,ps.normalized_marks,ps.submitted_at,
             p.title as practical_title,c.name as course_name,c.course_code
      FROM practical_submissions ps
      JOIN practicals p ON ps.practical_id = p.id
      JOIN courses c ON p.course_id = c.id
      WHERE ps.student_id = ${user.id}
      ORDER BY ps.submitted_at DESC,ps.id DESC
      LIMIT 100
    `;

    return {
      user,
      submissions,
    };
  }
}
