import test from 'node:test';
import assert from 'node:assert/strict';
import { ESLint } from 'eslint';

const lint = new ESLint({ overrideConfigFile: 'tooling/eslint.config.mjs' });
for (const path of ['packages/core/src/shared/probe.js', 'apps/worker/src/probe.js', 'scripts/probe.mjs']) {
  test(`backend correctness rules apply to ${path}`, async () => {
    const [result] = await lint.lintText('console.log(missingIdentifier);', { filePath: path });
    assert.ok(result.messages.some(message => message.ruleId === 'no-undef' && message.severity === 2));
    const [valid] = await lint.lintText('console.log(process.env.NODE_ENV);', { filePath: path });
    assert.equal(valid.errorCount, 0);
    const config = await lint.calculateConfigForFile(path);
    assert.equal(config.rules['@next/next/no-html-link-for-pages'], undefined);
  });
}
test('both frontend lint entry points preserve memoization errors', async () => {
  for (const [overrideConfigFile, filePath, cwd] of [
    ['tooling/eslint.config.mjs', 'apps/web/src/app/faculty/page.js', process.cwd()],
    ['eslint.config.mjs', 'src/app/faculty/page.js', `${process.cwd()}/apps/web`],
  ]) {
    const config = await new ESLint({ cwd, overrideConfigFile }).calculateConfigForFile(filePath);
    assert.equal(config.rules['react-hooks/preserve-manual-memoization'][0], 2);
  }
});
