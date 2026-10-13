import { NextResponse } from 'next/server';
import { CourseService } from '@coderank/core/services/CourseService';
import { getUserFromRequest } from '@coderank/core/utils/auth';

export const maxDuration = 10;
export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const user = getUserFromRequest(request);
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');
    const semester = searchParams.get('semester');

    const courses = await CourseService.listCourses(user, { search, semester });
    return NextResponse.json(courses);
  } catch (error) {
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const user = getUserFromRequest(request);
    const body = await request.json();
    const course = await CourseService.createCourse(user, body);
    return NextResponse.json(course);
  } catch (error) {
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
