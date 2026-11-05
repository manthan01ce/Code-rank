// Explicit local acceptance CLI: only test-owned images/sandboxes.
// Never start Compose application services, migrate data or dispatch CI.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runTestMode } from './run-tests.mjs';
import { supportedCompose } from './local-lab-audit.mjs';
const root = fileURLToPath(new URL('../../', import.meta.url));
const output = resolve(root, 'test-results/warm-disposition.json');
const temporary = mkdtempSync(join(tmpdir(), 'coderank-compose-'));
const fixture = join(temporary, 'fixture.env');
writeFileSync(fixture, '');
const sourceCommit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
const image = `coderank-warm-retirement:${sourceCommit.slice(0,12)}-${randomUUID().slice(0,8)}`;
const environment = { ...process.env, DATABASE_URL: 'postgresql://fixture:fixture@postgres/fixture', JWT_SECRET: 'disposable-compose-fixture', POSTGRES_PASSWORD: 'disposable-fixture', USE_WARM_DAEMONS: 'false', RUNNER_IMAGE: image };
const hash = file => createHash('sha256').update(readFileSync(resolve(root, file))).digest('hex');
const report = {
  scope: 'warm-retirement-and-cold-regression', status: 'blocked',
  commit: sourceCommit,
  tree: execFileSync('git', ['rev-parse', 'HEAD^{tree}'], { cwd: root, encoding: 'utf8' }).trim(),
  dirty: Boolean(execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }).trim()),
  startedAt: new Date().toISOString(), imageReference: image, imageId: null,
  canonicalDockerfileSha256: hash('infrastructure/docker/runner/Dockerfile'), commands: [], configurations: [],
};
let stage = 'prerequisites';
let imageBuilt = false;
function docker(args) {
  try {
    const stdout = execFileSync('docker', args, { cwd: root, env: environment, encoding: 'utf8', timeout: args[0] === 'build' ? 300000 : 20000, maxBuffer: 4 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
    report.commands.push({ command: ['docker', ...args], exitCode: 0 });
    return stdout;
  } catch (error) {
    report.commands.push({ command: ['docker', ...args], exitCode: error.status ?? null, code: error.code ?? null });
    const unavailable = error.code === 'ENOENT' || /cannot connect|is the docker daemon running|error during connect/i.test(String(error.stderr || ''));
    throw Object.assign(new Error(error.code === 'ENOENT' ? 'Docker CLI unavailable' : `Docker ${stage} command failed`), { unavailable });
  }
}
try {
  if (existsSync(resolve(root, 'infrastructure/compose.warm-daemons.yaml'))) throw Error('Retired overlay is still deployable');
  report.composeVersion = docker(['compose', 'version', '--short']).trim();
  if (!supportedCompose(report.composeVersion)) throw Error('Compose 2.24.4+ is required');
  stage = 'configuration';
  for (const [name, overlays, profiles] of [
    ['cold', [], []], ['local-database', [], ['local-database']],
    ['containers', ['infrastructure/compose.containers.yaml'], ['local-database']],
    ['ci', ['infrastructure/compose.containers.yaml', 'infrastructure/compose.ci.yaml'], ['local-database']],
  ]) {
    const args = ['compose', '--env-file', fixture, '-f', 'infrastructure/docker-compose.yml', ...overlays.flatMap(file => ['-f', file]), ...profiles.flatMap(profile => ['--profile', profile]), 'config', '--format', 'json'];
    const config = JSON.parse(docker(args));
    // Record projections only: never publish expanded environment values or .env.
    report.configurations.push({ name, services: Object.keys(config.services).sort(), volumes: Object.fromEntries(Object.entries(config.volumes || {}).map(([key, value]) => [key, value.name])) });
    if (Object.keys(config.services).some(service => /daemon/.test(service))) throw Error('A cold configuration still deploys warm daemons');
    for (const [service, definition] of Object.entries(config.services)) {
      if ((definition.volumes || []).some(volume => volume.target === '/var/run/docker.sock') && service !== 'worker') throw Error('Only worker may receive Docker access');
    }
    const runnerBuild = config.services['runner-image']?.build;
    if (runnerBuild && resolve(runnerBuild.context, runnerBuild.dockerfile) !== resolve(root, 'infrastructure/docker/runner/Dockerfile')) throw Error('Compose runner image bypasses the canonical Dockerfile');
  }
  stage = 'daemon';
  report.serverVersion = docker(['info', '--format', '{{.ServerVersion}}']).trim();
  stage = 'build';
  // Minimal build context contains only the canonical Dockerfile, never app .env.
  docker(['build', '--label', `coderank.acceptance.source=${sourceCommit}`, '--label', `coderank.acceptance.dockerfile=${report.canonicalDockerfileSha256}`, '-t', image, '-f', resolve(root, 'infrastructure/docker/runner/Dockerfile'), resolve(root, 'infrastructure/docker/runner')]);
  imageBuilt = true;
  stage = 'image';
  const before = JSON.parse(docker(['image', 'inspect', image]))[0];
  if (before.Config?.Labels?.['coderank.acceptance.source'] !== sourceCommit || before.Config?.Labels?.['coderank.acceptance.dockerfile'] !== report.canonicalDockerfileSha256) throw Error('Built image provenance does not match source');
  report.imageId = before.Id; report.repoDigests = before.RepoDigests || [];
  stage = 'tests';
  const prior = { USE_WARM_DAEMONS: process.env.USE_WARM_DAEMONS, RUNNER_IMAGE: process.env.RUNNER_IMAGE };
  try {
    process.env.USE_WARM_DAEMONS = 'false'; process.env.RUNNER_IMAGE = image;
    report.tests = await runTestMode('docker');
  } finally {
    for (const [key, value] of Object.entries(prior)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
  }
  if (JSON.parse(docker(['image', 'inspect', image]))[0].Id !== report.imageId) throw Error('Runner image changed during acceptance');
  report.artifacts = Object.fromEntries(['test-results/docker.tap', 'test-results/docker.files.json'].map(file => [file, hash(file)]));
  report.status = 'passed';
} catch (error) {
  report.status = error.unavailable ? 'blocked' : 'failed'; report.error = `${stage}: ${error.message}`;
  process.exitCode = 1;
} finally {
  if (imageBuilt) {
    try { docker(['image', 'rm', image]); report.imageCleanup = 'removed'; }
    catch { report.imageCleanup = 'failed'; report.status = 'failed'; process.exitCode = 1; }
  }
  rmSync(temporary, { recursive: true, force: true });
  report.finishedAt = new Date().toISOString(); mkdirSync(resolve(root, 'test-results'), { recursive: true });
  writeFileSync(output, JSON.stringify(report, null, 2)+'\n');
  console.log(`Warm disposition acceptance ${report.status}; report test-results/warm-disposition.json`);
}
