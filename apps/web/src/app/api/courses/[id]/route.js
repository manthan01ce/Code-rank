import { NextResponse } from 'next/server';
import { CourseService } from '@coderank/core/services/CourseService';
import { getUserFromRequest } from '@coderank/core/utils/auth';

export async function PUT(request, { params }) {
  try {
    const user = getUserFromRequest(request);
    const { id } = await params;
    const body = await request.json();
    const course = await CourseService.updateCourse(user, id, body);
    return NextResponse.json({ success: true, course });
  } catch (error) {
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('PUT /api/courses/[id] error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const user = getUserFromRequest(request);
    const { id } = await params;
    const result = await CourseService.deleteCourse(user, id);
    return NextResponse.json(result);
  } catch (error) {
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('DELETE /api/courses/[id] error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
