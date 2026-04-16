import { NextResponse } from 'next/server';
import sql from '@/lib/db';
import { getUserFromRequest, hashPassword } from '@/lib/auth';
import bcrypt from 'bcryptjs';

export async function POST(request) {
  try {
    const admin = getUserFromRequest(request);
    if (!admin || admin.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { currentPassword, newPassword } = await request.json();

    if (!currentPassword || !newPassword) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (newPassword.length < 6) {
      return NextResponse.json({ error: 'New password must be at least 6 characters' }, { status: 400 });
    }

    // Get current admin user from database to verify old password
    const userResult = await sql`SELECT * FROM users WHERE id = ${admin.id}`;
    if (userResult.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const dbUser = userResult[0];

    // Check old password
    const passwordMatch = await bcrypt.compare(currentPassword, dbUser.password);
    if (!passwordMatch) {
      return NextResponse.json({ error: 'Current password is incorrect' }, { status: 401 });
    }

    // Hash new password and update
    const newHashedPassword = await hashPassword(newPassword);
    await sql`UPDATE users SET password = ${newHashedPassword} WHERE id = ${admin.id}`;

    await sql`INSERT INTO activity_logs (user_id, action, details) VALUES (${admin.id}, 'UPDATE_PASSWORD', 'Admin updated their password')`;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Password change error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
