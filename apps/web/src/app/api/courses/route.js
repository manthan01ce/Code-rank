import { jsonBody } from '@/lib/route-response';
import { NextResponse } from 'next/server';
import { CourseService } from '@coderank/core/services/CourseService';
import { authenticateRequest } from '@coderank/core/security/active-actor';

export const maxDuration = 10;
export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const user = await authenticateRequest(request);
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');
    const semester = searchParams.get('semester');

    const courses = await CourseService.listCourses(user, { search, semester, cursor: searchParams.get('cursor'), limit: searchParams.get('limit') || 100 });
    return NextResponse.json(courses, { headers: { 'X-Next-Cursor': courses.length === Number(searchParams.get('limit') || 100) ? String(courses.at(-1).id) : '', 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const user = await authenticateRequest(request);
    const body = await jsonBody(request);
    const course = await CourseService.createCourse(user, body);
    return NextResponse.json(course);
  } catch (error) {
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
