import test from 'node:test';
import assert from 'node:assert/strict';
import { migrate } from '../packages/database/src/migrations.js';
test('migration SQL errors survive a database outage during reconciliation',async()=>{
 for(const code of ['23514','23505']){
  const original=Object.assign(Error('original migration failure'),{code});let failed=false;
  const adapter={query:async()=>{if(failed)throw Error('network unavailable');return [];},apply:async()=>{failed=true;throw original;}};
  await assert.rejects(migrate(adapter,new URL('../database/migrations/',import.meta.url)),error=>error===original);
 }
});
