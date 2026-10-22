import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
const root = new URL('../', import.meta.url);
const read = p => readFileSync(new URL(p, root), 'utf8');

test('all 46 API paths and 17 pages retain their HTTP methods and locations', () => {
  const fixture = JSON.parse(read('tests/fixtures/routes.json'));
  for (const [file, methods] of Object.entries(fixture)) {
    const source = read(file);
    if (methods[0] === 'PAGE') continue;
    const exports = [...source.matchAll(/export (?:async )?(?:function|const) (GET|POST|PUT|PATCH|DELETE|OPTIONS)/g)].map(x => x[1]).sort();
    assert.deepEqual(exports, methods, file);
  }
});
function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => ['node_modules', '.next'].includes(entry.name) ? [] : entry.isDirectory() ? walk(path.join(dir, entry.name)) : [path.join(dir, entry.name)]);
}
test('active JS/JSX parses and local imports resolve', () => {
  for (const file of [...walk(fileURLToPath(new URL('apps/', root))), ...walk(fileURLToPath(new URL('packages/', root)))].filter(x => /\.(m?js)$/.test(x))) {
    const source = readFileSync(file, 'utf8');
    const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JSX);
    assert.deepEqual(ast.parseDiagnostics.map(d => ts.flattenDiagnosticMessageText(d.messageText, '\n')), [], file);
    for (const [, specifier] of source.matchAll(/(?:from\s*|import\s*)['"]([^'"]+)['"]/g)) {
      let target;
      if (specifier.startsWith('.')) target = path.resolve(path.dirname(file), specifier);
      else if (specifier.startsWith('@/') && file.replace(/\\/g, '/').includes('/apps/web/')) target = fileURLToPath(new URL(`apps/web/src/${specifier.slice(2)}`, root));
      else continue;
      assert.ok([target, `${target}.js`, `${target}.mjs`, `${target}.json`, `${target}/index.js`].some(existsSync), `${file}: ${specifier}`);
    }
  }
});
test('active lab launchers use the workspace and authoritative infrastructure', () => {
  for (const file of ['start-lab.sh', 'start-lab.bat']) {
    const source = read(file);
    assert.doesNotMatch(source, /cd (?:frontend|backend)/);
    assert.match(source, /npm run worker/);
    assert.match(source, /npm run web/);
    assert.match(source, /infrastructure[\\/]docker-compose.yml/);
  }
});
