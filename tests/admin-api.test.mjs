import test,{mock} from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
process.env.JWT_SECRET='admin-api-test-secret';
registerHooks({resolve(specifier,context,next){if(specifier.startsWith('@/'))return next(new URL(`../apps/web/src/${specifier.slice(2)}.js`,import.meta.url).href,context);if(specifier==='next/server')return next('next/server.js',context);return next(specifier,context);}});
let observed,errorCode=null;const notifications=[];
const sql=Object.assign(async()=>[],{query:async(q,p)=>{observed={q,p};if(errorCode)throw Object.assign(Error('database internal details'),{code:errorCode});if(q.includes('mutate_practical'))return [{practical:{id:1,course_id:1,title:'Test',end_time:'2027-01-01'}}];return [{id:1}];}});
mock.module(new URL('../packages/core/src/db/client.js',import.meta.url).href,{defaultExport:sql});
mock.module(new URL('../apps/web/src/lib/practical-events.js',import.meta.url).href,{namedExports:{publishPractical:(...args)=>notifications.push(args)}});
const {generateToken, getUserFromRequest}=await import('../packages/core/src/utils/auth.js');
mock.module('@coderank/core/security/active-actor', { namedExports: {
  authenticateRequest: async (request, { optional = false } = {}) => {
    const header = request?.headers?.get?.('authorization');
    if (optional && !header) return null;
    const actor = header && getUserFromRequest(request);
    if (!actor) throw { status: 401, message: 'Authentication required' };
    return actor;
  },
} });

const routes=await import('../apps/web/src/app/api/faculty/practicals/route.js');
const mapping=await import('../apps/web/src/app/api/mapping/route.js');
const body={course_id:1,title:'Test',description:'Description',test_cases:[{input:'',expected:'ok',marks:10}]};
const req=(path,payload,role='faculty')=>new Request('http://localhost'+path,{method:payload?'POST':'GET',headers:{Authorization:`Bearer ${generateToken({id:2,role})}`,'Content-Type':'application/json'},...(payload?{body:JSON.stringify(payload)}:{})});
test('practical adapters enforce role and payloads, preserve response and notify only on commit',async()=>{
 assert.equal((await routes.POST(req('/api/faculty/practicals',body,'student'))).status,401);
 const malformed=req('/api/faculty/practicals',body);
 assert.equal((await routes.POST(new Request(malformed.url,{method:'POST',headers:malformed.headers,body:'{'}))).status,400);
 for(const patch of [{course_id:'1junk'},{test_cases:[]},{test_cases:[{input:'',expected:'ok',marks:'Infinity'}]},{start_time:'bad'},{test_cases:[{input:'',expected:'ok',marks:1,time_limit:31}]}])assert.equal((await routes.POST(req('/api/faculty/practicals',{...body,...patch}))).status,400);
 assert.equal((await routes.POST(req('/api/faculty/practicals',body))).status,200);assert.equal(notifications.length,1);
 errorCode='23514';assert.equal((await routes.POST(req('/api/faculty/practicals',body))).status,409);assert.equal(notifications.length,1);errorCode=null;
 const page=await routes.GET(req('/api/faculty/practicals?limit=1&cursor=9'));assert.equal(page.headers.get('X-Next-Cursor'),'1');assert.match(observed.q,/LIMIT \$4/);assert.deepEqual(observed.p,[2,null,9,1]);
 assert.equal((await routes.GET(req('/api/faculty/practicals?limit=201'))).status,400);
});
test('mapping adapter normalizes IDs and denies duplicate or unauthorized writes',async()=>{
 assert.equal((await mapping.POST(req('/api/mapping',{course_id:1,faculty_ids:[2]},'faculty'))).status,401);
 assert.equal((await mapping.POST(req('/api/mapping',{course_id:1,faculty_ids:['2',2]},'admin'))).status,400);
 assert.equal((await mapping.POST(req('/api/mapping',{course_id:'1',faculty_ids:['2'],co_coordinator_id:'2'},'admin'))).status,200);
 assert.deepEqual(observed.p,[2,1,[2],2]);
});
