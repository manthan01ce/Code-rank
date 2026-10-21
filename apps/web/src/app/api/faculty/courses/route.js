import { NextResponse } from 'next/server';
import { CourseService } from '@coderank/core/services/CourseService';
import { authenticateRequest } from '@coderank/core/security/active-actor';

export async function GET(request) {
  try {
    const user = await authenticateRequest(request);
    const { searchParams } = new URL(request.url);
    const courses = await CourseService.getFacultyCourses(user, { cursor: searchParams.get('cursor'), limit: searchParams.get('limit') || 100 });
    return NextResponse.json(courses, { headers: { 'X-Next-Cursor': courses.length === Number(searchParams.get('limit') || 100) ? String(courses.at(-1).id) : '', 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Fetch faculty courses error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
