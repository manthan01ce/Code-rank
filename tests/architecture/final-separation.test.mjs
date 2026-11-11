import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { builtinModules } from 'node:module';
import ts from 'typescript';
import inventory from '../../docs/architecture/route-inventory.json' with { type: 'json' };
import { webEnvironment } from '../../scripts/lib/web-environment.mjs';

function walk(path) {
  return readdirSync(path, { withFileTypes: true }).flatMap(entry => ['node_modules', '.next'].includes(entry.name) ? [] : entry.isDirectory() ? walk(`${path}/${entry.name}`) : [`${path}/${entry.name}`]);
}
function imports(file) {
  const source = readFileSync(file, 'utf8');
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.JSX);
  const found = [];
  function visit(node) {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier) found.push(node.moduleSpecifier.text);
    if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword || node.expression.getText(ast) === 'require') && ts.isStringLiteral(node.arguments[0])) found.push(node.arguments[0].text);
    ts.forEachChild(node, visit);
  }
  visit(ast); return found;
}

test('all baseline endpoints belong to API and frontend source/config cannot import backend implementations or secrets', () => {
  assert.equal(inventory.endpoints.filter(e=>!e.url.startsWith('/api/analytics/')&&!e.url.startsWith('/api/usage/')).length, 47);
  assert.equal(inventory.endpoints.filter(e=>e.url.startsWith('/api/analytics/')).length, 11);
  assert.equal(inventory.endpoints.filter(e=>e.url.startsWith('/api/usage/')).length,2);
  for (const endpoint of inventory.endpoints) assert.ok(endpoint.file.startsWith('apps/api/src/modules/'), endpoint.url);
  for (const path of ['apps/web/server.js', 'apps/web/cluster.js', 'infrastructure/vercel.json']) assert.equal(existsSync(path), false, path);
  assert.deepEqual(JSON.parse(readFileSync('vercel.json', 'utf8')), { $schema: 'https://openapi.vercel.sh/vercel.json', git: { deploymentEnabled: { master: true, '*': false } } }, 'root Vercel policy must enable only master without taking API routing ownership');
  assert.deepEqual(JSON.parse(readFileSync('apps/web/vercel.json', 'utf8')), { $schema: 'https://openapi.vercel.sh/vercel.json', framework: 'nextjs', buildCommand: 'npm run build', git: { deploymentEnabled: { master: true, '*': false } } }, 'workspace deployment stays standard Next.js without backend routes or secrets');
  const files = walk('apps/web').filter(file => /\.(?:m?js|tsx?)$/.test(file));
  for (const file of files) {
    for (const specifier of imports(file)) {
      const target = specifier.startsWith('.') ? resolve(dirname(file), specifier) : specifier;
      assert.doesNotMatch(target, /@coderank\/(?:core|database|queue|runner)|\/packages\/(?:core|database|queue|runner)(?:\/|$)/, `${file}: ${specifier}`);
    }
    assert.doesNotMatch(readFileSync(file, 'utf8'), /process\.env\.(?:JWT_SECRET|DATABASE_URL|REDIS_HOST|REDIS_PORT|ADMIN_PASSWORD|SERVICE_TOKEN|ANALYTICS_PASSWORD_HASH|ANALYTICS_SESSION_SECRET|ANALYTICS_USAGE_SECRET)/, file);
  }
  const web = JSON.parse(readFileSync('apps/web/package.json'));
  assert.equal(web.scripts.dev, 'next dev'); assert.equal(web.scripts.start, 'next start');
  for (const name of ['@coderank/core', '@coderank/database', '@coderank/queue', '@coderank/runner', 'redis', 'ioredis', 'bullmq', 'pg', 'jsonwebtoken', 'bcryptjs']) assert.equal(web.dependencies[name], undefined);
});

test('public practice contracts stay browser safe and every application declares static and dynamic direct imports', () => {
  for (const file of walk('packages/contracts/src')) {
    assert.deepEqual(imports(file), [], 'the current public catalog is self-contained');
    assert.doesNotMatch(readFileSync(file, 'utf8'), /process\.env|JWT_SECRET|DATABASE_URL/);
  }
  for (const app of ['web', 'api', 'worker']) {
    const pkg = JSON.parse(readFileSync(`apps/${app}/package.json`));
    const declared = { ...pkg.dependencies, ...pkg.devDependencies };
    for (const file of walk(`apps/${app}/src`).filter(file => /\.(?:m?js|tsx?)$/.test(file))) for (const specifier of imports(file)) {
      if (specifier.startsWith('.') || specifier.startsWith('@/') || specifier.startsWith('node:') || builtinModules.includes(specifier)) continue;
      const name = specifier.startsWith('@') ? specifier.split('/').slice(0, 2).join('/') : specifier.split('/')[0];
      assert.ok(declared[name], `${file} must declare ${name}`);
    }
  }
});

test('standard Next.js processes receive frontend settings without backend or launcher secrets', () => {
  const inherited = { PATH: '/bin', JWT_SECRET: 'private', ANALYTICS_PASSWORD_HASH: 'private', ANALYTICS_SESSION_SECRET: 'private', ANALYTICS_USAGE_SECRET: 'private', DATABASE_URL: 'private', REDIS_HOST: 'private', ADMIN_PASSWORD: 'private', INTERNAL_API_URL: 'private', NEXT_PUBLIC_REALTIME_URL: 'https://public.example', NEXT_TELEMETRY_DISABLED: '1' };
  const env = webEnvironment(inherited, { port: 3020, production: true });
  assert.deepEqual(Object.keys(env).sort(), ['HOSTNAME', 'NEXT_PUBLIC_REALTIME_URL', 'NEXT_TELEMETRY_DISABLED', 'NODE_ENV', 'PATH', 'PORT'].sort());
  assert.equal(env.NODE_ENV, 'production'); assert.equal(env.PORT, '3020');
});

test('confirmed API-only feature modules are owned by API and do not return to core', () => {
  const forbiddenInCore = [
    'packages/core/src/modules/users/UserManagementService.js',
    'packages/core/src/modules/practicals/PracticalManagementService.js',
    'packages/core/src/modules/practicals/StudentPracticalService.js',
    'packages/core/src/modules/reports/CourseReportService.js',
    'packages/core/src/modules/reports/PracticalReportService.js',
    'packages/core/src/modules/submissions/SubmissionHistoryService.js',
  ];
  for (const path of forbiddenInCore) {
    assert.equal(existsSync(path), false, `${path} must not exist in core`);
  }
  const requiredInApi = [
    'apps/api/src/modules/users/user-management.service.js',
    'apps/api/src/modules/practicals/practical-management.service.js',
    'apps/api/src/modules/practicals/student-practical.service.js',
    'apps/api/src/modules/practicals/course-report.service.js',
    'apps/api/src/modules/practicals/practical-report.service.js',
    'apps/api/src/modules/submissions/submission-history.service.js',
  ];
  for (const path of requiredInApi) {
    assert.equal(existsSync(path), true, `${path} must exist in API`);
  }
});
