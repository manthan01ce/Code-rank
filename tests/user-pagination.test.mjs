import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
process.env.JWT_SECRET = 'pagination-test-secret';
let observed;
const sql = Object.assign(async()=>[],{query:async(query,params)=>{observed={query,params};return []}});
mock.module(new URL('../packages/core/src/db/client.js',import.meta.url).href,{defaultExport:sql});
const { UserService } = await import('../packages/core/src/services/UserService.js');
test('user queries use bounded keyset pages and validate pagination',async()=>{
 await UserService.listUsers({role:'student',cursor:'91',limit:50,search:"x' OR true --"});
 assert.match(observed.query,/ORDER BY id DESC\s+LIMIT \$\d+/);
 assert.match(observed.query,/id < \$\d+/);
 assert.equal(observed.params.at(-1),50);assert.equal(observed.params.at(-2),91);
 assert.ok(!observed.query.includes("x'"));
 await assert.rejects(UserService.listUsers({limit:201}));
 await assert.rejects(UserService.listUsers({cursor:'bad'}));
});
