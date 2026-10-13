import sql from '../db/client.js';
import { comparePassword, hashPassword, generateToken, generateSecurePassword } from '../utils/auth.js';
import crypto from 'crypto';

export class UserService {
  /**
   * Validate student division format
   */
  static validateDivision(division) {
    if (!division || typeof division !== 'string' || !division.trim()) {
      return { valid: false, error: 'Division is compulsory for students.' };
    }
    const trimmed = division.trim();
    const alphaMatches = trimmed.match(/[a-zA-Z]/g) || [];
    const digitMatches = trimmed.match(/[0-9]/g) || [];
    if (alphaMatches.length < 2) {
      return { valid: false, error: 'Division must contain at least 2 alphabetic letters (e.g., CE1, IT2).' };
    }
    if (digitMatches.length < 1) {
      return { valid: false, error: 'Division must contain at least 1 numeric digit (e.g., CE1, IT2).' };
    }
    return { valid: true };
  }

  /**
   * User login
   */
  static async login({ email, password }) {
    if (!email || !password) {
      throw { status: 400, message: 'Email and password are required' };
    }

    let userResult = [];
    let dbFailed = false;
    try {
      userResult = await sql`SELECT * FROM users WHERE email = ${email}`;
    } catch (e) {
      console.error('DB Error:', e);
      dbFailed = true;
    }

    let dbUser;
    if (userResult.length === 0 || dbFailed) {
      const adminEmail = process.env.ADMIN_EMAIL;
      const adminPassword = process.env.ADMIN_PASSWORD;

      if (adminEmail && adminPassword && email === adminEmail && password === adminPassword) {
        dbUser = {
          id: 0,
          name: 'Super Admin',
          email: adminEmail,
          password: adminPassword,
          role: 'admin',
          status: 'active'
        };
      } else {
        if (dbFailed) {
          throw { status: 500, message: 'Database connection failed' };
        }
        throw { status: 401, message: 'Invalid credentials' };
      }
    } else {
      dbUser = userResult[0];
    }

    let passwordMatch = false;
    if (dbUser.id === 0) {
      const userHash = crypto.createHash('sha256').update(password).digest();
      const adminHash = crypto.createHash('sha256').update(dbUser.password).digest();
      passwordMatch = crypto.timingSafeEqual(userHash, adminHash);
    } else {
      try {
        passwordMatch = await comparePassword(password, dbUser.password);
      } catch (e) {
        console.error('Bcrypt Error:', e);
        throw { status: 500, message: 'Authentication failed' };
      }
    }

    if (!passwordMatch) {
      throw { status: 401, message: 'Invalid email or password' };
    }

    if (dbUser.status !== 'active') {
      throw { status: 403, message: 'Account is inactive' };
    }

    const sessionToken = crypto.randomUUID();
    if (dbUser.id !== 0) {
      try {
        await sql`UPDATE users SET session_token = ${sessionToken} WHERE id = ${dbUser.id}`;
      } catch (e) {
        console.error('Session Update Error:', e);
      }
    }

    const token = generateToken({
      id: dbUser.id,
      email: dbUser.email,
      role: dbUser.role,
      name: dbUser.name,
      session_token: sessionToken
    });

    if (dbUser.id !== 0) {
      try {
        await sql`INSERT INTO activity_logs (user_id, action, details) VALUES (${dbUser.id}, 'LOGIN', 'User logged in')`;
      } catch (e) {
        console.error('Log Error:', e);
      }
    }

    return {
      token,
      user: {
        id: dbUser.id,
        name: dbUser.name,
        email: dbUser.email,
        role: dbUser.role
      }
    };
  }

  /**
   * Get authenticated user profile
   */
  static async getProfile(user) {
    if (!user) throw { status: 401, message: 'Unauthorized' };

    const rows = await sql`
      SELECT id, name, email, role, extra_info, session_token 
      FROM users 
      WHERE id = ${user.id}
    `;

    if (rows.length === 0) {
      throw { status: 404, message: 'User not found' };
    }

    if (user.id !== 0 && rows[0].session_token && rows[0].session_token !== user.session_token) {
      throw { status: 401, message: 'Logged in from another device' };
    }

    return rows[0];
  }

