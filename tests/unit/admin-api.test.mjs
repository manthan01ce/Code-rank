import test,{mock} from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
process.env.JWT_SECRET='admin-api-test-secret';
registerHooks({resolve(specifier,context,next){if(specifier.startsWith('@/'))return next(new URL(`../../apps/web/src/${specifier.slice(2)}.js`,import.meta.url).href,context);if(specifier==='next/server')return next('next/server.js',context);return next(specifier,context);}});
let observed,errorCode=null;const notifications=[];
const sql=Object.assign(async()=>[],{query:async(q,p)=>{observed={q,p};if(errorCode)throw Object.assign(Error('database internal details'),{code:errorCode});if(q.includes('mutate_practical'))return [{practical:{id:1,course_id:1,title:'Test',end_time:'2027-01-01'}}];return [{id:1}];}});
mock.module(new URL('../../packages/core/src/db/client.js',import.meta.url).href,{defaultExport:sql});
mock.module('@coderank/database', { defaultExport: sql, namedExports: { closeDatabase: async () => {} } });
const {generateToken, getUserFromRequest}=await import('../../packages/core/src/utils/auth.js');
mock.module('@coderank/core/security/active-actor', { namedExports: {
  authenticateRequest: async (request, { optional = false } = {}) => {
    const header = request?.headers?.get?.('authorization') || request?.headers?.authorization;
    if (optional && !header) return null;
    const actor = header && getUserFromRequest(request);
    if (!actor) throw { status: 401, message: 'Authentication required' };
    return actor;
  },
  authenticateToken: async () => ({ id: 2, role: 'admin' }),
} });

const { buildApp } = await import('../../apps/api/src/app.js');
const api = buildApp();
await api.ready();
api.publisher.publishPracticalChange = (...args) => notifications.push(args);

const body={course_id:1,title:'Test',description:'Description',test_cases:[{input:'',expected:'ok',marks:10}]};
const injectPractical = (method, path, payload, role = 'faculty') => api.inject({
  method,
  url: path,
  headers: {
    authorization: `Bearer ${generateToken({ id: 2, role })}`,
    ...(payload ? { 'content-type': 'application/json' } : {}),
  },
  ...(payload ? { payload } : {}),
});

test('practical adapters enforce role and payloads, preserve response and notify only on commit',async()=>{
 assert.equal((await injectPractical('POST', '/api/faculty/practicals', body, 'student')).statusCode, 401);
 assert.equal((await api.inject({ method: 'POST', url: '/api/faculty/practicals', headers: { authorization: `Bearer ${generateToken({ id: 2, role: 'faculty' })}`, 'content-type': 'application/json' }, payload: '{' })).statusCode, 400);
 for (const patch of [{ course_id: '1junk' }, { test_cases: [] }, { test_cases: [{ input: '', expected: 'ok', marks: 'Infinity' }] }, { start_time: 'bad' }, { test_cases: [{ input: '', expected: 'ok', marks: 1, time_limit: 31 }] }]) {
   assert.equal((await injectPractical('POST', '/api/faculty/practicals', { ...body, ...patch })).statusCode, 400);
 }
 assert.equal((await injectPractical('POST', '/api/faculty/practicals', body)).statusCode, 200);
 assert.equal(notifications.length, 1);
 errorCode = '23514';
 assert.equal((await injectPractical('POST', '/api/faculty/practicals', body)).statusCode, 409);
 assert.equal(notifications.length, 1);
 errorCode = null;
 const page = await injectPractical('GET', '/api/faculty/practicals?limit=1&cursor=9');
 assert.equal(page.headers['x-next-cursor'], '1');
 assert.match(observed.q, /LIMIT \$4/);
 assert.deepEqual(observed.p, [2, null, 9, 1]);
 assert.equal((await injectPractical('GET', '/api/faculty/practicals?limit=201')).statusCode, 400);
});
test('mapping adapter normalizes IDs and denies duplicate or unauthorized writes',async()=>{
 const postMapping = (payload, role) => api.inject({
   method: 'POST',
   url: '/api/mapping',
   headers: {
     authorization: `Bearer ${generateToken({ id: 2, role })}`,
     'content-type': 'application/json',
   },
   payload,
 });
 assert.equal((await postMapping({ course_id: 1, faculty_ids: [2] }, 'faculty')).statusCode, 401);
 assert.equal((await postMapping({ course_id: 1, faculty_ids: ['2', 2] }, 'admin')).statusCode, 400);
 assert.equal((await postMapping({ course_id: '1', faculty_ids: ['2'], co_coordinator_id: '2' }, 'admin')).statusCode, 200);
 assert.deepEqual(observed.p, [2, 1, [2], 2]);
});
