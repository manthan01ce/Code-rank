import { enqueueExecution, executionError } from '@/lib/execution-api';
export async function POST(request, { params }) {
  try {
    const { id } = await params;
    if (!/^\d+$/.test(id)) throw { status: 400, message: 'Invalid practical ID' };
    let body;
    try { body = await request.json(); } catch { throw { status: 400, message: 'Invalid JSON payload' }; }
    return await enqueueExecution(request, 'dynamic', { language: body?.language, code: body?.code, dbId: Number(id) }, { submit: true });
  } catch (error) { return executionError(error); }
}
