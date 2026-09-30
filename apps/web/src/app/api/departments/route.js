import { NextResponse } from 'next/server';
import { CourseService } from '@coderank/core/services/CourseService';
import { getUserFromRequest } from '@coderank/core/utils/auth';

export async function GET(request) {
  try {
    const user = getUserFromRequest(request);
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');

    const departments = await CourseService.listDepartments(user, { search });
    return NextResponse.json(departments);
  } catch (error) {
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('GET /api/departments error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const user = getUserFromRequest(request);
    const body = await request.json();
    const department = await CourseService.createDepartment(user, body);
    return NextResponse.json(department);
  } catch (error) {
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('POST /api/departments error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
