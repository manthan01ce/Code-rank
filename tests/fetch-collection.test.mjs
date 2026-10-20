import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchCollection } from '../apps/web/src/lib/fetch-collection.js';
test('selector follows bounded pages, encodes cursor and preserves credentials',async t=>{
 const calls=[];t.mock.method(globalThis,'fetch',async(url,options)=>{calls.push({url,options});return new Response(JSON.stringify([{id:calls.length}]),{headers:{'X-Next-Cursor':calls.length===1?'a/b+':''}});});
 const options={headers:{Authorization:'Bearer test'}};
 assert.deepEqual(await fetchCollection('/api/list',options),[{id:1},{id:2}]);
 assert.equal(calls[1].url,'/api/list?cursor=a%2Fb%2B');assert.equal(calls[1].options,options);
});
test('selector stops on repeated cursors and rejects failed responses',async t=>{
 t.mock.method(globalThis,'fetch',async()=>new Response('[]',{headers:{'X-Next-Cursor':'same'}}));
 await assert.rejects(fetchCollection('/api/list?q=x'),/Repeated/);
 globalThis.fetch=async()=>new Response('{}',{status:403});await assert.rejects(fetchCollection('/api/list'),/403/);
});
