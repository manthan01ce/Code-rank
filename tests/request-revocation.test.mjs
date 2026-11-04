import test,{mock} from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
process.env.JWT_SECRET='request-revocation-test';
registerHooks({resolve(specifier,context,next){if(specifier.startsWith('@/'))return next(new URL(`../apps/web/src/${specifier.slice(2)}.js`,import.meta.url).href,context);if(specifier==='next/server')return next('next/server.js',context);return next(specifier,context);}});
const users=new Map([[1,{id:1,role:'student',status:'active',session_token:'one'}],[2,{id:2,role:'faculty',status:'active',session_token:'two'}]]);
let unavailable=false;
const sql=Object.assign(async()=>[],{query:async(query,params)=>{if(unavailable)throw Error('database unavailable');if(query.startsWith('SELECT id,name,email,role,status,session_token'))return users.has(params[0])?[users.get(params[0])]:[];return [];}});
mock.module(new URL('../packages/core/src/db/client.js',import.meta.url).href,{defaultExport:sql});
mock.module('@coderank/database', { defaultExport: sql, namedExports: { closeDatabase: async () => {} } });
mock.module('@coderank/queue',{namedExports:{readExecutionWorkers:async()=>({healthy:true,healthyWorkers:1}),createExecutionQueue:()=>({getJob:async()=>({id:'job',data:{userId:1},getState:async()=>'completed',returnvalue:{status:'accepted'}}),close:async()=>{},disconnect:async()=>{}})}});
const {generateToken}=await import('../packages/core/src/utils/auth.js');
// const {GET}=await import('../apps/web/src/app/api/jobs/[jobId]/route.js');
const { buildApp } = await import('../apps/api/src/app.js');
const api = buildApp();
await api.ready();
test.after(async () => { await api.close(); });

const req=(token,cookie)=>({headers:{...(token?{authorization:`Bearer ${token}`}:{}) ,...(cookie?{cookie}:{})}});
const GET = async (r, p) => {
  const { jobId } = await p.params;
  const res = await api.inject({ method: 'GET', url: `/api/jobs/${jobId}`, headers: r.headers });
  return { status: res.statusCode };
};
test('protected polling checks current status/session and cannot downgrade a revoked bearer to guest',async()=>{
 const token=generateToken({id:1,role:'student',session_token:'one'}),params={params:Promise.resolve({jobId:'job'})};
 assert.equal((await GET(req(token),params)).status,200);
 users.get(1).status='inactive';assert.equal((await GET(req(token),params)).status,401);
 users.get(1).status='active';users.get(1).session_token='rotated';assert.equal((await GET(req(token),params)).status,401);
 assert.equal((await GET(req('bad-token','coderank_execution_session='+'a'.repeat(64)),params)).status,401);
 unavailable=true;assert.equal((await GET(req(token),params)).status,503);unavailable=false;
});
test('revoked faculty tokens are rejected before a mutation reaches the domain layer',async()=>{
 const token=generateToken({id:2,role:'faculty',session_token:'two'});users.get(2).status='inactive';
 const res = await api.inject({
   method: 'DELETE',
   url: '/api/faculty/practicals/1',
   headers: { authorization: `Bearer ${token}` },
 });
 assert.equal(res.statusCode, 401);
});
