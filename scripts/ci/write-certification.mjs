import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { testConfiguration } from './run-tests.mjs';
import { verifyTap } from './verify-tap.mjs';

export function validateSystemEvidence({ browser, capacity, recovery, database }) {
  if (!(browser?.stats?.expected > 0) || ['unexpected','flaky','skipped'].some(key => browser.stats[key] !== 0)) throw Error('Browser gate incomplete');
  if (capacity?.passed !== true || capacity.completed !== capacity.workload?.jobsRequested || capacity.failures?.length !== 0) throw Error('Capacity gate incomplete');
  if (![recovery?.webReplacementMs,recovery?.executionRecoveryMs].every(value => Number.isFinite(value) && value > 0)) throw Error('Process recovery gate incomplete');
  if (database?.status !== 'complete' || !database.completedAt) throw Error('Database recovery gate incomplete');
}

export async function writeCertification(root, env = process.env) {
  if (env.GITHUB_ACTIONS !== 'true' || !/^[a-f0-9]{40}$/.test(env.GITHUB_SHA || '') || !/^\d+$/.test(env.GITHUB_RUN_ID || '')) throw Error('A completed GitHub Actions run is required');
  const sha = execFileSync('git', ['rev-parse','HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  if (sha !== env.GITHUB_SHA) throw Error('Evidence must match the tested commit');
  const files = {}, suites = {};
  const read = async path => {
    const contents = await readFile(resolve(root,'test-results',path), 'utf8');
    files[path] = createHash('sha256').update(contents).digest('hex');
    return contents;
  };
  for (const mode of ['unit','integration','docker']) {
    const config = await testConfiguration(mode);
    const result = verifyTap(await read(`${mode}.tap`), { args: config.args, expectedFiles: config.files });
    if (!result.ok) throw Error(`${mode} evidence rejected: ${result.errors.join('; ')}`);
    suites[mode] = result.counts;
  }
  const evidence = {};
  for (const [name,path] of Object.entries({ browser:'browser-results.json', capacity:'authenticated/capacity.json', recovery:'authenticated/process-recovery.json', database:'authenticated/database-recovery/manifest.json' })) evidence[name] = JSON.parse(await read(path));
  validateSystemEvidence(evidence);
  const report = {
    status: 'passed', commit: sha, testedAt: new Date().toISOString(),
    scope: 'This commit on the CI test host: build, isolated Docker execution/recovery, PostgreSQL/Redis, two web replicas, browser workflows and measured test workload.',
    productionCertified: false,
    run: `https://github.com/${env.GITHUB_REPOSITORY}/actions/runs/${env.GITHUB_RUN_ID}`,
    suites, evidenceSha256: files,
  };
  await writeFile(resolve(root,'test-results/certification.json'), JSON.stringify(report,null,2)+'\n');
  return report;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await writeCertification(fileURLToPath(new URL('../../',import.meta.url))).then(report => console.log(JSON.stringify(report))).catch(error => { console.error(error.message); process.exitCode = 1; });
}
