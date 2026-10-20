import { Sandbox } from '../../packages/runner/src/Sandbox.js';
const sandbox=new Sandbox();
try {
  await sandbox.start();
  process.send({name:sandbox.name});
  // The recovery drill SIGKILLs this process, bypassing its finally/cleanup.
  setInterval(()=>{},1000);
} catch(error) {
  process.send({error:error.message});
  process.exitCode=1;
}
