import { NextResponse } from 'next/server';
import sql from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';

export async function GET(request) {
  try {
    const user = getUserFromRequest(request);
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const facultyCount = await sql`SELECT COUNT(*) FROM users WHERE role = 'faculty' AND status = 'active'`;
    const studentCount = await sql`SELECT COUNT(*) FROM users WHERE role = 'student' AND status = 'active'`;
    const courseCount = await sql`SELECT COUNT(*) FROM courses WHERE status = 'ongoing'`;

    return NextResponse.json({
      faculty: parseInt(facultyCount[0].count),
      students: parseInt(studentCount[0].count),
      courses: parseInt(courseCount[0].count)
    });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
