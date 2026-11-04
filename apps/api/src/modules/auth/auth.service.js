import sql from '@coderank/database';
import { comparePassword, hashPassword, generateToken } from '@coderank/core/utils/auth';
import crypto from 'node:crypto';
import { AccountService } from './account.service.js';

export class AuthService {
  /**
   * User login
   */
  static async login({ email, password }, {onTiming = () => {}} = {}) {
    const lookupStart = performance.now();
    const cleanEmail = String(email || '').trim().toLowerCase();
    if (!cleanEmail || !password) {
      throw { status: 400, message: "Email and password are required" };
    }

    let userResult;
    try {
      // One bounded retry owner, restricted to this side-effect-free lookup.
      userResult = await sql.readQuery(`SELECT * FROM users
        WHERE LOWER(email) = $1
          OR (LOWER(email) = 'reyapatel@charusat.ac.in' AND $1 = 'riyapatel@charusat.ac.in')
          OR (LOWER(email) = 'riyapatel@charusat.ac.in' AND $1 = 'reyapatel@charusat.ac.in')`,
      [cleanEmail], {budgetMs: 2500});
    } catch {
      throw {status: 503, message: 'Sign-in is temporarily unavailable. Please try again shortly.'};
    }
    onTiming('lookup', performance.now() - lookupStart);
    let dbUser = userResult[0];
    if (!dbUser) {
      const adminEmail = process.env.ADMIN_EMAIL;
      const adminPassword = process.env.ADMIN_PASSWORD;
      const matches =
        adminEmail &&
        adminPassword &&
        email === adminEmail &&
        crypto.timingSafeEqual(
          crypto.createHash("sha256").update(password).digest(),
          crypto.createHash("sha256").update(adminPassword).digest(),
        );
      if (!matches) throw { status: 401, message: "Invalid credentials" };
      // Bootstrap a persistent admin rather than issuing an ID-0 token that
      // cannot participate in database-authorized management transactions.
      const hashed = await hashPassword(adminPassword);
      const inserted =
        await sql`INSERT INTO users(name,email,password,role,status)
        VALUES('Super Admin',${adminEmail},${hashed},'admin','active')
        ON CONFLICT(email) DO NOTHING RETURNING *`;
      [dbUser] = inserted.length
        ? inserted
        : await sql`SELECT * FROM users WHERE email=${adminEmail}`;
      if (!dbUser)
        throw { status: 503, message: "Admin initialization failed" };
    }

    let passwordMatch = false;
    const compareStart = performance.now();
    passwordMatch = await comparePassword(password, dbUser.password);
    onTiming('password_compare', performance.now() - compareStart);

    if (!passwordMatch) {
      throw { status: 401, message: "Invalid email or password" };
    }

    if (dbUser.status !== "active") {
      throw { status: 403, message: "Account is inactive" };
    }

    const sessionToken = crypto.randomUUID();
    const commitStart = performance.now();
    const loginRows = await sql.query(
      `WITH updated AS (
      UPDATE users SET session_token=$1 WHERE id=$2 AND status='active' RETURNING id
    ) INSERT INTO activity_logs(user_id,action,details) SELECT id,'LOGIN','User logged in' FROM updated RETURNING user_id`,
      [sessionToken, dbUser.id],
    );
    onTiming('session_commit', performance.now() - commitStart);
    if (loginRows.length !== 1)
      throw { status: 403, message: "Account changed during login" };

    const token = generateToken({
      id: dbUser.id,
      email: dbUser.email,
      role: dbUser.role,
      name: dbUser.name,
      session_token: sessionToken,
    });

    return {
      token,
      user: {
        id: dbUser.id,
        name: dbUser.name,
        email: dbUser.email,
        role: dbUser.role,
      },
    };
  }

  /**
   * Get authenticated user profile
   */
  static async getProfile(user) {
    if (!user) throw { status: 401, message: "Unauthorized" };
    const rows = await sql`SELECT id,name,email,role,extra_info,status,session_token FROM users WHERE id=${user.id}`;
    const record = rows[0];
    if (!record || record.status !== 'active' || record.role !== user.role || (record.session_token ?? null) !== (user.session_token ?? null)) {
      throw { status: 401, message: "Session expired" };
    }
    const { session_token, ...profile } = record;
    return profile;
  }

  // Transitional shared account mutations also serve unmigrated admin-password
  // and username-profile adapters. Their implementation stays once in core
  // until those consumers migrate in 3D/3I.
  static changePassword(user, body) { return AccountService.changePassword(user, body); }
  static updateProfile(user, body) { return AccountService.updateProfile(user, body); }
}
