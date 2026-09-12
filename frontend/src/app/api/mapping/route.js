import { NextResponse } from 'next/server';
import sql from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';

export async function GET(request) {
  try {
    const user = getUserFromRequest(request);
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch all mappings
    const mappings = await sql`
      SELECT cf.course_id, cf.faculty_id, cf.is_co_coordinator, u.name as faculty_name, u.email as faculty_email, u.first_name, u.last_name
      FROM course_faculty cf
      JOIN users u ON cf.faculty_id = u.id
    `;
    
    // Group by course_id
    const grouped = {};
    mappings.forEach(m => {
      if (!grouped[m.course_id]) grouped[m.course_id] = [];
      grouped[m.course_id].push({
        id: m.faculty_id,
        name: m.faculty_name || `${m.first_name} ${m.last_name}`,
        email: m.faculty_email,
        is_co_coordinator: !!m.is_co_coordinator
      });
    });

    return NextResponse.json(grouped);
  } catch (error) {
    console.error('Fetch mapping error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const user = getUserFromRequest(request);
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { course_id, faculty_ids, co_coordinator_id } = await request.json();

    if (!course_id || !Array.isArray(faculty_ids)) {
      return NextResponse.json({ error: 'Invalid data' }, { status: 400 });
    }

    if (faculty_ids.length > 4) {
      return NextResponse.json({ error: 'At most 4 faculties can be mapped to a course.' }, { status: 400 });
    }

    let coId = parseInt(co_coordinator_id);
    if ((isNaN(coId) || !faculty_ids.includes(coId)) && faculty_ids.length > 0) {
      coId = faculty_ids[0];
    }
    
    await sql`DELETE FROM course_faculty WHERE course_id = ${course_id}`;
    
    for (const fid of faculty_ids) {
      const isCo = fid === coId;
      await sql`
        INSERT INTO course_faculty (course_id, faculty_id, is_co_coordinator)
        VALUES (${course_id}, ${fid}, ${isCo})
      `;
    }

    await sql`INSERT INTO activity_logs (user_id, action, details) VALUES (${user.id}, 'UPDATE_MAPPING', ${`Updated mapping for course ${course_id}, co-coordinator ${coId}`})`;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Update mapping error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
