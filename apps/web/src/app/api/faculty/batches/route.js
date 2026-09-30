import { NextResponse } from 'next/server';
import { CourseService } from '@coderank/core/services/CourseService';
import { getUserFromRequest } from '@coderank/core/utils/auth';

export async function GET(request) {
  try {
    const user = getUserFromRequest(request);
    const batches = await CourseService.getBatches(user);
    return NextResponse.json(batches);
  } catch (error) {
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Fetch batches error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
