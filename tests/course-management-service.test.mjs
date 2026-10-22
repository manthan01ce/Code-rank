import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
let calls = [];
let failure;
mock.module('../packages/core/src/db/client.js', { defaultExport: { query: async (...args) => { calls.push(args); if (failure) throw failure; return [{ item: { id: 3, name: 'CS' } }]; } } });
const { CourseManagementService, validateCatalog } = await import('../packages/core/src/modules/courses/CourseManagementService.js');

test('catalog service validates payloads and identifiers before database access', async () => {
 calls = []; failure = undefined;
 for (const body of [null, [], {}, {name:'CS',course_code:'CS',semester:true}, {name:'CS',course_code:'CS',semester:'1junk'}, {name:'CS',course_code:'CS',semester:0}, {name:'CS',course_code:'CS',semester:1.5}]) {
  await assert.rejects(CourseManagementService.mutate({id:1,role:'admin'},'course',null,'create',body),e=>e.status===400);
 }
 await assert.rejects(CourseManagementService.mutate(null,'course',null,'create',{}),e=>e.status===401);
 await assert.rejects(CourseManagementService.mutate({id:1,role:'admin'},'course','3junk','delete'),e=>e.status===400);
 assert.equal(calls.length,0);
 assert.deepEqual(validateCatalog('course',{name:' CS ',course_code:' CS1 ',semester:'2',ignore:'x'}),{name:'CS',course_code:'CS1',semester:2});
 assert.deepEqual(validateCatalog('department',{name:' CE ',institute_name:' College '}),{name:'CE',institute_name:'College'});
});

test('catalog service delegates one parameterized atomic write and maps database errors',async()=>{
 calls=[]; failure=undefined;
 const actor={id:1,role:'admin'};
 assert.deepEqual(await CourseManagementService.mutate(actor,'course',null,'create',{name:'CS',course_code:'CS1',semester:1}),{id:3,name:'CS'});
 assert.equal(calls.length,1);
 assert.deepEqual(calls[0][1],[1,'course',null,'create',JSON.stringify({name:'CS',course_code:'CS1',semester:1})]);
 for (const [code,status] of [['23505',409],['23503',409],['42501',403],['P0002',404],['22023',400]]) {
  failure={code,message:'expected error'};
  await assert.rejects(CourseManagementService.mutate(actor,'department',3,'delete'),error=>error.status===status);
 }
 const infra=new Error('database unavailable');failure=infra;
 await assert.rejects(CourseManagementService.mutate(actor,'department',3,'delete'),error=>error===infra);
});
