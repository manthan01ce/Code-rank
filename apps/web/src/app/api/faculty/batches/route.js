import { NextResponse } from 'next/server';
import { CourseService } from '@coderank/core/services/CourseService';
import { authenticateRequest } from '@coderank/core/security/active-actor';

export async function GET(request) {
  try {
    const user = await authenticateRequest(request);
    const { searchParams } = new URL(request.url);
    const batches = await CourseService.getBatches(user, { cursor: searchParams.get('cursor'), limit: searchParams.get('limit') || 100 });
    return NextResponse.json(batches, { headers: { 'X-Next-Cursor': batches.length === Number(searchParams.get('limit') || 100) ? batches.at(-1) : '', 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Fetch batches error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