  /**
   * Update authenticated user profile
   */
  static async updateProfile(user, { name, email, currentPassword, newPassword }) {
    if (!user) throw { status: 401, message: 'Unauthorized' };

    const dbUserRows = await sql`SELECT email, password, role FROM users WHERE id = ${user.id}`;
    if (dbUserRows.length === 0) {
      throw { status: 404, message: 'User not found.' };
    }

    const dbUser = dbUserRows[0];
    const effectiveEmail = dbUser.role === 'student' ? dbUser.email : (email || dbUser.email);

    if (newPassword && newPassword.trim().length > 0) {
      if (!currentPassword) {
        throw { status: 400, message: 'Current password is required to change password.' };
      }

      const passwordMatch = await comparePassword(currentPassword, dbUser.password);
      if (!passwordMatch) {
        throw { status: 400, message: 'Incorrect current password.' };
      }

      const hashed = await hashPassword(newPassword);
      await sql`
        UPDATE users 
        SET name = ${name}, email = ${effectiveEmail}, password = ${hashed}
        WHERE id = ${user.id}
      `;
    } else {
      await sql`
        UPDATE users 
        SET name = ${name}, email = ${effectiveEmail}
        WHERE id = ${user.id}
      `;
    }

    return { success: true };
  }

  /**
   * Self change password
   */
  static async changePassword(user, { currentPassword, newPassword }) {
    if (!user) throw { status: 401, message: 'Unauthorized' };

    if (!currentPassword || !newPassword) {
      throw { status: 400, message: 'Current password and new password are required' };
    }

    if (newPassword.length < 6) {
      throw { status: 400, message: 'New password must be at least 6 characters long' };
    }

    const userResult = await sql`SELECT * FROM users WHERE id = ${user.id}`;
    if (userResult.length === 0) {
      throw { status: 404, message: 'User not found' };
    }

    const dbUser = userResult[0];
    const isMatch = await comparePassword(currentPassword, dbUser.password);
    if (!isMatch) {
      throw { status: 400, message: 'Invalid current password' };
    }

    const hashed = await hashPassword(newPassword);
    await sql`
      UPDATE users 
      SET password = ${hashed}
      WHERE id = ${user.id}
    `;

    await sql`
      INSERT INTO activity_logs (user_id, action, details) 
      VALUES (${user.id}, 'CHANGE_PASSWORD', 'User updated their password successfully')
    `;

    return { success: true, message: 'Password updated successfully' };
  }

  /**
   * Admin: List users with filters
   */
  static async listUsers({ role, search, status, division }) {
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

    if (status && status !== 'all') {
      conditions.push(`status = ${addParam(status)}`);
    }

    if (search && search.trim()) {
      const searchPattern = `%${search.trim()}%`;
      const nameParam = addParam(searchPattern);
      const emailParam = addParam(searchPattern);
      const rollNumberParam = addParam(searchPattern);
      const divisionParam = addParam(searchPattern);
      conditions.push(`(name ILIKE ${nameParam} OR email ILIKE ${emailParam} OR extra_info->>'roll_number' ILIKE ${rollNumberParam} OR extra_info->>'division' ILIKE ${divisionParam})`);
    }

    if (division && division !== 'all') {
      conditions.push(`extra_info->>'division' = ${addParam(division)}`);
    }

    return await sql.query(`
      SELECT id, first_name, last_name, name, email, role, status, created_at, extra_info 
      FROM users 
      WHERE ${conditions.join(' AND ')}
      ORDER BY created_at DESC
    `, params);
  }

  /**
   * Admin: Create single user
   */
  static async createUser(adminUser, { first_name, last_name, email, role, extra_info = {} }) {
    if (!adminUser || adminUser.role !== 'admin') {
      throw { status: 401, message: 'Unauthorized' };
    }

    const name = `${first_name} ${last_name}`;
    if (!first_name || !last_name || !email || !role) {
      throw { status: 400, message: 'Missing required fields' };
    }

    if (role === 'student') {
      const val = this.validateDivision(extra_info?.division);
      if (!val.valid) {
        throw { status: 400, message: val.error };
      }
      extra_info.division = extra_info.division.trim().toUpperCase();
    }

    const rawPassword = generateSecurePassword();
    const hashedPassword = await hashPassword(rawPassword);

    try {
      const result = await sql`
        INSERT INTO users (first_name, last_name, name, email, password, role, extra_info)
        VALUES (${first_name}, ${last_name}, ${name}, ${email}, ${hashedPassword}, ${role}, ${extra_info ? JSON.stringify(extra_info) : null})
        RETURNING id, first_name, last_name, name, email, role, extra_info
      `;

      await sql`INSERT INTO activity_logs (user_id, action, details) VALUES (${adminUser.id}, 'CREATE_USER', ${`Created ${role} ${email}`})`;

      return {
        user: result[0],
        rawPassword
      };
    } catch (error) {
      if (error.code === '23505') {
        throw { status: 400, message: 'Email already exists' };
      }
      throw error;
    }
  }

