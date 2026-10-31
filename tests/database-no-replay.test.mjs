import test,{mock} from 'node:test';
import assert from 'node:assert/strict';
process.env.DATABASE_DRIVER='postgres';process.env.DATABASE_URL='postgresql://test';
let calls=0;
const uncertain=async()=>{calls++;throw Object.assign(Error('connection lost after commit'),{code:'ECONNRESET'});};
mock.module(new URL('../packages/database/src/postgres.js',import.meta.url).href,{namedExports:{createPostgresClient:()=>Object.assign(uncertain,{query:uncertain,transaction:uncertain})}});
const {default:sql}=await import('../packages/database/src/client.js');
test('uncertain writes and native transactions are never automatically replayed',async()=>{
 for(const write of [()=>sql`INSERT INTO users(name) VALUES(${'test'})`,()=>sql.query('SELECT coderank_manage_user($1)',[1]),()=>sql.transaction(()=>[])]){
  calls=0;await assert.rejects(write(),/connection lost/);assert.equal(calls,1);
 }
 calls=0;await assert.rejects(sql.readQuery('SELECT id FROM users',[],{budgetMs:100,delayMs:1}),/connection lost/);assert.equal(calls,3);
});
