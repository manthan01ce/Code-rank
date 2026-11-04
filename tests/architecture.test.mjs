import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const root = new URL('../', import.meta.url);
const read = p => readFileSync(new URL(p, root), 'utf8');

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry =>
    ['node_modules', '.next'].includes(entry.name) ? [] : entry.isDirectory() ? walk(path.join(dir, entry.name)) : [path.join(dir, entry.name)]
  );
}

function getActualRoutes() {
  const actualWebRoutes = existsSync(fileURLToPath(new URL('apps/web/src/app/api/', root)))
    ? walk(fileURLToPath(new URL('apps/web/src/app/api/', root)))
        .filter(file => /[\\/]route\.[cm]?[jt]sx?$/.test(file))
        .map(file => path.relative(fileURLToPath(root), file).replaceAll('\\', '/'))
    : [];
  const actualApiRoutes = existsSync(fileURLToPath(new URL('apps/api/src/modules/', root)))
    ? walk(fileURLToPath(new URL('apps/api/src/modules/', root)))
        .filter(file => /[\\/].*?routes\.[cm]?[jt]sx?$/.test(file))
        .map(file => path.relative(fileURLToPath(root), file).replaceAll('\\', '/'))
    : [];
  return [...actualWebRoutes, ...actualApiRoutes].sort();
}

export function validateInventory(inventory, actualRoutes, actualPages) {
  const allowedOwners = new Set([
    'CR-ARCH-09',
    'CR-ARCH-10A',
    'CR-ARCH-10B',
    'CR-ARCH-11A',
    'CR-ARCH-11B',
    'CR-ARCH-12A',
    'CR-ARCH-12B',
    'CR-ARCH-13'
  ]);

  if (!inventory || typeof inventory !== 'object') throw new Error('Inventory must be an object');
  if (!Array.isArray(inventory.pages)) throw new Error('Inventory pages must be an array');
  if (!Array.isArray(inventory.endpoints)) throw new Error('Inventory endpoints must be an array');

  // Verify pages in both directions
  const inventoriedPageFiles = inventory.pages.map(p => p.file);
  const uniquePageFiles = new Set(inventoriedPageFiles);
  if (uniquePageFiles.size !== inventoriedPageFiles.length) {
    throw new Error('Duplicate page files in inventory');
  }

  const missingPages = actualPages.filter(f => !uniquePageFiles.has(f));
  if (missingPages.length > 0) {
    throw new Error(`Pages discovered in source but missing from inventory: ${missingPages.join(', ')}`);
  }
  const extraPages = inventoriedPageFiles.filter(f => !actualPages.includes(f));
  if (extraPages.length > 0) {
    throw new Error(`Pages present in inventory but missing from source: ${extraPages.join(', ')}`);
  }

  for (const page of inventory.pages) {
    if (!page.owner) throw new Error(`Page ${page.file} has no assigned owner`);
  }

  // Verify endpoints: unique URLs, and every file exists in both directions.
  // Fastify route files may register multiple endpoints.
  const inventoriedUrls = inventory.endpoints.map(e => e.url);
  const uniqueUrls = new Set(inventoriedUrls);
  if (uniqueUrls.size !== inventoriedUrls.length) {
    throw new Error('Duplicate endpoint URLs in inventory');
  }
  const uniqueRouteFiles = new Set(inventory.endpoints.map(e => e.file));

  const missingRoutes = actualRoutes.filter(f => !uniqueRouteFiles.has(f));
  if (missingRoutes.length > 0) {
    throw new Error(`API routes discovered in source but missing from inventory: ${missingRoutes.join(', ')}`);
  }
  const extraRoutes = [...uniqueRouteFiles].filter(f => !actualRoutes.includes(f));
  if (extraRoutes.length > 0) {
    throw new Error(`API routes present in inventory but missing from source: ${extraRoutes.join(', ')}`);
  }

  // Endpoint ownership checks
  const arch09Routes = [];
  for (const endpoint of inventory.endpoints) {
    if (!endpoint.owner) {
      throw new Error(`Endpoint ${endpoint.file} is unassigned`);
    }
    if (!allowedOwners.has(endpoint.owner)) {
      throw new Error(`Endpoint ${endpoint.file} assigned to invalid owner: ${endpoint.owner}`);
    }
    if (endpoint.owner === 'CR-ARCH-09') {
      arch09Routes.push(endpoint.file);
    }
  }

  if (arch09Routes.length !== 1) {
    throw new Error(`CR-ARCH-09 must have exactly one low-risk representative endpoint, found ${arch09Routes.length}`);
  }

  return true;
}

