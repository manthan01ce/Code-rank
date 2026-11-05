// Read-only evidence collection. This never issues a lab/production certificate,
// starts services, applies migrations, seeds data or invokes expensive CI.
import { readFile, stat, mkdir, writeFile, realpath } from 'node:fs/promises';
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpus, totalmem, platform, release, arch } from 'node:os';
import { resolve, relative, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { discoverLanes } from './test-lanes.mjs';
import { verifyTap } from './verify-tap.mjs';
import { testConfiguration } from './run-tests.mjs';
import { assertCertifiableLanes, validateBrowserEvidence, validateSystemEvidence, validateWarmEvidence } from './write-certification.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const requiredRows = ['api-features','faculty-review','users-pdf','auth-sign-in','home-catalog-practicals','shared-layout','shared-client-styles','core-policy','core-facades','database-assets','worker-orchestration','runner-grouping','sandbox-warm','queue-contract','test-lanes-batch','scripts-assets-docs','load-tests','topology-optional-paths'];
const runtimeGroups = ['builds-compose','startup-volume-continuity','role-workflows','faculty-student','sandbox-privacy','replica-realtime','outage-recovery','backup-restore','capacity','host-lan','rollback','final-head-ci'];

export function assessMatrix(matrix) {
  const errors = [];
  const ids = matrix.rows.map(row => row.id);
  if (new Set(ids).size !== ids.length || JSON.stringify([...ids].sort()) !== JSON.stringify([...requiredRows].sort())) errors.push('Move-map coverage is missing, duplicated or unexpected');
  const runtime = matrix.runtimeRequirements.map(row => row.id);
  if (new Set(runtime).size !== runtime.length || JSON.stringify([...runtime].sort()) !== JSON.stringify([...runtimeGroups].sort())) errors.push('Runtime requirement coverage is incomplete');
  for (const row of matrix.rows) {
    if (!['implemented', 'retained-documented'].includes(row.structuralState)) errors.push(`${row.id}: ${row.finding}`);
    if (!row.paths?.length || !row.tests?.length || !row.finding) errors.push(`${row.id}: empty source/test/disposition evidence`);
  }
  return errors;
}

export function assessPredecessors(rows, finalHeadCertified = false) {
  const errors = [];
  const issues = rows.map(row => row.issue).sort((a,b) => a-b);
  if (JSON.stringify(issues) !== JSON.stringify(Array.from({length:11}, (_,i) => i+70))) errors.push('Predecessor inventory must include #70 through #80 exactly once');
  for (const row of rows) {
    if (row.merged !== true || !/^[a-f0-9]{40}$/.test(row.head || '') || !/^[a-f0-9]{40}$/.test(row.merge || '')) errors.push(`#${row.issue}: missing merged/head evidence`);
    for (const name of ['Fast PR & Commit Checks', 'Architecture checks']) {
      const run = row.runs?.find(run => run.name === name);
      if (!finalHeadCertified && (run?.status !== 'completed' || run.conclusion !== 'success')) errors.push(`#${row.issue}: ${name} is ${run?.conclusion || 'missing'}, not a passing gate`);
    }
  }
  return errors;
}

export function assessHost(record, { commit, tree, hardwareHash }) {
  const errors = [];
  if (record?.scope !== 'intended-local-lab' || record.commit !== commit || record.tree !== tree || record.hardwareHash !== hardwareHash) errors.push('Intended-host evidence must match this exact commit, tree and observed hardware');
  try {
    const lan = new URL(record.lanUrl);
    if (!['http:','https:'].includes(lan.protocol) || lan.username || lan.password || ['localhost','127.0.0.1','[::1]'].includes(lan.hostname)) throw Error();
  } catch { errors.push('A credential-free LAN client URL is required; loopback/CI is not LAN acceptance'); }
  const groups = record?.requirements || [];
  if (JSON.stringify(groups.map(row => row.id).sort()) !== JSON.stringify([...runtimeGroups].sort())) errors.push('Intended-host evidence must cover every runtime requirement exactly once');
  for (const group of groups) {
    if (group.status !== 'passed' || group.exitCode !== 0 || !group.artifacts?.length || !group.command) errors.push(`${group.id}: missing successful command and real report artifacts`);
  }
  return errors;
}

// Artifact paths may only refer to ignored test-owned output, never .env or
// arbitrary operator files. Only hashes/path metadata are emitted by this audit.
export async function artifactHash(path, expected, repository = root) {
  const directory = resolve(repository, 'test-results');
  const target = resolve(repository, path);
  const rel = relative(directory, target);
  if (!rel || rel.startsWith('..') || isAbsolute(rel)) throw Error('Evidence must be inside test-results');
  const actualTarget = await realpath(target), actualDirectory = await realpath(directory);
  const directoryRelative = relative(await realpath(repository), actualDirectory);
  if (directoryRelative.startsWith('..') || isAbsolute(directoryRelative)) throw Error('test-results directory escapes repository');
  const actualRelative = relative(actualDirectory, actualTarget);
  if (!actualRelative || actualRelative.startsWith('..') || isAbsolute(actualRelative)) throw Error('Evidence symlink escapes test-results');
  const bytes = await readFile(actualTarget);
  if (!bytes.length) throw Error(`Empty artifact: ${path}`);
  const actual = digest(bytes);
  if (expected && expected !== actual) throw Error(`Artifact hash mismatch: ${path}`);
  return actual;
}

export function supportedCompose(version) {
  const parts = /^v?(\d+)\.(\d+)\.(\d+)(?:\D|$)/.exec(version);
  if (!parts) return false;
  const actual = parts.slice(1,4).map(Number), minimum = [2,24,4];
  for (let i=0;i<3;i++) if (actual[i] !== minimum[i]) return actual[i] > minimum[i];
  return true;
}

function probe(command, args) {
  const result = spawnSync(command, args, { encoding:'utf8', timeout:10000, maxBuffer:65536 });
  return { available:result.status === 0, exitCode:result.status, error:result.error?.code || null, version:result.status === 0 ? result.stdout.trim().slice(0,200) : null };
}

export async function auditLocalLab(repository = root) {
  const output = resolve(repository,'test-results/local-lab/audit.json');
  await mkdir(resolve(repository,'test-results/local-lab'),{recursive:true});
  // An early discovery/tool error must not leave a previous ready report usable.
  await writeFile(output,'');
  const git = args => execFileSync('git', args, {cwd:repository, encoding:'utf8'}).trimEnd();
  const commit = git(['rev-parse','HEAD']), tree = git(['rev-parse','HEAD^{tree}']);
  const hardware = {platform:platform(),release:release(),arch:arch(),cpuModel:cpus()[0]?.model || 'unknown',logicalCPUs:cpus().length,memoryBytes:totalmem()};
  const hardwareHash = digest(JSON.stringify(hardware));
  const json = async path => JSON.parse(await readFile(resolve(repository,path), 'utf8'));
  const matrix = await json('docs/architecture/local-lab-matrix.json');
  const snapshot = await json('docs/architecture/local-lab-predecessors.json');
  const errors = assessMatrix(matrix), reportHashes = {};
  for (const row of matrix.rows) for (const path of [...row.paths, ...row.tests]) {
    try { await stat(resolve(repository,path)); } catch { errors.push(`${row.id}: missing reference ${path}`); }
  }
  const sourceChanges = git(['status','--porcelain','--untracked-files=normal']).split('\n').filter(line => line && !line.slice(3).startsWith('test-results/'));
  if (sourceChanges.length) errors.push('Source working tree is dirty; evidence cannot represent final HEAD');
  const tools = {docker:probe('docker',['info','--format','{{.ServerVersion}}']),compose:probe('docker',['compose','version','--short']),pgDump:probe(process.env.PG_DUMP_BIN || 'pg_dump',['--version']),pgRestore:probe(process.env.PG_RESTORE_BIN || 'pg_restore',['--version'])};
  for (const [name, result] of Object.entries(tools)) if (!result.available) errors.push(`${name} is unavailable`);
  if (tools.compose.available && !supportedCompose(tools.compose.version)) errors.push('Compose 2.24.4 or later is required');
  const lanes = await discoverLanes(repository);
  try { assertCertifiableLanes(lanes); } catch (error) { errors.push(error.message); }
  let finalHeadCertified = false;
  try {
    const certificate = await json('test-results/certification.json');
    if (certificate.status !== 'passed' || certificate.commit !== commit || !/^https:\/\/github\.com\/manthan01ce\/Code-rank\/actions\/runs\/\d+$/.test(certificate.run || '')) throw Error('CI evidence is not passing evidence for this exact commit');
    const expected = ['unit.tap','unit.files.json','integration.tap','integration.files.json','docker.tap','docker.files.json','warm-disposition.json','container-topology.json','browser-results.json','faculty-review-results.json','authenticated/capacity.json','authenticated/process-recovery.json','authenticated/database-recovery/manifest.json'];
    for (const name of expected) {
      if (!certificate.evidenceSha256?.[name]) throw Error(`CI evidence lacks ${name}`);
      reportHashes[name] = await artifactHash(`test-results/${name}`, certificate.evidenceSha256[name], repository);
    }
    for (const mode of ['unit','integration','docker']) {
      const config = await testConfiguration(mode,repository);
      const evidence = await json(`test-results/${mode}.files.json`);
      const verdict = verifyTap(await readFile(resolve(repository,`test-results/${mode}.tap`),'utf8'),{args:config.args,expectedFiles:config.files,executedFiles:evidence.executedFiles,requireFileEvidence:true});
      if (!verdict.ok) throw Error(`${mode} TAP/file evidence rejected`);
    }
    const system = {};
    for (const [key,path] of Object.entries({topology:'container-topology.json',browser:'browser-results.json',frontend:'faculty-review-results.json',capacity:'authenticated/capacity.json',recovery:'authenticated/process-recovery.json',database:'authenticated/database-recovery/manifest.json'})) system[key] = await json(`test-results/${path}`);
    validateSystemEvidence(system);
    validateWarmEvidence(await json('test-results/warm-disposition.json'), commit, certificate.evidenceSha256);
    validateBrowserEvidence(system.browser,lanes.browser,repository);
    validateBrowserEvidence(system.frontend,lanes.frontend,repository);
    finalHeadCertified = true;
  } catch (error) { errors.push(`Strict final-head CI evidence unavailable: ${error.code || error.message}`); }
  errors.push(...assessPredecessors(snapshot.predecessors, finalHeadCertified));
  for (const row of snapshot.predecessors) {
    const ancestry = spawnSync('git',['merge-base','--is-ancestor',row.merge,'HEAD'],{cwd:repository});
    if (ancestry.status !== 0) errors.push(`#${row.issue}: merged change is not verifiable as an ancestor (missing history or different checkout)`);
  }
  try {
    const host = await json('test-results/local-lab/host-evidence.json');
    errors.push(...assessHost(host,{commit,tree,hardwareHash}));
    for (const group of host.requirements || []) for (const artifact of group.artifacts || []) {
      if (!/^[a-f0-9]{64}$/.test(artifact.sha256 || '')) throw Error('Host artifacts require SHA-256');
      reportHashes[artifact.path] = await artifactHash(artifact.path,artifact.sha256,repository);
    }
  } catch (error) { errors.push(`Intended lab host/LAN evidence unavailable: ${error.code || error.message}`); }
  const report = {status:errors.length ? 'blocked' : 'ready-for-human-review',labCertified:false,cloudCertified:false,commit,tree,observedAt:new Date().toISOString(),environment:{node:process.version,hardware,hardwareHash,tools},sourceChanges,structuralRows:matrix.rows,predecessors:snapshot.predecessors,folderTree:git(['ls-tree','-rd','--name-only','HEAD']).split('\n'),evidenceSha256:reportHashes,blockers:errors,limitation:'This is an evidence audit, not a certificate or independent proof of host identity. CI cannot certify the intended lab/LAN. Human review and actual host access remain required.'};
  await writeFile(output,JSON.stringify(report,null,2)+'\n');
  return report;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.length !== 2) throw Error('Usage: npm run lab:audit');
  await auditLocalLab().then(report => {
    console.log(JSON.stringify({status:report.status,labCertified:report.labCertified,commit:report.commit,blockers:report.blockers,report:'test-results/local-lab/audit.json'},null,2));
    process.exitCode = report.blockers.length ? 1 : 0;
  }).catch(error => { console.error(error.message); process.exitCode = 1; });
}
