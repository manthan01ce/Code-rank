import test from 'node:test';
import assert from 'node:assert/strict';
import { getSiteConfig, pageMetadata } from '../../apps/web/src/lib/site-config.js';
import robots from '../../apps/web/src/app/robots.js';
import sitemap from '../../apps/web/src/app/sitemap.js';

function withEnvironment(values, run) {
  const keys = ['CODERANK_PUBLIC_URL', 'CODERANK_ALLOW_INDEXING', 'CODERANK_SUPPORT_EMAIL', 'CODERANK_SUPPORT_URL', 'VERCEL_ENV'];
  const previous = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  try {
    keys.forEach(key => delete process.env[key]);
    Object.assign(process.env, values);
    return run();
  } finally {
    keys.forEach(key => previous[key] === undefined ? delete process.env[key] : process.env[key] = previous[key]);
  }
}

test('lab defaults and Vercel previews cannot advertise an indexable site', () => {
  for (const env of [{}, { CODERANK_ALLOW_INDEXING: 'true' }, { CODERANK_PUBLIC_URL: 'https://college.example' }, { CODERANK_PUBLIC_URL: 'https://college.example', CODERANK_ALLOW_INDEXING: 'true', VERCEL_ENV: 'preview' }]) {
    withEnvironment(env, () => {
      assert.deepEqual(sitemap(), []);
      assert.equal(robots().rules.disallow, '/');
      assert.equal(pageMetadata('Home', 'Public page', '/', true).robots.index, false);
    });
  }
});

test('public launch advertises only public routes and keeps account metadata private', () => {
  withEnvironment({ CODERANK_PUBLIC_URL: 'https://college.example', CODERANK_ALLOW_INDEXING: 'true', VERCEL_ENV: 'production' }, () => {
    assert.deepEqual(sitemap().map(item => item.url), ['https://college.example/', 'https://college.example/practice', 'https://college.example/privacy', 'https://college.example/terms', 'https://college.example/contact']);
    assert.equal(robots().sitemap, 'https://college.example/sitemap.xml');
    const publicPage = pageMetadata('Privacy', 'Privacy information', '/privacy', true);
    assert.equal(publicPage.alternates.canonical, 'https://college.example/privacy');
    assert.equal(publicPage.robots.index, true);
    const privatePage = pageMetadata('Student dashboard', 'Your workspace');
    assert.deepEqual(privatePage.robots, { index: false, follow: false });
    assert.equal(privatePage.alternates, undefined);
    assert.equal(privatePage.openGraph.url, undefined);
  });
});

test('site configuration rejects executable links and malformed canonical origins', () => {
  for (const value of ['javascript:alert(1)', 'https://user:password@college.example', 'https://college.example/path', 'https://college.example/?token=secret', 'https://college.example/#fragment']) {
    assert.throws(() => getSiteConfig({ CODERANK_PUBLIC_URL: value }));
  }
  for (const value of ['javascript:alert(1)', 'data:text/html,test', 'https://user:password@college.example']) {
    assert.throws(() => getSiteConfig({ CODERANK_SUPPORT_URL: value }));
  }
  assert.throws(() => getSiteConfig({ CODERANK_SUPPORT_EMAIL: 'help@college.example?bcc=other@example.com' }));
  assert.throws(() => getSiteConfig({ CODERANK_SUPPORT_EMAIL: 'help@college.example\nBcc:other@example.com' }));
  const contact = getSiteConfig({ CODERANK_SUPPORT_EMAIL: 'help@college.example', CODERANK_SUPPORT_URL: 'https://college.example/help' });
  assert.equal(contact.supportEmail, 'help@college.example');
  assert.equal(contact.supportUrl, 'https://college.example/help');
});
