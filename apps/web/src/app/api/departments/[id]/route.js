import { NextResponse } from 'next/server';
import { CourseService } from '@coderank/core/services/CourseService';
import { authenticateRequest } from '@coderank/core/security/active-actor';

export async function PUT(request, { params }) {
  try {
    const user = await authenticateRequest(request);
    const { id } = await params;
    const body = await request.json();
    const department = await CourseService.updateDepartment(user, id, body);
    return NextResponse.json({ success: true, department });
  } catch (error) {
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('PUT /api/departments/[id] error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const user = await authenticateRequest(request);
    const { id } = await params;
    const result = await CourseService.deleteDepartment(user, id);
    return NextResponse.json(result);
  } catch (error) {
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('DELETE /api/departments/[id] error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