  /**
   * Admin: Update user
   */
  static async updateUser(adminUser, { id, first_name, last_name, email, role, status, extra_info = {} }) {
    if (!adminUser || adminUser.role !== 'admin') {
      throw { status: 401, message: 'Unauthorized' };
    }

    if (!id) throw { status: 400, message: 'Missing user ID' };
    const name = `${first_name} ${last_name}`;

    if (role === 'student' || extra_info?.division !== undefined) {
      const val = this.validateDivision(extra_info?.division);
      if (!val.valid) {
        throw { status: 400, message: val.error };
      }
      extra_info.division = extra_info.division.trim().toUpperCase();
    }

    const result = await sql`
      UPDATE users 
      SET first_name = ${first_name},
          last_name = ${last_name},
          name = ${name}, 
          email = ${email}, 
          role = ${role}, 
          status = ${status},
          extra_info = ${extra_info ? JSON.stringify(extra_info) : null}
      WHERE id = ${id} AND role != 'admin'
      RETURNING id, first_name, last_name, name, email, role, status, extra_info
    `;

    if (result.length === 0) {
      throw { status: 404, message: 'User not found or cannot be modified' };
    }

    await sql`INSERT INTO activity_logs (user_id, action, details) VALUES (${adminUser.id}, 'UPDATE_USER', ${`Updated user ${email}`})`;
    return result[0];
  }

  /**
   * Admin: Delete user
   */
  static async deleteUser(adminUser, id) {
    if (!adminUser || adminUser.role !== 'admin') {
      throw { status: 401, message: 'Unauthorized' };
    }

    if (!id) throw { status: 400, message: 'Missing user ID' };

    const result = await sql`
      DELETE FROM users 
      WHERE id = ${parseInt(id)} AND role != 'admin'
      RETURNING id, email
    `;

    if (result.length === 0) {
      throw { status: 404, message: 'User not found or cannot be deleted' };
    }

    await sql`INSERT INTO activity_logs (user_id, action, details) VALUES (${adminUser.id}, 'DELETE_USER', ${`Deleted user ${result[0].email}`})`;
    return { success: true };
  }

  /**
   * Admin: Bulk upload users
   */
  static async bulkUploadUsers(adminUser, usersList, role) {
    if (!adminUser || adminUser.role !== 'admin') {
      throw { status: 401, message: 'Unauthorized' };
    }

    const createdUsers = [];
    const errors = [];

    for (let i = 0; i < usersList.length; i++) {
      const u = usersList[i];
      try {
        const rawPassword = generateSecurePassword();
        const hashedPassword = await hashPassword(rawPassword);
        const name = `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.name;

        const extraInfo = {
          roll_number: u.roll_number || u.roll || '',
          division: (u.division || '').trim().toUpperCase(),
          batch: u.batch || '',
          semester: u.semester || 1,
          department: u.department || ''
        };

        const res = await sql`
          INSERT INTO users (first_name, last_name, name, email, password, role, extra_info)
          VALUES (${u.first_name || ''}, ${u.last_name || ''}, ${name}, ${u.email}, ${hashedPassword}, ${role}, ${JSON.stringify(extraInfo)})
          RETURNING id, first_name, last_name, name, email, role, extra_info
        `;

        createdUsers.push({
          ...res[0],
          rawPassword
        });
      } catch (err) {
        errors.push({ row: i + 1, email: u.email, error: err.message });
      }
    }

    await sql`INSERT INTO activity_logs (user_id, action, details) VALUES (${adminUser.id}, 'BULK_UPLOAD_USERS', ${`Bulk uploaded ${createdUsers.length} ${role}s`})`;

    return {
      success: true,
      createdCount: createdUsers.length,
      users: createdUsers,
      errors
    };
  }

  /**
   * Get student profile stats by username/email
   */
  static async getStudentProfileByUsername(username) {
    const users = await sql`
      SELECT id, name, email, role, extra_info, created_at
      FROM users
      WHERE email ILIKE ${username} OR email ILIKE ${`${username}@%`} OR name ILIKE ${username}
      LIMIT 1
    `;

    if (users.length === 0) {
      throw { status: 404, message: 'User not found' };
    }

    const user = users[0];
    const submissions = await sql`
      SELECT ps.*, p.title as practical_title, c.name as course_name, c.course_code
      FROM practical_submissions ps
      JOIN practicals p ON ps.practical_id = p.id
      JOIN courses c ON p.course_id = c.id
      WHERE ps.student_id = ${user.id}
      ORDER BY ps.submitted_at DESC
    `;

    return {
      user,
      submissions
    };
  }
}
