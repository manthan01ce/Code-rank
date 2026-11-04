import sql from '@coderank/database';
import { comparePassword, hashPassword, generateToken } from '@coderank/core/utils/auth';
import crypto from 'node:crypto';

export class AccountService {
  static async updateProfile(user, body = {}) {
    return this.updateOwnAccount(user, body, false);
  }

  static async changePassword(user, body = {}) {
    return this.updateOwnAccount(user, body, true);
  }

  // The password check happens before hashing; the conditional write checks the
  // exact observed password and session again so concurrent logins, resets or
  // account deactivation cannot be overwritten by an in-flight request.
  static async updateOwnAccount(user, body, passwordRequired) {
    if (!user) throw { status: 401, message: "Unauthorized" };
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw { status: 400, message: 'Invalid profile payload' };
    const { currentPassword, newPassword } = body;
    const changingPassword = passwordRequired || (newPassword !== undefined && newPassword !== '');
    if (changingPassword && (typeof currentPassword !== 'string' || !currentPassword || Buffer.byteLength(currentPassword, 'utf8') > 72 || typeof newPassword !== 'string' || newPassword.length < 8 || Buffer.byteLength(newPassword, 'utf8') > 72)) {
      throw { status: 400, message: 'Current password is required; new password must be at least 8 characters and at most 72 UTF-8 bytes' };
    }
    if (!passwordRequired) {
      if (body.name !== undefined && (typeof body.name !== 'string' || !body.name.trim() || body.name.length > 300)) throw { status: 400, message: 'Invalid name' };
      if (body.email !== undefined && (typeof body.email !== 'string' || body.email.length > 300 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email))) throw { status: 400, message: 'Invalid email' };
    }
    const [observed] = await sql`SELECT id,name,email,password,role,status,session_token FROM users WHERE id=${user.id}`;
    if (!observed || observed.status !== 'active' || observed.role !== user.role || (observed.session_token ?? null) !== (user.session_token ?? null)) throw { status: 401, message: 'Session expired' };
    if (changingPassword && !await comparePassword(currentPassword, observed.password)) throw { status: 400, message: 'Invalid current password' };
    const hashed = changingPassword ? await hashPassword(newPassword) : observed.password;
    const session = changingPassword ? crypto.randomBytes(32).toString('hex') : observed.session_token;
    const name = passwordRequired ? observed.name : body.name?.trim() ?? observed.name;
    const email = passwordRequired || observed.role === 'student' ? observed.email : body.email?.trim().toLowerCase() ?? observed.email;
    let rows;
    try {
      rows = await sql.query(`WITH changed AS (
        UPDATE users SET name=$1,email=$2,password=$3,session_token=$4
        WHERE id=$5 AND password=$6 AND session_token IS NOT DISTINCT FROM $7 AND role=$8 AND status='active'
        RETURNING id,name,email,role,session_token
      ), audit AS (
        INSERT INTO activity_logs(user_id,action,details)
        SELECT id,$9,'User updated their own account' FROM changed RETURNING id
      ) SELECT changed.* FROM changed CROSS JOIN (SELECT count(*) FROM audit) committed`,
        [name,email,hashed,session,user.id,observed.password,observed.session_token,user.role,changingPassword ? 'CHANGE_PASSWORD' : 'UPDATE_PROFILE']);
    } catch (error) {
      if (error.code === '23505') throw { status: 409, message: 'Email already exists' };
      throw error;
    }
    if (!rows.length) throw { status: 401, message: 'Session changed; sign in again before retrying' };
    const record = rows[0];
    return { success: true, ...(passwordRequired ? { message: 'Password updated successfully' } : {}),
      ...(changingPassword ? { token: generateToken({id: record.id,name: record.name,email: record.email,role: record.role,session_token: record.session_token}) } : {}) };
  }

}
