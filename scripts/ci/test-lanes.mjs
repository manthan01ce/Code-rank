import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
export const repositoryRoot = fileURLToPath(new URL('../../', import.meta.url));
export function validateTestInventory(discovered, manifest) {
  if (!discovered.length) throw Error('Empty test inventory');
  if (new Set(discovered).size !== discovered.length) throw Error('Duplicate discovered test');
  const names = ['unit', 'architecture', 'integration', 'docker', 'neon', 'browser', 'frontend', 'performance', 'quarantine'];
  for (const [name, files] of Object.entries(manifest.categories)) {
    if (!names.includes(name) || !Array.isArray(files)) throw Error('Unknown or invalid test category');
    if (files.some(file => typeof file !== 'string' || !/^tests\/(?:[^./][^/]*\/)*[^/]+\.(?:test|spec)\.(?:mjs|js)$/.test(file))) throw Error('Invalid test path');
  }
  const assigned = Object.values(manifest.categories).flat();
  if (new Set(assigned).size !== assigned.length) throw Error('Duplicate test lane membership');
  for (const name of ['unit', 'architecture', 'integration', 'docker', 'neon', 'browser', 'frontend', 'performance']) {
    if (!manifest.categories[name]?.length) throw Error(`Empty or missing category: ${name}`);
  }
  const known = new Set(assigned), actual = new Set(discovered);
  for (const file of discovered) if (!known.has(file)) throw Error(`Unassigned test: ${file}`);
  for (const file of assigned) if (!actual.has(file)) throw Error(`Missing test: ${file}`);
  if (!manifest.quarantine || Object.values(manifest.quarantine).some(reason => typeof reason !== 'string' || !reason.trim())) throw Error('Quarantine requires a reason');
  const quarantined = manifest.categories.quarantine || [];
  if (JSON.stringify([...quarantined].sort()) !== JSON.stringify(Object.keys(manifest.quarantine).sort())) throw Error('Quarantine reasons and inventory disagree');
  return manifest.categories;
}
export async function discoverLanes(root = repositoryRoot) {
  async function walk(directory) {
    const entries = await readdir(resolve(root, directory), { withFileTypes: true });
    const files = await Promise.all(entries.map(e => e.isDirectory() ? walk(`${directory}/${e.name}`) : [`${directory}/${e.name}`]));
    return files.flat();
  }
  const discovered = (await walk('tests')).filter(f => /\.(?:test|spec)\.(?:mjs|js)$/.test(f)).sort();
  const manifest = JSON.parse(await readFile(resolve(root, 'tests/lane-manifest.json'), 'utf8'));
  return validateTestInventory(discovered, manifest);
}
export async function filesFor(mode, root = repositoryRoot) {
  const categories = await discoverLanes(root);
  // Explicit candidate command does not retire quarantine or count as Docker certification.
  if (mode === 'batch') {
    const files = [...categories.docker, ...(categories.quarantine || [])].filter(file => file === 'tests/docker/batch-execution.test.js');
    if (files.length !== 1) throw Error('Missing batch-execution candidate');
    return files;
  }
  if (mode === 'redis') return categories.integration.filter(file => !file.endsWith('/postgres.test.mjs'));
  if (mode === 'postgres') return categories.integration.filter(file => file.endsWith('/postgres.test.mjs'));
  if (mode === 'unit') return [...categories.unit, ...categories.architecture].sort();
  if (!Object.hasOwn(categories, mode) || mode === 'quarantine') throw Error('Unknown or quarantined test lane');
  return [...categories[mode]];
}

// Performance measurements copy this harness onto a historical baseline. Only
// the selected browser files are required there; normal gates reconcile all files.
export async function browserFiles(mode, root = repositoryRoot) {
  if (!['browser', 'frontend', 'performance'].includes(mode)) throw Error('Unknown browser lane');
  const categories = mode === 'performance'
    ? JSON.parse(await readFile(resolve(root, 'tests/lane-manifest.json'), 'utf8')).categories
    : await discoverLanes(root);
  const files = categories[mode];
  if (!Array.isArray(files) || !files.length || new Set(files).size !== files.length) throw Error('Empty or duplicate browser lane');
  for (const file of files) await readFile(resolve(root, file));
  return [...files];
}
