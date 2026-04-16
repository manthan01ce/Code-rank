import { NextResponse } from 'next/server';
import sql from '@/lib/db';
import { getUserFromRequest, hashPassword, generateSecurePassword } from '@/lib/auth';

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

    let query;

    // Build query based on parameters
    if (role && search && status) {
      // All three parameters
      const searchPattern = `%${search}%`;
      if (status === 'all') {
        query = sql`SELECT id, name, email, role, status, created_at, extra_info FROM users 
                   WHERE role = ${role} AND (name ILIKE ${searchPattern} OR email ILIKE ${searchPattern})
                   ORDER BY created_at DESC`;
      } else {
        query = sql`SELECT id, name, email, role, status, created_at, extra_info FROM users 
                   WHERE role = ${role} AND status = ${status} AND (name ILIKE ${searchPattern} OR email ILIKE ${searchPattern})
                   ORDER BY created_at DESC`;
      }
    } else if (role && status) {
      // Role and status
      if (status === 'all') {
        query = sql`SELECT id, name, email, role, status, created_at, extra_info FROM users 
                   WHERE role = ${role} ORDER BY created_at DESC`;
      } else {
        query = sql`SELECT id, name, email, role, status, created_at, extra_info FROM users 
                   WHERE role = ${role} AND status = ${status} ORDER BY created_at DESC`;
      }
    } else if (role && search) {
      // Role and search
      const searchPattern = `%${search}%`;
      query = sql`SELECT id, name, email, role, status, created_at, extra_info FROM users 
                 WHERE role = ${role} AND status = 'active' AND (name ILIKE ${searchPattern} OR email ILIKE ${searchPattern})
                 ORDER BY created_at DESC`;
    } else if (role) {
      // Just role
      query = sql`SELECT id, name, email, role, status, created_at, extra_info FROM users 
                 WHERE role = ${role} AND status = 'active' ORDER BY created_at DESC`;
    } else {
      // No role specified, get all non-admin users
      query = sql`SELECT id, name, email, role, status, created_at, extra_info FROM users 
                 WHERE role != 'admin' ORDER BY created_at DESC`;
    }

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

    const { name, email, role, extra_info } = await request.json();

    if (!name || !email || !role) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Generate password
    const rawPassword = generateSecurePassword();
    const hashedPassword = await hashPassword(rawPassword);

    const result = await sql`
      INSERT INTO users (name, email, password, role, extra_info)
      VALUES (${name}, ${email}, ${hashedPassword}, ${role}, ${extra_info ? JSON.stringify(extra_info) : null})
      RETURNING id, name, email, role, extra_info
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

    const { id, name, email, role, status, extra_info } = await request.json();

    if (!id) {
      return NextResponse.json({ error: 'Missing user ID' }, { status: 400 });
    }

    const result = await sql`
      UPDATE users 
      SET name = ${name}, 
          email = ${email}, 
          role = ${role}, 
          status = ${status},
          extra_info = ${extra_info ? JSON.stringify(extra_info) : null}
      WHERE id = ${id} AND role != 'admin'
      RETURNING id, name, email, role, status
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
