import { NextResponse } from 'next/server';
import sql from '@/lib/db';
import { getUserFromRequest, comparePassword, hashPassword } from '@/lib/auth';

export async function POST(request) {
  try {
    const user = getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { currentPassword, newPassword } = await request.json();

    if (!currentPassword || !newPassword) {
      return NextResponse.json({ error: 'Current password and new password are required' }, { status: 400 });
    }

    if (newPassword.length < 6) {
      return NextResponse.json({ error: 'New password must be at least 6 characters long' }, { status: 400 });
    }

    // 1. Fetch user from DB
    const userResult = await sql`SELECT * FROM users WHERE id = ${user.id}`;
    if (userResult.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const dbUser = userResult[0];

    // 2. Verify current password
    const isMatch = await comparePassword(currentPassword, dbUser.password);
    if (!isMatch) {
      return NextResponse.json({ error: 'Invalid current password' }, { status: 400 });
    }

    // 3. Hash new password
    const hashed = await hashPassword(newPassword);

    // 4. Update password
    await sql`
      UPDATE users 
      SET password = ${hashed}
      WHERE id = ${user.id}
    `;

    // 5. Log activity
    await sql`
      INSERT INTO activity_logs (user_id, action, details) 
      VALUES (${user.id}, 'CHANGE_PASSWORD', 'User updated their password successfully')
    `;

    return NextResponse.json({ success: true, message: 'Password updated successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    return NextResponse.json({ error: 'Internal server error: ' + error.message }, { status: 500 });
  }
}
