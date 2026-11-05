import sql from '@coderank/database';
import { hashPassword, generateSecurePassword } from '@coderank/core/utils/auth';
import { positiveId } from '@coderank/core/shared/identifiers';

const fail = (status, message) => {
  throw { status, message };
};

export class UserManagementService {
  static admin(user) {
    if (!user || user.role !== 'admin') fail(401, 'Unauthorized');
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
      fail(400, 'Invalid pagination');
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
      conditions.push(
        `(name ILIKE ${nameParam} OR email ILIKE ${emailParam} OR extra_info->>'roll_number' ILIKE ${rollNumberParam} OR extra_info->>'division' ILIKE ${divisionParam})`,
      );
    }

    if (division && division !== 'all') {
      conditions.push(`extra_info->>'division' = ${addParam(division)}`);
    }

    if (cursor !== null) conditions.push(`id < ${addParam(Number(cursor))}`);
    const limitParam = addParam(limit);
    return await sql.query(
      `
      SELECT id, first_name, last_name, name, email, role, status, created_at, extra_info 
      FROM users 
      WHERE ${conditions.join(' AND ')}
      ORDER BY id DESC
      LIMIT ${limitParam}
    `,
      params,
    );
  }

  static async mutate(admin, id, action, body = {}, { onTiming = () => {} } = {}) {
    const validationStart = performance.now();
    this.admin(admin);
    if (!body || typeof body !== 'object' || Array.isArray(body))
      fail(400, 'Invalid user payload');
    const payload = {};
    for (const key of ['first_name', 'last_name', 'name', 'email'])
      if (body[key] !== undefined) {
        if (
          typeof body[key] !== 'string' ||
          !body[key].trim() ||
          body[key].length > 300
        )
          fail(400, `Invalid ${key}`);
        payload[key] = body[key].trim();
      }
    if (payload.email) {
      payload.email = payload.email.toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email))
        fail(400, 'Invalid email');
    }
    if (payload.first_name && payload.last_name)
      payload.name = `${payload.first_name} ${payload.last_name}`;
    if (body.role !== undefined) {
      if (!['faculty', 'student'].includes(body.role))
        fail(400, 'Invalid role');
      payload.role = body.role;
    }
    if (body.status !== undefined) {
      if (!['active', 'inactive'].includes(body.status))
        fail(400, 'Invalid status');
      payload.status = body.status;
    }
    if (body.extra_info !== undefined) {
      if (
        !body.extra_info ||
        typeof body.extra_info !== 'object' ||
        Array.isArray(body.extra_info) ||
        Buffer.byteLength(JSON.stringify(body.extra_info)) > 16384
      )
        fail(400, 'Invalid extra info');
      payload.extra_info = { ...body.extra_info };
      if (body.role === 'student' || body.extra_info.division !== undefined) {
        const division = body.extra_info.division;
        if (
          typeof division !== 'string' ||
          (division.match(/[a-z]/gi) || []).length < 2 ||
          !/[0-9]/.test(division)
        )
          fail(400, 'Invalid student division');
        payload.extra_info.division = division.trim().toUpperCase();
      }
    }
    onTiming('validation', performance.now() - validationStart);
    const hashStart = performance.now();
    let rawPassword;
    if (action === 'create') {
      if (!payload.name || !payload.email || !payload.role)
        fail(400, 'Name, email and role are required');
      if (payload.role === 'student' && !payload.extra_info?.division)
        fail(400, 'Student division is required');
      rawPassword = generateSecurePassword();
      payload.password_hash = await hashPassword(rawPassword);
    } else if (body.password !== undefined && body.password !== '') {
      if (
        typeof body.password !== 'string' ||
        body.password.length < 8 ||
        Buffer.byteLength(body.password, 'utf8') > 72
      )
        fail(400, 'Password must be 8 to 72 characters');
      payload.password_hash = await hashPassword(body.password);
    }
    onTiming('password_hash', performance.now() - hashStart);
    const databaseStart = performance.now();
    try {
      const [row] = await sql.query(
        'SELECT coderank_manage_user($1,$2,$3,$4::jsonb) u',
        [
          admin.id,
          id === null ? null : positiveId(id),
          action,
          JSON.stringify(payload),
        ],
      );
      onTiming('database_commit', performance.now() - databaseStart);
      return { user: row.u, ...(rawPassword ? { rawPassword } : {}) };
    } catch (error) {
      if (error.code === '23505') fail(409, 'Email already exists');
      if (error.code === '42501') fail(403, 'Active administrator required');
      if (error.code === 'P0002') fail(404, 'User not found or protected');
      if (error.code === '22023') fail(400, error.message);
      throw error;
    }
  }
}
