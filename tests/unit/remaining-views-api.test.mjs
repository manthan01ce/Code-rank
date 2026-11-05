import test from 'node:test';
import assert from 'node:assert/strict';
import { courseRequest, departmentRequest } from '../../apps/web/src/features/courses/api/courses-api.js';
import { mappingRequest } from '../../apps/web/src/features/mapping/api/mapping-api.js';
import { logsRequest } from '../../apps/web/src/features/operations/api/operations-api.js';
import { practiceRequest } from '../../apps/web/src/features/practice/api/practice-api.js';
import { workspaceRequest } from '../../apps/web/src/features/coding-workspace/api/coding-workspace-api.js';

test('feature HTTP clients preserve public methods, bodies, errors and cancellation', async t => {
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    calls.push({ url, options });
    return new Response(JSON.stringify({ error: 'Constraint rejected' }), { status: 409 });
  });
  const controller = new AbortController();
  const options = { method: 'PUT', body: JSON.stringify({ name: 'Course' }), signal: controller.signal, headers: { Authorization: 'Bearer synthetic' } };
  const res = await courseRequest(7, options);
  assert.equal(res.status, 409);
  assert.equal((await res.json()).error, 'Constraint rejected');
  await courseRequest(null, { ...options, method: 'POST' });
  await departmentRequest(2, { ...options, method: 'DELETE' });
  await mappingRequest(options);
  await logsRequest(100, options);
  await practiceRequest(options);
  await workspaceRequest(7, 'python', options);
  assert.deepEqual(calls.map(c => c.url), ['/api/courses/7', '/api/courses', '/api/departments/2', '/api/mapping', '/api/logs?limit=100', '/api/practice-run', '/api/student/workspaces/load?practical_id=7&language=python']);
  assert.deepEqual(calls.map(c => c.options.method), ['PUT', 'POST', 'DELETE', 'PUT', 'PUT', 'PUT', 'PUT']);
  assert.ok(calls.every(c => c.options.body === options.body && c.options.signal === controller.signal));
  controller.abort();
  assert.ok(calls.every(c => c.options.signal.aborted));
});
