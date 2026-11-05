import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
const queries = [];
let closed = false;
mock.module(new URL('../../packages/database/src/client.js', import.meta.url).href, {
  defaultExport: { query: async text => { queries.push(text); return []; } },
  namedExports: { closeDatabase: async () => { closed = true; } },
});
test('supported schema/index inspection runs read-only queries and closes the client', async t => {
  const messages = [];
  t.mock.method(console, 'log', message => messages.push(JSON.parse(message)));
  await import('../../packages/database/scripts/inspect-schema.js');
  assert.equal(queries.length, 3);
  assert.ok(queries.every(query => /^SELECT\b/i.test(query)));
  assert.equal(closed, true);
  assert.deepEqual(messages, [{ readOnly: true, columns: [], indexes: [], progress: [] }]);
});
