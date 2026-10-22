import test, { describe, it } from 'node:test';
const mode = process.env.CODERANK_TAP_FIXTURE;
if (mode === 'pass') test('passes', () => {});
if (mode === 'nested') describe('suite', () => { it('passes', () => {}); describe('nested suite', () => { it('also passes', () => {}); }); });
if (mode === 'skip') test.skip('skipped', () => {});
if (mode === 'todo') test.todo('unfinished');
if (mode === 'fail') test('fails', () => { throw Error('fixture failure'); });
if (mode === 'cancel') test('cancelled', { timeout: 25 }, () => new Promise(() => {}));
if (mode === 'only') { test.only('focused', () => {}); test('excluded', () => {}); }
if (mode === 'empty') {}
if (mode === 'siblings') { describe('one', () => { it('one passes', () => {}); }); describe('two', () => { it('two passes', () => {}); }); }
if (mode === 'hang') test('hangs', () => new Promise(() => { setInterval(() => {},1000); }));
