import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
test('cluster refuses unshared realtime and invalid worker counts before startup',()=>{
 for(const [env,message] of [[{CLUSTER_ENABLED:'true',REALTIME_REDIS_ENABLED:'false'},'requires REALTIME_REDIS_ENABLED'],[{CLUSTER_ENABLED:'true',REALTIME_REDIS_ENABLED:'true',WEB_CONCURRENCY:'100'},'WEB_CONCURRENCY must be']]){
  const result=spawnSync(process.execPath,['apps/web/cluster.js'],{cwd:new URL('../',import.meta.url),env:{...process.env,...env},encoding:'utf8',timeout:5000});
  assert.notEqual(result.status,0);assert.ok(result.stderr.includes(message),result.stderr);
 }
});
