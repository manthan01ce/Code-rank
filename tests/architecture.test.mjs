import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
const root = new URL('../', import.meta.url);
const read = p => readFileSync(new URL(p, root), 'utf8');

test('all inventoried API paths and pages retain their HTTP methods and locations', () => {
  const fixture = JSON.parse(read('tests/fixtures/routes.json'));
  const actual = walk(fileURLToPath(new URL('apps/web/src/app/api/', root)))
    .filter(file => /[\\/]route\.[cm]?[jt]sx?$/.test(file))
    .map(file => path.relative(fileURLToPath(root), file).replaceAll('\\', '/')).sort();
  assert.deepEqual(actual, Object.keys(fixture).filter(file => file.includes('/api/')).sort(), 'Every API route must be inventoried');
  for (const [file, methods] of Object.entries(fixture)) {
    const source = read(file);
    if (methods[0] === 'PAGE') continue;
    const exports = [...source.matchAll(/export (?:async )?(?:function|const) (GET|POST|PUT|PATCH|DELETE|OPTIONS)/g)].map(x => x[1]).sort();
    assert.deepEqual(exports, methods, file);
  }
});

test('domain and infrastructure dependencies obey one-way package boundaries', () => {
  for (const pkg of ['core', 'database', 'queue', 'runner']) {
    for (const file of walk(fileURLToPath(new URL(`packages/${pkg}/src/`, root))).filter(file => /\.m?js$/.test(file))) {
      const ast = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
      const imports = [];
      function visit(node) {
        if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier) imports.push(node.moduleSpecifier.text);
        if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword && ts.isStringLiteral(node.arguments[0])) imports.push(node.arguments[0].text);
        ts.forEachChild(node, visit);
      }
      visit(ast);
      for (const specifier of imports) {
        assert.doesNotMatch(specifier, /^(?:next(?:\/|$)|react(?:\/|$)|@\/|@coderank\/web)/, file);
        const target = specifier.startsWith('.') ? path.resolve(path.dirname(file), specifier).replaceAll('\\', '/') : specifier;
        assert.doesNotMatch(target, /(?:^|\/)apps\//, file);
        if (pkg === 'core') assert.doesNotMatch(target, /@coderank\/runner|\/packages\/runner\//, file);
        else for (const other of ['core', 'database', 'queue', 'runner'].filter(name => name !== pkg)) {
          assert.ok(!target.startsWith(`@coderank/${other}`) && !target.includes(`/packages/${other}/`), `${file}: ${specifier}`);
        }
      }
    }
  }
});

test('HTTP adapters delegate SQL and sandbox execution to packages', () => {
  for (const file of walk(fileURLToPath(new URL('apps/web/src/app/api/', root))).filter(file => file.endsWith('route.js'))) {
    const source = readFileSync(file, 'utf8');
    // Health is an infrastructure probe and may use the read-only database readiness adapter.
    if (!file.replaceAll('\\', '/').endsWith('/api/health/route.js')) {
      assert.doesNotMatch(source, /from ['"](?:@\/lib\/db|@coderank\/(?:core\/db|database)(?:['"/]))/, file);
    }
    assert.doesNotMatch(source, /@coderank\/runner|node:child_process|from ['"]child_process|\bsql\s*(?:`|\.query\()/, file);
  }
});
function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => ['node_modules', '.next'].includes(entry.name) ? [] : entry.isDirectory() ? walk(path.join(dir, entry.name)) : [path.join(dir, entry.name)]);
}
test('active JS/TS/TSX parses and local imports resolve', () => {
  for (const file of [...walk(fileURLToPath(new URL('apps/', root))), ...walk(fileURLToPath(new URL('packages/', root)))].filter(x => /\.(?:m?js|tsx?)$/.test(x))) {
    const source = readFileSync(file, 'utf8');
    const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, /\.tsx?$/.test(file) ? ts.ScriptKind.TSX : ts.ScriptKind.JSX);
    assert.deepEqual(ast.parseDiagnostics.map(d => ts.flattenDiagnosticMessageText(d.messageText, '\n')), [], file);
    for (const [, specifier] of source.matchAll(/(?:from\s*|import\s*)['"]([^'"]+)['"]/g)) {
      let target;
      if (specifier.startsWith('.')) target = path.resolve(path.dirname(file), specifier);
      else if (specifier.startsWith('@/') && file.replace(/\\/g, '/').includes('/apps/web/')) target = fileURLToPath(new URL(`apps/web/src/${specifier.slice(2)}`, root));
      else continue;
      assert.ok([target, `${target}.js`, `${target}.mjs`, `${target}.ts`, `${target}.tsx`, `${target}.json`, `${target}/index.js`, `${target}/index.ts`, `${target}/index.tsx`].some(existsSync), `${file}: ${specifier}`);
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

test('student coding page never serializes private practical content before bearer authentication', () => {
  const source=read('apps/web/src/app/student/code/[id]/page.js');
  assert.doesNotMatch(source,/lib\/db|@coderank\/core\/db|\bsql\b|SELECT|generateMetadata/);
  assert.match(source,/practicalId=/);
});
