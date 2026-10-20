import { NextResponse } from 'next/server';
import { CourseService } from '@coderank/core/services/CourseService';
import { authenticateRequest } from '@coderank/core/security/active-actor';

export async function GET(request) {
  try {
    const user = await authenticateRequest(request);
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');

    const departments = await CourseService.listDepartments(user, { search, cursor: searchParams.get('cursor'), limit: searchParams.get('limit') || 100 });
    return NextResponse.json(departments, { headers: { 'X-Next-Cursor': departments.length === Number(searchParams.get('limit') || 100) ? String(departments.at(-1).id) : '', 'Cache-Control': 'no-store' } });
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
    const user = await authenticateRequest(request);
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
