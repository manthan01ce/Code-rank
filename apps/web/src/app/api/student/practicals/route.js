import { StudentPracticalService } from '@coderank/core/services/StudentPracticalService';
import { authenticateRequest } from '@coderank/core/security/active-actor';
import { pageResponse, routeError } from '@/lib/route-response';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const user = await authenticateRequest(request);
    const params = new URL(request.url).searchParams;
    const limit = params.get('limit') || 25;
    return pageResponse(await StudentPracticalService.list(user, params.get('course_id'), { cursor: params.get('cursor'), limit }), limit);
  } catch (error) { return routeError(error); }
}
