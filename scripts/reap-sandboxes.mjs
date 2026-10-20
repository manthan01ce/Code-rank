// Recovery is deployment-scoped and dry-run by default. Only expired,
// versioned CodeRank sandboxes can be removed; names alone are never ownership.
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { reapExpiredSandboxes } from '../packages/runner/src/reaper.js';

export async function reapSandboxCommand(args, reap = reapExpiredSandboxes) {
  let scope, apply = false;
  for (let index = 0; index < args.length; index++) {
    if (args[index] === '--scope' && scope === undefined) scope = args[++index];
    else if (args[index] === '--apply' && !apply) apply = true;
    else throw new Error('Usage: node scripts/reap-sandboxes.mjs --scope <deployment> [--apply]');
  }
  if (!scope) throw new Error('An explicit --scope is required for sandbox recovery');
  return reap({ scope, dryRun: !apply });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const report = await reapSandboxCommand(process.argv.slice(2));
    console.log(JSON.stringify(report, null, 2));
    if (report.errors.length) process.exitCode = 1;
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
