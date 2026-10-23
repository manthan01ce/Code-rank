// Provision a real matching Chromium and verify launch before installing OS packages.
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {chromium} from '@playwright/test';
const cli='node_modules/@playwright/test/cli.js';
let installed=false;
for(let attempt=1;attempt<=2;attempt++) {
  const result=spawnSync(process.execPath,[cli,'install','chromium'],{
    stdio:'inherit',timeout:180000,env:{...process.env,PLAYWRIGHT_DOWNLOAD_CONNECTION_TIMEOUT:'60000'}
  });
  if(result.status===0){installed=true;break;}
  console.error(`Chromium download attempt ${attempt} failed${result.error?.code ? ` (${result.error.code})` : ''}`);
}
assert.ok(installed,'Matching Chromium download must succeed');
async function probe() {
  const browser=await chromium.launch({headless:true,timeout:30000});
  try {
    const page=await browser.newPage();
    await page.setContent('<main>Browser ready</main>',{timeout:10000});
    assert.equal(await page.locator('main').textContent(),'Browser ready');
  }finally{await browser.close();}
}
try {await probe();}
catch(error) {
  console.error('Chromium launch/render probe failed; installing OS dependencies:',error.message);
  // Never replay a timed-out apt invocation: it may still hold the package lock.
  const result=spawnSync(process.execPath,[cli,'install-deps','chromium'],{
    stdio:'inherit',timeout:360000,env:{...process.env,DEBIAN_FRONTEND:'noninteractive'}
  });
  assert.equal(result.status,0,'OS dependency installation must complete successfully');
  await probe();
}
console.log('Matching Chromium launch and render verified');
