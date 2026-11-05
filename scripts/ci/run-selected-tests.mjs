// Explicit opt-in service aliases retain their previous execution environment.
import { spawn } from 'node:child_process';
import { filesFor, repositoryRoot } from './test-lanes.mjs';
const mode = process.argv[2];
if (process.argv.length !== 3 || !['redis', 'postgres', 'neon'].includes(mode)) throw Error('Expected redis, postgres or neon');
const files = await filesFor(mode);
if (!files.length) throw Error('Empty optional service lane');
const child = spawn(process.execPath, ['--test', ...files], { cwd: repositoryRoot, env: process.env, stdio: 'inherit' });
child.on('error', error => { console.error(error.message); process.exitCode = 1; });
child.on('exit', (code, signal) => { process.exitCode = signal ? 1 : (code ?? 1); });
