import { UserManagementService } from "./UserManagementService.js";
import sql from "../../db/client.js";
import {
  comparePassword,
  hashPassword,
  generateToken,
  generateSecurePassword,
} from "../../utils/auth.js";
import crypto from "crypto";

export class UserService {
  /**
   * Validate student division format
   */
  static validateDivision(division) {
    if (!division || typeof division !== "string" || !division.trim()) {
      return { valid: false, error: "Division is compulsory for students." };
    }
    const trimmed = division.trim();
    const alphaMatches = trimmed.match(/[a-zA-Z]/g) || [];
    const digitMatches = trimmed.match(/[0-9]/g) || [];
    if (alphaMatches.length < 2) {
      return {
        valid: false,
        error:
          "Division must contain at least 2 alphabetic letters (e.g., CE1, IT2).",
      };
    }
    if (digitMatches.length < 1) {
      return {
        valid: false,
        error:
          "Division must contain at least 1 numeric digit (e.g., CE1, IT2).",
      };
    }
    return { valid: true };
  }

  /**
   * User login
   */
  static async login({ email, password }) {
    const cleanEmail = String(email || '').trim().toLowerCase();
    if (!cleanEmail || !password) {
      throw { status: 400, message: "Email and password are required" };
    }

    let userResult = [];
    let dbFailed = false;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        userResult = await sql`
          SELECT * FROM users 
          WHERE LOWER(email) = ${cleanEmail} 
             OR (LOWER(email) = 'reyapatel@charusat.ac.in' AND ${cleanEmail} = 'riyapatel@charusat.ac.in')
             OR (LOWER(email) = 'riyapatel@charusat.ac.in' AND ${cleanEmail} = 'reyapatel@charusat.ac.in')
        `;
        dbFailed = false;
        break;
      } catch (e) {
        console.error(`Database login query attempt ${attempt} failed:`, e.code || e.message || "unavailable");
        dbFailed = true;
        if (attempt < 3) {
          // Wait before retrying to allow serverless database to complete wake-up
          await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
        }
      }
    }

    if (dbFailed) throw { status: 503, message: "Database is connecting. Please wait a moment and try again." };
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
    passwordMatch = await comparePassword(password, dbUser.password);

    if (!passwordMatch) {
      throw { status: 401, message: "Invalid email or password" };
    }

    if (dbUser.status !== "active") {
      throw { status: 403, message: "Account is inactive" };
    }

    const sessionToken = crypto.randomUUID();
    const loginRows = await sql.query(
      `WITH updated AS (
      UPDATE users SET session_token=$1 WHERE id=$2 AND status='active' RETURNING id
    ) INSERT INTO activity_logs(user_id,action,details) SELECT id,'LOGIN','User logged in' FROM updated RETURNING user_id`,
      [sessionToken, dbUser.id],
    );
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
    const { session_token, status, ...profile } = record;
    return profile;
  }

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

  /**
   * Admin: List users with filters
   */
  static async listUsers({
    role,
    search,
    status,
    division,
    cursor = null,
    limit = 100,
  }) {
    limit = Number(limit);
    if (
      !Number.isSafeInteger(limit) ||
      limit < 1 ||
      limit > 200 ||
      (cursor !== null &&
        (!Number.isSafeInteger(Number(cursor)) || Number(cursor) < 1))
    )
      throw { status: 400, message: "Invalid pagination" };
    const conditions = [];
    const params = [];

    const addParam = (value) => {
      params.push(value);
      return `$${params.length}`;
    };

    if (role) {
      conditions.push(`role = ${addParam(role)}`);
    } else {
      conditions.push("role != 'admin'");
    }

    if (status && status !== "all") {
      conditions.push(`status = ${addParam(status)}`);
    }

    if (search && search.trim()) {
      const searchPattern = `%${search.trim()}%`;
      const nameParam = addParam(searchPattern);
      const emailParam = addParam(searchPattern);
      const rollNumberParam = addParam(searchPattern);
      const divisionParam = addParam(searchPattern);
      conditions.push(
        `(name ILIKE ${nameParam} OR email ILIKE ${emailParam} OR extra_info->>'roll_number' ILIKE ${rollNumberParam} OR extra_info->>'division' ILIKE ${divisionParam})`,
      );
    }

    if (division && division !== "all") {
      conditions.push(`extra_info->>'division' = ${addParam(division)}`);
    }

    if (cursor !== null) conditions.push(`id < ${addParam(Number(cursor))}`);
    const limitParam = addParam(limit);
    return await sql.query(
      `
      SELECT id, first_name, last_name, name, email, role, status, created_at, extra_info 
      FROM users 
      WHERE ${conditions.join(" AND ")}
      ORDER BY id DESC
      LIMIT ${limitParam}
    `,
      params,
    );
  }

  /**
   * Admin: Create single user
   */
  static async createUser(admin, body) {
    return UserManagementService.mutate(admin, null, "create", body);
  }
  static async updateUser(admin, body) {
    return (await UserManagementService.mutate(admin, body.id, "update", body))
      .user;
  }
  static async deleteUser(admin, id) {
    await UserManagementService.mutate(admin, id, "deactivate");
    return { success: true };
  }

  /**
   * Admin: Bulk upload users
   */
  static async bulkUploadUsers(admin, usersList, role) {
    UserManagementService.admin(admin);
    if (!Array.isArray(usersList) || usersList.length > 500)
      throw { status: 400, message: "Maximum 500 users per upload" };
    const users = [],
      errors = [];
    for (const [index, u] of usersList.entries()) {
      try {
        const result = await UserManagementService.mutate(
          admin,
          null,
          "create",
          {
            ...u,
            role,
            name: u.name || `${u.first_name || ""} ${u.last_name || ""}`.trim(),
            extra_info: {
              roll_number: u.roll_number || u.roll || "",
              division: u.division || "",
              batch: u.batch || "",
              semester: u.semester || 1,
              department: u.department || "",
            },
          },
        );
        users.push({ ...result.user, rawPassword: result.rawPassword });
      } catch (error) {
        errors.push({
          row: index + 1,
          email: u.email,
          error: error.status ? error.message : "Unable to create user",
        });
      }
    }
    return { success: true, createdCount: users.length, users, errors };
  }

  /**
   * Get student profile stats by username/email
   */
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
