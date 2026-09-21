/**
 * PURPOSE OF THIS FILE:
 * Authentication API route (/api/auth/profile).
 * Handles:
 * - GET: Retrieves active user details (id, name, email, role, and extra details).
 * - PUT: Performs secure profile adjustments (modifying full name, email, and password changes).
 *   Before hashing and updating passwords, it uses comparePassword to securely confirm the current credentials.
 */
import { NextResponse } from 'next/server';
import sql from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';

export async function GET(request) {
  try {
    const user = getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

        const rows = await sql`
      SELECT id, name, email, role, extra_info, session_token 
      FROM users 
      WHERE id = ${user.id}
    `;

    if (rows.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (user.id !== 0 && rows[0].session_token && rows[0].session_token !== user.session_token) {
        return NextResponse.json({ error: 'Logged in from another device' }, { status: 401 });
    }, { status: 404 });
    }

    return NextResponse.json({ user: rows[0] });
  } catch (error) {
    console.error('GET /api/auth/profile error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const user = getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { name, email, currentPassword, newPassword } = await request.json();

    if (newPassword && newPassword.trim().length > 0) {
      if (!currentPassword) {
        return NextResponse.json({ error: 'Current password is required to change password.' }, { status: 400 });
      }

      // Fetch user's existing hashed password from DB
      const dbUserRows = await sql`SELECT password FROM users WHERE id = ${user.id}`;
      if (dbUserRows.length === 0) {
        return NextResponse.json({ error: 'User not found.' }, { status: 404 });
      }

      const { comparePassword, hashPassword } = await import('@/lib/auth');
      const passwordMatch = await comparePassword(currentPassword, dbUserRows[0].password);
      if (!passwordMatch) {
        return NextResponse.json({ error: 'Incorrect current password.' }, { status: 400 });
      }

      const hashed = await hashPassword(newPassword);
      await sql`
        UPDATE users 
        SET name = ${name}, email = ${email}, password = ${hashed}
        WHERE id = ${user.id}
      `;
    } else {
      await sql`
        UPDATE users 
        SET name = ${name}, email = ${email}
        WHERE id = ${user.id}
      `;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('PUT /api/auth/profile error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
