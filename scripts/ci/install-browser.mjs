// Retry only idempotent provisioning. A failed install still fails CI.
import {spawnSync} from 'node:child_process';
for (const args of [['install-deps','chromium'],['install','chromium']]) {
  let success=false;
  for(let attempt=1;attempt<=2;attempt++) {
    const result=spawnSync(process.execPath,['node_modules/@playwright/test/cli.js',...args],{
      stdio:'inherit',timeout:180000,env:{...process.env,DEBIAN_FRONTEND:'noninteractive',PLAYWRIGHT_DOWNLOAD_CONNECTION_TIMEOUT:'60000'}
    });
    if(result.status===0){success=true;break;}
    console.error(`Browser provisioning ${args[0]} attempt ${attempt} failed${result.error?.code ? ` (${result.error.code})` : ''}`);
  }
  if(!success)process.exit(1);
}