test('all inventoried API paths and pages retain their HTTP methods, locations, and migration allocations', async () => {
  const inventory = JSON.parse(read('docs/architecture/route-inventory.json'));
  const actualRoutes = getActualRoutes();
  const actualPages = walk(fileURLToPath(new URL('apps/web/src/app/', root)))
    .filter(file => /[\\/]page\.[cm]?[jt]sx?$/.test(file))
    .map(file => path.relative(fileURLToPath(root), file).replaceAll('\\', '/')).sort();

  validateInventory(inventory, actualRoutes, actualPages);

  // Preserve HTTP method checks against actual source files.
  // Fastify route files may contain multiple endpoints: aggregate their methods.
  const methodsByFile = new Map();
  for (const endpoint of inventory.endpoints) {
    const existing = methodsByFile.get(endpoint.file) || [];
    methodsByFile.set(endpoint.file, [...existing, ...endpoint.methods]);
  }
  for (const [file, declaredMethods] of methodsByFile) {
    const source = read(file);
    if (file.startsWith('apps/api/')) {
      const methods = [...new Set([...source.matchAll(/fastify\.(get|post|put|delete|patch|options)\(/gi)].map(x => x[1].toUpperCase()))].sort();
      assert.deepEqual(methods, [...new Set(declaredMethods)].sort(), file);
    } else {
      const exports = [...source.matchAll(/export (?:async )?(?:function|const) (GET|POST|PUT|PATCH|DELETE|OPTIONS)/g)].map(x => x[1]).sort();
      assert.deepEqual(exports, [...new Set(declaredMethods)].sort(), file);
    }
  }

  // Shared route files must still register EACH URL/method, not only a union
  // of verbs that could conceal a missing change-password/profile handler.
  const { buildApp } = await import('../apps/api/src/app.js');
  const api = buildApp();
  try {
    await api.ready();
    for (const endpoint of inventory.endpoints.filter(item => item.file.startsWith('apps/api/'))) {
      for (const method of endpoint.methods) {
        assert.ok(api.hasRoute({ method, url: endpoint.url.replaceAll(/\[([^\]]+)\]/g, ':' + String.fromCharCode(36) + '1') }), `${method} ${endpoint.url} is not registered`);
      }
    }
  } finally { await api.close(); }

  // Literal response branches are minimum source observations, not an exhaustive
  // substitute for runtime contracts forwarded by services and shared helpers.
  for (const endpoint of inventory.endpoints) {
    const source = read(endpoint.file);
    for (const [, code] of source.matchAll(/\\bstatus\\s*:\\s*(\\d{3})/g)) {
      assert.ok(endpoint.statusCodes.includes(Number(code)), `${endpoint.file}: missing literal status ${code}`);
    }
    for (const [, name, , value] of source.matchAll(/['"]((?:Cache-Control|Retry-After|X-[\\w-]+|Content-Type))['"]\\s*:\\s*(['"])(.*?)\\2/gi)) {
      assert.ok(endpoint.observedResponseHeaders?.[name.toLowerCase()]?.includes(value),
        `${endpoint.file}: missing observed ${name}: ${value}`);
    }
  }
  const live = inventory.endpoints.find(endpoint => endpoint.url === '/api/live');
  assert.ok(live.observedResponseHeaders['cache-control'].includes('no-store'));
  const jobs = inventory.endpoints.find(endpoint => endpoint.url === '/api/jobs/[jobId]');
  assert.ok(jobs.statusCodes.includes(400), 'Missing jobId adapter branch returns 400');
  assert.ok(jobs.contractSources.includes('apps/web/src/lib/execution-api.js'));
  assert.equal(jobs.sharedExecutionContracts.errorHeaders['retry-after'], '5 on executionError 503 only');

  // Verify legacy routes fixture synchronization
  const legacyFixture = JSON.parse(read('tests/fixtures/routes.json'));
  assert.deepEqual(
    Object.keys(legacyFixture).filter(f => f.includes('/api/')).sort(),
    actualRoutes,
    'Legacy fixture routes must match actual routes'
  );
  assert.deepEqual(
    Object.keys(legacyFixture).filter(f => !f.includes('/api/')).sort(),
    actualPages,
    'Legacy fixture pages must match actual pages'
  );
});

