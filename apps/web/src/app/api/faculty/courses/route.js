import { NextResponse } from 'next/server';
import { CourseService } from '@coderank/core/services/CourseService';
import { getUserFromRequest } from '@coderank/core/utils/auth';

export async function GET(request) {
  try {
    const user = getUserFromRequest(request);
    const courses = await CourseService.getFacultyCourses(user);
    return NextResponse.json(courses);
  } catch (error) {
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Fetch faculty courses error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
