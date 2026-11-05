import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const root = fileURLToPath(new URL('../../', import.meta.url));
const retiredPaths = [
  'services/UserService.js', 'services/CourseService.js', 'services/PracticalService.js',
  'services/SubmissionService.js', 'db/client.js', 'db/readiness.js', 'db/migrate.js',
  'modules/courses/list-pagination.js', 'modules/users/UserService.js', 'index.js',
  'utils/logger.js', 'utils/request-timing.js', 'utils/timeout.js',
].map(path => resolve(root, 'packages/core/src', path));
const retiredAlias = /^@coderank\/core(?:$|\/(?:db(?:-readiness)?|pagination|services\/[^/]+|utils\/(?:logger|request-timing|timeout))$)/;
function walk(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    if (['node_modules', '.next', '.git'].includes(entry.name)) return [];
    const path = resolve(directory, entry.name);
    return entry.isDirectory() ? walk(path) : /\.(?:[cm]?js|tsx?)$/.test(path) ? [path] : [];
  });
}
function references(file) {
  const ast = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
  const result = [];
  const add = node => { if (node && ts.isStringLiteralLike(node)) result.push(node.text); };
  function visit(node) {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) add(node.moduleSpecifier);
    if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
      node.expression.getText(ast) === 'require' || /(?:^|\.)mock\.module$/.test(node.expression.getText(ast)))) add(node.arguments[0]);
    if (ts.isNewExpression(node) && node.expression.getText(ast) === 'URL') add(node.arguments?.[0]);
    ts.forEachChild(node, visit);
  }
  visit(ast);
  return result;
}

test('apps, packages, scripts and tests resolve public entries without retired facades', () => {
  for (const path of retiredPaths) assert.equal(existsSync(path), false, relative(root, path));
  for (const file of ['apps', 'packages', 'scripts', 'tests'].flatMap(dir => walk(resolve(root, dir)))) {
    const require = createRequire(file);
    for (const specifier of references(file)) {
      assert.ok(!retiredAlias.test(specifier), `${relative(root, file)}: retired ${specifier}`);
      const target = specifier.startsWith('.') ? resolve(dirname(file), specifier) : specifier;
      assert.ok(!retiredPaths.includes(target), `${relative(root, file)}: retired ${specifier}`);
      if (/^@coderank\/(?:core|database)(?:\/|$)/.test(specifier)) {
        assert.ok(existsSync(require.resolve(specifier)), `${relative(root, file)}: unresolved ${specifier}`);
      }
      if (file.includes('/src/')) {
        assert.doesNotMatch(target, /(?:packages\/database\/(?:scripts\/run-migration|src\/migrations)\.js|@coderank\/database\/migrations)$/, `${file}: runtime must not import migration entry`);
      }
    }
  }
});

test('core exports resolve directly to their owners and shared policy remains independent', async () => {
  const pkg = JSON.parse(readFileSync(resolve(root, 'packages/core/package.json')));
  assert.equal(pkg.main, undefined);
  for (const [entry, target] of Object.entries(pkg.exports)) {
    assert.ok(!retiredAlias.test(`@coderank/core${entry.slice(1)}`), entry);
    assert.ok(existsSync(resolve(root, 'packages/core', target)), target);
  }
  assert.equal(pkg.exports['./grading'], './src/modules/submissions/GradingService.js');
  assert.equal(pkg.exports['./submissions'], './src/modules/submissions/SubmissionService.js');
  assert.equal(pkg.exports['./practicals'], './src/modules/practicals/PracticalService.js');
  assert.equal(pkg.exports['./courses'], './src/modules/courses/CourseService.js');
  for (const file of walk(resolve(root, 'packages/core/src/shared'))) {
    assert.deepEqual(references(file), [], `${file}: shared helpers must remain dependency-free`);
  }
  for (const entry of ['@coderank/database', '@coderank/database/readiness', ...Object.keys(pkg.exports).map(key => `@coderank/core${key.slice(1)}`)]) {
    await import(entry); // Exercise ESM linking/named exports without opening services or migrating.
  }
  const require = createRequire(import.meta.url);
  assert.throws(() => require.resolve('@coderank/core'), { code: 'ERR_PACKAGE_PATH_NOT_EXPORTED' });
});
