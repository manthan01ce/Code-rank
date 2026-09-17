import { NextResponse } from 'next/server';
import sql from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';
import { io as socketClient } from 'socket.io-client';

export async function POST(request, { params }) {
  try {
    const user = getUserFromRequest(request);
    if (!user || user.role !== 'faculty') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const practicalId = parseInt(id);

    const body = await request.json();
    const { extraMinutes, newEndTime } = body;

    // Verify practical exists and faculty is assigned to course
    const practicals = await sql`
      SELECT p.*, c.name as course_name, c.course_code
      FROM practicals p
      JOIN course_faculty cf ON cf.course_id = p.course_id
      JOIN courses c ON c.id = p.course_id
      WHERE p.id = ${practicalId} AND cf.faculty_id = ${user.id}
    `;

    if (practicals.length === 0) {
      return NextResponse.json({ error: 'Practical not found or you are not assigned to this course.' }, { status: 404 });
    }

    const practical = practicals[0];
    let computedEndTime;

    if (newEndTime) {
      computedEndTime = new Date(newEndTime);
    } else if (extraMinutes && !isNaN(parseInt(extraMinutes))) {
      const minutes = parseInt(extraMinutes);
      const currentEnd = practical.end_time ? new Date(practical.end_time).getTime() : Date.now();
      const baseTime = Math.max(Date.now(), currentEnd);
      computedEndTime = new Date(baseTime + minutes * 60 * 1000);
    } else {
      return NextResponse.json({ error: 'Please provide extraMinutes or newEndTime.' }, { status: 400 });
    }

    // Update practical end_time
    const updated = await sql`
      UPDATE practicals
      SET end_time = ${computedEndTime}
      WHERE id = ${practicalId}
      RETURNING *
    `;

    const updatedPractical = updated[0];

    // Log activity
    await sql`
      INSERT INTO activity_logs (user_id, action, details)
      VALUES (${user.id}, 'ADD_EXTRA_TIME', ${`Added extra time to practical "${practical.title}" (ID: ${practicalId}) until ${computedEndTime.toISOString()}`})
    `;

    // Emit real-time Socket.IO event to all students and faculty
    const courseId = practical.course_id;
    if (global.io) {
      global.io.to(`course_${courseId}`).emit('practical_updated', updatedPractical);
      global.io.emit('practical_updated', updatedPractical);
    } else {
      try {
        const socket = socketClient(`http://127.0.0.1:${process.env.PORT || 3000}`);
        socket.emit('faculty_practical_updated', { course_id: courseId, practical: updatedPractical });
        setTimeout(() => socket.disconnect(), 1000);
      } catch (sockErr) {
        console.warn('Socket relay error:', sockErr);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Extra time granted successfully. New deadline: ${computedEndTime.toLocaleString()}`,
      practical: updatedPractical
    });
  } catch (error) {
    console.error('Error adding extra time:', error);
    return NextResponse.json({ error: 'Internal server error: ' + error.message }, { status: 500 });
  }
}