test('route inventory rejects unassigned, duplicate, or invalid endpoint allocations (negative validation)', () => {
  const inventory = JSON.parse(read('docs/architecture/route-inventory.json'));
  const actualRoutes = getActualRoutes();
  const actualPages = walk(fileURLToPath(new URL('apps/web/src/app/', root)))
    .filter(file => /[\\/]page\.[cm]?[jt]sx?$/.test(file))
    .map(file => path.relative(fileURLToPath(root), file).replaceAll('\\', '/')).sort();

  // 1. Reject unassigned endpoint
  assert.throws(() => {
    const bad = JSON.parse(JSON.stringify(inventory));
    bad.endpoints[0].owner = null;
    validateInventory(bad, actualRoutes, actualPages);
  }, /unassigned/);

  // 2. Reject duplicate endpoint URL
  assert.throws(() => {
    const bad = JSON.parse(JSON.stringify(inventory));
    bad.endpoints.push({ ...bad.endpoints[0] });
    validateInventory(bad, actualRoutes, actualPages);
  }, /Duplicate endpoint URLs/);

  // 3. Reject missing endpoint from inventory
  assert.throws(() => {
    const bad = JSON.parse(JSON.stringify(inventory));
    bad.endpoints = bad.endpoints.slice(1);
    validateInventory(bad, actualRoutes, actualPages);
  }, /missing from inventory/);

  // 4. Reject invalid owner
  assert.throws(() => {
    const bad = JSON.parse(JSON.stringify(inventory));
    bad.endpoints[0].owner = 'CR-ARCH-99_INVALID';
    validateInventory(bad, actualRoutes, actualPages);
  }, /invalid owner/);

  // 5. Reject duplicate CR-ARCH-09 allocation
  assert.throws(() => {
    const bad = JSON.parse(JSON.stringify(inventory));
    const nonArch09 = bad.endpoints.find(e => e.owner !== 'CR-ARCH-09');
    if (nonArch09) nonArch09.owner = 'CR-ARCH-09';
    validateInventory(bad, actualRoutes, actualPages);
  }, /CR-ARCH-09 must have exactly one/);

  // 6. Reject missing page from inventory
  assert.throws(() => {
    const bad = JSON.parse(JSON.stringify(inventory));
    bad.pages = bad.pages.slice(1);
    validateInventory(bad, actualRoutes, actualPages);
  }, /Pages discovered in source but missing/);

  // 7. Reject extra page in inventory
  assert.throws(() => {
    const bad = JSON.parse(JSON.stringify(inventory));
    bad.pages.push({ url: '/extra-page', file: 'apps/web/src/app/extra/page.js', owner: 'out-of-scope' });
    validateInventory(bad, actualRoutes, actualPages);
  }, /Pages present in inventory but missing/);
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

test('core package contains no browser-only PDF generation utilities or exports', () => {
  const corePackageJson = JSON.parse(readFileSync(fileURLToPath(new URL('packages/core/package.json', root)), 'utf8'));
  assert.equal(corePackageJson.exports['./utils/pdf-gen'], undefined, 'core must not export ./utils/pdf-gen');
  assert.equal(existsSync(fileURLToPath(new URL('packages/core/src/utils/pdf-gen.js', root))), false, 'core must not contain pdf-gen.js');

  for (const file of walk(fileURLToPath(new URL('packages/core/src/', root))).filter(file => /\.m?js$/.test(file))) {
    const source = readFileSync(file, 'utf8');
    assert.doesNotMatch(source, /\b(?:jspdf|jspdf-autotable)\b/, `${file} must not reference jspdf libraries`);
  }
});

test('tooling package is resolved and critical lint uses tooling configuration', () => {
  assert.equal(existsSync(fileURLToPath(new URL('packages/config', root))), false, 'packages/config must not exist on disk');

  const lockfile = read('package-lock.json');
  assert.ok(!lockfile.includes('@coderank/config'), 'package-lock.json must not reference @coderank/config');
  assert.ok(!lockfile.includes('"packages/config"'), 'package-lock.json must not reference packages/config');

  const packageJsonFiles = [
    fileURLToPath(new URL('package.json', root)),
    ...walk(fileURLToPath(new URL('apps/', root))).filter(f => f.endsWith('package.json')),
    ...walk(fileURLToPath(new URL('packages/', root))).filter(f => f.endsWith('package.json')),
  ];

  for (const pkgFile of packageJsonFiles) {
    const pkgJson = JSON.parse(readFileSync(pkgFile, 'utf8'));
    const allDeps = {
      ...pkgJson.dependencies,
      ...pkgJson.devDependencies,
      ...pkgJson.peerDependencies,
    };
    assert.equal(allDeps['@coderank/config'], undefined, `${pkgFile} must not reference @coderank/config`);
    assert.notEqual(pkgJson.name, '@coderank/config', `${pkgFile} must not declare @coderank/config`);
  }

  assert.equal(existsSync(fileURLToPath(new URL('tooling/eslint.config.mjs', root))), true, 'tooling/eslint.config.mjs must exist');
  const rootPkgJson = JSON.parse(read('package.json'));
  assert.ok(rootPkgJson.scripts['lint:critical']?.includes('tooling/eslint.config.mjs'), 'lint:critical must reference tooling/eslint.config.mjs');
  assert.ok(!rootPkgJson.scripts['lint:critical']?.includes('apps/web/eslint.config.mjs'), 'lint:critical must not borrow apps/web/eslint.config.mjs');
});

test('HTTP adapters delegate SQL and sandbox execution to packages', () => {
  const routeFiles = [
    ...walk(fileURLToPath(new URL('apps/web/src/app/api/', root))).filter(file => file.endsWith('route.js')),
    ...(existsSync(fileURLToPath(new URL('apps/api/src/modules/', root)))
      ? walk(fileURLToPath(new URL('apps/api/src/modules/', root))).filter(file => file.endsWith('routes.js'))
      : []),
  ];
  for (const file of routeFiles) {
    const source = readFileSync(file, 'utf8');
    // Health is an infrastructure probe and may use the read-only database readiness adapter.
    if (!file.replaceAll('\\', '/').endsWith('/api/health/route.js')) {
      assert.doesNotMatch(source, /from ['"](?:@\/lib\/db|@coderank\/(?:core\/db|database)(?:['"/]))/, file);
    }
    assert.doesNotMatch(source, /@coderank\/runner|node:child_process|from ['"]child_process|\bsql\s*(?:`|\.query\()/, file);
  }
});

test('apps/api contains no Next.js, React, runner or Docker imports', () => {
  const apiSrc = fileURLToPath(new URL('apps/api/src/', root));
  if (!existsSync(apiSrc)) return;
  const apiFiles = walk(apiSrc).filter(f => /\.(?:m?js|ts)$/.test(f));
  for (const file of apiFiles) {
    const source = readFileSync(file, 'utf8');
    assert.doesNotMatch(source, /\bfrom ['"](?:next(?:\/|$)|react(?:\/|$)|@coderank\/runner|node:child_process|child_process)/, `${file} must not import Next.js, React, runner, or child_process`);
  }
});

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

test('unit test discovery includes both .test.mjs and .test.js files and respects explicit quarantine', async () => {
  const { testConfiguration } = await import('../scripts/ci/run-tests.mjs');
  const config = await testConfiguration('unit');
  // Both extensions must be represented — the intent is deliberate dual-extension support
  const mjs = config.files.filter(f => f.endsWith('.test.mjs'));
  const js  = config.files.filter(f => f.endsWith('.test.js'));
  assert.ok(mjs.length > 0, 'unit lane must discover at least one .test.mjs file');
  assert.ok(js.length > 0,  'unit lane must discover at least one .test.js file');
  // The quarantined Docker test must not appear in the unit lane
  assert.ok(!config.files.includes('tests/batch-execution.test.js'), 'batch-execution.test.js must be quarantined from unit lane');
  // The job-lifecycle test must appear in the unit lane
  assert.ok(config.files.includes('tests/job-lifecycle.test.js'), 'job-lifecycle.test.js must be in unit lane');
  // No fixture or non-test helper scripts should appear
  for (const file of config.files) {
    assert.match(file, /\.test\.[cm]?js$/, `Unexpected non-test file in unit lane: ${file}`);
    assert.doesNotMatch(file, /\/fixtures\//, `Fixture file must not appear in unit lane: ${file}`);
    assert.doesNotMatch(file, /\/integration\//, `Integration file must not appear in unit lane: ${file}`);
    assert.doesNotMatch(file, /\/browser\//, `Browser spec must not appear in unit lane: ${file}`);
  }
});

test('runtime config is exported deliberately and no relative cross-workspace env imports remain', () => {
  const corePackageJson = JSON.parse(readFileSync(fileURLToPath(new URL('packages/core/package.json', root)), 'utf8'));
  assert.equal(corePackageJson.exports['./config/env'], './src/config/env.js', 'core must export ./config/env');

  const files = [
    ...walk(fileURLToPath(new URL('apps/', root))),
    ...walk(fileURLToPath(new URL('packages/', root))),
    ...walk(fileURLToPath(new URL('scripts/', root))),
    ...walk(fileURLToPath(new URL('database/', root))),
    ...walk(fileURLToPath(new URL('tests/', root))),
  ].filter(f => /\.(?:m?js|tsx?)$/.test(f));

  for (const file of files) {
    const source = readFileSync(file, 'utf8');
    for (const [, specifier] of source.matchAll(/(?:from\s*|import\s*\(?|import\s*)['"]([^'"]+)['"]/g)) {
      assert.doesNotMatch(
        specifier,
        /packages\/core\/src\/config\/env/,
        `${file}: ${specifier} must not import relative cross-workspace path to env`
      );
    }
  }
});

test('API artifact excludes runner source and web gateway has runtime configuration', () => {
  const dockerfile = read('apps/api/Dockerfile');
  assert.doesNotMatch(dockerfile, /COPY packages \.\/packages/);
  assert.doesNotMatch(dockerfile, /packages\/runner|docker\.sock/);
  assert.match(read('apps/web/server.js'), /createApiGateway/);
  assert.doesNotMatch(read('apps/web/next.config.mjs'), /destination:.*api\/live/);
});
