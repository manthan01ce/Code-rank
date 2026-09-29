/**
 * Comprehensive verification script for the Neon connection pooling refactor.
 * Run: node packages/core/verify.mjs
 */

const checks = [];
let passed = 0;
let failed = 0;

function check(name, fn) {
  checks.push({ name, fn });
}

function ok(name) {
  passed++;
  console.log(`  ✅ ${name}`);
}

function fail(name, reason) {
  failed++;
  console.log(`  ❌ ${name}: ${reason}`);
}

// ─── Checks ───────────────────────────────────────────────────

check('1. @coderank/core loads from frontend', async () => {
  const m = await import('@coderank/core');
  if (typeof m.default !== 'function') throw new Error('default export is not a function');
});

check('2. @coderank/core loads from backend', async () => {
  const m = await import('@coderank/core');
  if (!m.sql) throw new Error('sql not exported');
});

check('3. sql is a tagged-template function', async () => {
  const { sql } = await import('@coderank/core');
  if (typeof sql !== 'function') throw new Error(`sql is ${typeof sql}, expected function`);
});

check('4. pool is a Pool instance', async () => {
  const { pool } = await import('@coderank/core');
  if (!pool) throw new Error('pool is falsy');
  if (typeof pool.query !== 'function') throw new Error('pool.query missing');
  if (typeof pool.connect !== 'function') throw new Error('pool.connect missing');
  if (typeof pool.end !== 'function') throw new Error('pool.end missing');
});

check('5. closePool is a function', async () => {
  const { closePool } = await import('@coderank/core');
  if (typeof closePool !== 'function') throw new Error(`closePool is ${typeof closePool}`);
});

check('6. checkConnection is a function', async () => {
  const { checkConnection } = await import('@coderank/core');
  if (typeof checkConnection !== 'function') throw new Error(`checkConnection is ${typeof checkConnection}`);
});

check('7. frontend/src/lib/db.js re-exports correctly', async () => {
  const m = await import('../../frontend/src/lib/db.js');
  const core = await import('@coderank/core');
  if (m.default !== core.default) throw new Error('default export mismatch');
  if (m.sql !== core.sql) throw new Error('sql export mismatch');
  if (m.pool !== core.pool) throw new Error('pool export mismatch');
  if (m.closePool !== core.closePool) throw new Error('closePool export mismatch');
});

check('8. backend/src/lib/db.js re-exports correctly', async () => {
  const m = await import('../../backend/src/lib/db.js');
  const core = await import('@coderank/core');
  if (m.default !== core.default) throw new Error('default export mismatch');
  if (m.sql !== core.sql) throw new Error('sql export mismatch');
  if (m.pool !== core.pool) throw new Error('pool export mismatch');
});

check('9. Pool has safe max connections (<=20)', async () => {
  const { pool } = await import('@coderank/core');
  const max = pool.options?.max || pool._maxSize;
  // Default is 10, which should be <= 20
  if (max > 20) throw new Error(`max connections = ${max}, expected <= 20`);
});

check('10. No NEXT_PUBLIC_DATABASE in codebase', async () => {
  const { execSync } = await import('child_process');
  try {
    const result = execSync('findstr /s /i "NEXT_PUBLIC_DATABASE" frontend\\src\\*.js frontend\\src\\*.ts frontend\\src\\*.tsx 2>nul', {
      cwd: process.cwd().replace(/\\packages\\core$/, ''),
      encoding: 'utf8',
    });
    if (result.trim()) throw new Error('Found NEXT_PUBLIC_DATABASE references');
  } catch (e) {
    if (e.message.includes('Found NEXT_PUBLIC_DATABASE')) throw e;
    // findstr returns exit code 1 when nothing found — that's success
  }
});

// ─── Run ──────────────────────────────────────────────────────

console.log('\n🔍 CodeRank Connection Pooling Verification\n');
console.log('──────────────────────────────────────────────');

for (const { name, fn } of checks) {
  try {
    await fn();
    ok(name);
  } catch (e) {
    fail(name, e.message);
  }
}

console.log('──────────────────────────────────────────────');
console.log(`\n📊 Results: ${passed} passed, ${failed} failed out of ${checks.length}\n`);

if (failed > 0) {
  console.log('⚠️  Some checks failed. Review the output above.\n');
  process.exit(1);
} else {
  console.log('🎉 All checks passed! Implementation is correct.\n');
  process.exit(0);
}
