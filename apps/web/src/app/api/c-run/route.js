import { handleRunRequest } from '@/lib/execution-api';
export const maxDuration = 30;
export async function POST(request) {
  return handleRunRequest(request, 'c', '/api/c-run');
}
