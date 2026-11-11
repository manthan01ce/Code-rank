import { dockerCommand } from './docker.js';
import { SANDBOX_OWNER, SANDBOX_PREFIX, sandboxScope } from './metadata.js';

export async function readSandboxContainers(run = dockerCommand) {
  try {
    const {stdout}=await run(['ps','--filter','label=coderank.sandbox=true','--filter',`label=${SANDBOX_PREFIX}owner=${SANDBOX_OWNER}`,'--filter',`label=${SANDBOX_PREFIX}scope=${sandboxScope()}`,'--format','{{.ID}}'],{timeout:2000});
    const ids=stdout.trim().split('\n').filter(Boolean);
    if(ids.length>128 || ids.some(id=>!/^[a-f0-9]{12,64}$/.test(id))) throw Error('Invalid container observation');
    return {status:'measured',running:ids.length,observedAt:Date.now()};
  } catch { return {status:'unavailable',running:null,observedAt:Date.now()}; }
}
