import { discoverLanes } from './test-lanes.mjs';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { testConfiguration } from './run-tests.mjs';
import { verifyTap } from './verify-tap.mjs';
import os from 'node:os';

// Playwright's summary alone cannot prove that every discovered spec ran.
export function validateBrowserEvidence(report, expectedFiles, root) {
  const specs = [];
  const walk = suites => {
    for (const suite of suites || []) {
      specs.push(...(suite.specs || []));
      walk(suite.suites);
    }
  };
  walk(report?.suites);
  const actual = new Set();
  let count = 0;
  for (const spec of specs) {
    if (!spec.file || spec.ok !== true || !spec.tests?.length) throw Error('Incomplete browser spec evidence');
    actual.add(relative(root, resolve(report.config?.rootDir || root, spec.file)).replaceAll('\\', '/'));
    for (const run of spec.tests) {
      if (run.expectedStatus !== 'passed' || run.status !== 'expected' || run.results?.length !== 1 || run.results[0].status !== 'passed') throw Error('Browser tests must pass without retries, skips or expected failures');
      count++;
    }
  }
  if (!count || report.stats?.expected !== count || report.errors?.length || ['unexpected', 'flaky', 'skipped'].some(key => report.stats[key] !== 0)) throw Error('Incomplete browser result evidence');
  const expected = [...expectedFiles].sort();
  if (!expected.length || new Set(expected).size !== expected.length || JSON.stringify([...actual].sort()) !== JSON.stringify(expected)) throw Error('Browser file evidence does not match discovered specs');
}

export function validateSystemEvidence({ browser, frontend, capacity, recovery, database, topology }) {
  if (topology?.status !== 'passed' || ['standardWeb','api','worker','gateway','websocket','guestOwnership'].some(key => topology[key] !== true)) throw Error('Container topology gate incomplete');
  if (['apiOutageWebAvailable','serviceRestart','dependencyCrashRecovery','volumeContinuity','applicationRollback','executionAfterRecovery','workerOnlyDocker'].some(key => topology.durability?.[key] !== true)) throw Error('Container durability/rollback gate incomplete');
  if (!/^[a-f0-9]{40}$/.test(topology.durability?.priorSource || '') || !/^sha256:[a-f0-9]{64}$/.test(topology.durability?.priorApiImage || '')) throw Error('Prior rollback artifact identity missing');
  const currentApiImage = topology.durability.currentImages?.api?.image;
  if (!/^sha256:[a-f0-9]{64}$/.test(currentApiImage || '') || currentApiImage === topology.durability.priorApiImage) throw Error('Rollback must use distinct prior/current API images');
  if (!(browser?.stats?.expected > 0) || ['unexpected','flaky','skipped'].some(key => browser.stats[key] !== 0)) throw Error('Browser gate incomplete');
  if (!(frontend?.stats?.expected > 0) || ['unexpected','flaky','skipped'].some(key => frontend.stats[key] !== 0)) throw Error('Faculty frontend gate incomplete');
  if (capacity?.passed !== true || capacity.completed !== capacity.workload?.jobsRequested || capacity.failures?.length !== 0) throw Error('Capacity gate incomplete');
  if (![recovery?.webReplacementMs,recovery?.executionRecoveryMs].every(value => Number.isFinite(value) && value > 0)) throw Error('Process recovery gate incomplete');
  if (database?.status !== 'complete' || !database.completedAt) throw Error('Database recovery gate incomplete');
}

export function assertCertifiableLanes(lanes) {
  if (!Array.isArray(lanes?.quarantine) || lanes.quarantine.length || !lanes.docker?.includes('tests/docker/batch-execution.test.js')) throw Error('Cannot certify with quarantined coverage pending real Docker validation');
}

export function validateWarmEvidence(report, commit, hashes) {
  if (report?.status !== 'passed' || report.commit !== commit || report.dirty !== false || report.imageCleanup !== 'removed' || !/^sha256:[a-f0-9]{64}$/.test(report.imageId || '')) throw Error('Warm retirement source/image acceptance incomplete');
  if (JSON.stringify((report.configurations || []).map(item => item.name).sort()) !== JSON.stringify(['ci','cold','containers','local-database'])) throw Error('Warm retirement configuration coverage incomplete');
  if (!report.commands?.length || report.commands.some(command => command.exitCode !== 0) || report.tests?.ok !== true) throw Error('Warm retirement commands/tests did not pass');
  for (const file of ['docker.tap','docker.files.json']) if (report.artifacts?.[`test-results/${file}`] !== hashes[file]) throw Error('Warm retirement test hashes disagree');
}

export async function writeCertification(root, env = process.env) {
  if (env.GITHUB_ACTIONS !== 'true' || !/^[a-f0-9]{40}$/.test(env.GITHUB_SHA || '') || !/^\d+$/.test(env.GITHUB_RUN_ID || '')) throw Error('A completed GitHub Actions run is required');
  const sha = execFileSync('git', ['rev-parse','HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  if (sha !== env.GITHUB_SHA) throw Error('Evidence must match the tested commit');
  const lanes = await discoverLanes(root);
  assertCertifiableLanes(lanes);
  const files = {}, suites = {};
  const read = async path => {
    const contents = await readFile(resolve(root,'test-results',path), 'utf8');
    files[path] = createHash('sha256').update(contents).digest('hex');
    return contents;
  };
  for (const mode of ['unit','integration','docker']) {
    const config = await testConfiguration(mode, root);
    const executed = JSON.parse(await read(`${mode}.files.json`));
    const result = verifyTap(await read(`${mode}.tap`), { args: config.args, expectedFiles: config.files, executedFiles: executed.executedFiles, requireFileEvidence: true });
    if (!result.ok) throw Error(`${mode} evidence rejected: ${result.errors.join('; ')}`);
    suites[mode] = result.counts;
  }
  const evidence = {};
  for (const [name,path] of Object.entries({ topology:'container-topology.json', browser:'browser-results.json', frontend:'faculty-review-results.json', capacity:'authenticated/capacity.json', recovery:'authenticated/process-recovery.json', database:'authenticated/database-recovery/manifest.json' })) evidence[name] = JSON.parse(await read(path));
  validateSystemEvidence(evidence);
  validateBrowserEvidence(evidence.browser, lanes.browser, root);
  validateBrowserEvidence(evidence.frontend, lanes.frontend, root);
  validateWarmEvidence(JSON.parse(await read('warm-disposition.json')), sha, files);
  const report = {
    status: 'passed', commit: sha, tree: execFileSync('git',['rev-parse','HEAD^{tree}'],{cwd:root,encoding:'utf8'}).trim(), testedAt: new Date().toISOString(),
    environment: { node: process.version, os: os.platform(), kernel: os.release(), arch: os.arch(), cpuModel: os.cpus()[0]?.model, logicalCPUs: os.cpus().length, memoryBytes: os.totalmem(), docker: execFileSync('docker',['--version'],{encoding:'utf8'}).trim(), compose: execFileSync('docker',['compose','version','--short'],{encoding:'utf8'}).trim() },
    scope: 'This commit on the CI test host: three independent application images through an infrastructure gateway, real container execution/WebSockets, PostgreSQL/Redis, two standard Next.js replicas, browser workflows, process/database recovery and measured workload.',
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
