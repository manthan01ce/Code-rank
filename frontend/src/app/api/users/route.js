import { NextResponse } from 'next/server';
import sql from '@/lib/db';
import { getUserFromRequest, hashPassword, generateSecurePassword } from '@/lib/auth';

function validateDivision(division) {
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

export async function GET(request) {
  try {
    const user = getUserFromRequest(request);
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const role = searchParams.get('role'); // faculty or student
    const search = searchParams.get('search');
    const status = searchParams.get('status'); // active, inactive, or all
    const division = searchParams.get('division');

    let conditions = [];
    if (role) {
      conditions.push(sql`role = ${role}`);
    } else {
      conditions.push(sql`role != 'admin'`);
    }

    if (status && status !== 'all') {
      conditions.push(sql`status = ${status}`);
    }

    if (search && search.trim()) {
      const searchPattern = `%${search.trim()}%`;
      conditions.push(sql`(name ILIKE ${searchPattern} OR email ILIKE ${searchPattern} OR extra_info->>'roll_number' ILIKE ${searchPattern} OR extra_info->>'division' ILIKE ${searchPattern})`);
    }

    if (division && division !== 'all') {
      conditions.push(sql`extra_info->>'division' = ${division}`);
    }

    const whereClause = conditions.reduce((acc, cond) => sql`${acc} AND ${cond}`);

    const query = sql`
      SELECT id, first_name, last_name, name, email, role, status, created_at, extra_info 
      FROM users 
      WHERE ${whereClause} 
      ORDER BY created_at DESC
    `;

    const usersList = await query;
    return NextResponse.json(usersList);
  } catch (error) {
    console.error('Fetch users error:', error);
    return NextResponse.json({ error: 'Internal server error: ' + error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const user = getUserFromRequest(request);
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { first_name, last_name, email, role, extra_info } = await request.json();
    const name = `${first_name} ${last_name}`;

    if (!first_name || !last_name || !email || !role) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (role === 'student') {
      const val = validateDivision(extra_info?.division);
      if (!val.valid) {
        return NextResponse.json({ error: val.error }, { status: 400 });
      }
      extra_info.division = extra_info.division.trim().toUpperCase();
    }

    // Generate password
    const rawPassword = generateSecurePassword();
    const hashedPassword = await hashPassword(rawPassword);

    const result = await sql`
      INSERT INTO users (first_name, last_name, name, email, password, role, extra_info)
      VALUES (${first_name}, ${last_name}, ${name}, ${email}, ${hashedPassword}, ${role}, ${extra_info ? JSON.stringify(extra_info) : null})
      RETURNING id, first_name, last_name, name, email, role, extra_info
    `;

    await sql`INSERT INTO activity_logs (user_id, action, details) VALUES (${user.id}, 'CREATE_USER', ${`Created ${role} ${email}`})`;

    return NextResponse.json({ 
      user: result[0],
      rawPassword // sending it back once
    });
  } catch (error) {
    console.error('Create user error:', error);
    if (error.code === '23505') { // Unique violation
      return NextResponse.json({ error: 'Email already exists' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
export async function PUT(request) {
  try {
    const user = getUserFromRequest(request);
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id, first_name, last_name, email, role, status, extra_info } = await request.json();
    const name = `${first_name} ${last_name}`;

    if (!id) {
      return NextResponse.json({ error: 'Missing user ID' }, { status: 400 });
    }

    if (role === 'student' || extra_info?.division !== undefined) {
      const val = validateDivision(extra_info?.division);
      if (!val.valid) {
        return NextResponse.json({ error: val.error }, { status: 400 });
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
      return NextResponse.json({ error: 'User not found or cannot be modified' }, { status: 404 });
    }

    await sql`INSERT INTO activity_logs (user_id, action, details) VALUES (${user.id}, 'UPDATE_USER', ${`Updated user ${email}`})`;

    return NextResponse.json(result[0]);
  } catch (error) {
    console.error('Update user error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const user = getUserFromRequest(request);
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Missing user ID' }, { status: 400 });
    }

    const result = await sql`
      DELETE FROM users 
      WHERE id = ${parseInt(id)} AND role != 'admin'
      RETURNING id, email
    `;

    if (result.length === 0) {
      return NextResponse.json({ error: 'User not found or cannot be deleted' }, { status: 404 });
    }

    await sql`INSERT INTO activity_logs (user_id, action, details) VALUES (${user.id}, 'DELETE_USER', ${`Deleted user ${result[0].email}`})`;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete user error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
