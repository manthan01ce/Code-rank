// Exercise the real production web build without a database or mocked routes.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';

const base = 'http://127.0.0.1:3310';
const output = 'test-results/public-site';
await mkdir(output, { recursive: true });
const server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', 'apps/web', '-H', '127.0.0.1', '-p', '3310'], { stdio: ['ignore', 'pipe', 'pipe'] });
let serverLog = '', browser;
server.stdout.on('data', chunk => { serverLog += chunk; });
server.stderr.on('data', chunk => { serverLog += chunk; });
try {
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    assert.equal(server.exitCode, null, `Web process exited: ${serverLog}`);
    try { ready = (await fetch(base, { signal: AbortSignal.timeout(1000) })).ok; } catch { /* Wait only during server startup. */ }
    if (ready) break;
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  assert.ok(ready, 'Production web server must start');
  const robots = await fetch(`${base}/robots.txt`);
  assert.equal(robots.status, 200);
  assert.match(await robots.text(), /Sitemap: https:\/\/college\.example\/sitemap.xml/);
  const sitemap = await fetch(`${base}/sitemap.xml`);
  assert.equal(sitemap.status, 200);
  const xml = await sitemap.text();
  for (const path of ['privacy', 'terms', 'contact', 'practice']) assert.ok(xml.includes(`https://college.example/${path}`));
  assert.doesNotMatch(xml, /\/(admin|faculty|student|profile|login|signup|code)(?:[</])/);
  const og = await fetch(`${base}/opengraph-image`);
  assert.equal(og.status, 200);
  assert.match(og.headers.get('content-type'), /image\/png/);
  const png = Buffer.from(await og.arrayBuffer());
  assert.equal(png.readUInt32BE(16), 1200);
  assert.equal(png.readUInt32BE(20), 630);
  await writeFile(`${output}/opengraph.png`, png);

  browser = await chromium.launch();
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  for (const width of [390, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    for (const [path, title] of [['/', 'CodeRank'], ['/privacy', 'Privacy'], ['/terms', 'Usage guidelines'], ['/contact', 'Contact & support'], ['/login', 'Sign in'], ['/signup', 'Account access']]) {
      const response = await page.goto(`${base}${path}`);
      assert.equal(response.status(), 200, path);
      assert.ok((await page.title()).includes(title), `Distinct title: ${path}`);
      assert.ok(await page.locator('h1').isVisible(), `Visible heading: ${path}`);
      assert.ok(await page.locator('a[href="/contact"]').first().isVisible(), `Support link: ${path}`);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `No horizontal overflow: ${path} at ${width}`);
      if (['/privacy', '/terms', '/contact'].includes(path)) {
        assert.equal(await page.locator('link[rel="canonical"]').getAttribute('href'), `https://college.example${path}`);
        assert.match(await page.locator('meta[name="robots"]').getAttribute('content'), /index, follow/);
      }
      if (path === '/contact') {
        assert.equal(await page.getByRole('link', { name: 'help@college.example' }).getAttribute('href'), 'mailto:help@college.example');
        assert.equal(await page.getByRole('link', { name: 'Open your institution' }).getAttribute('href'), 'https://college.example/support');
      }
      if (path === '/login' || path === '/signup') assert.match(await page.locator('meta[name="robots"]').getAttribute('content'), /noindex/);
      await page.screenshot({ path: `${output}/${path.replaceAll('/', '') || 'home'}-${width}.png`, fullPage: true });
    }
    const missing = await page.goto(`${base}/this-page-does-not-exist`);
    assert.equal(missing.status(), 404);
    assert.equal(await page.locator('h1').textContent(), 'Page not found');
    await page.getByRole('link', { name: 'Back to home', exact: true }).click();
    await page.waitForURL(`${base}/`, { timeout: 10000 });
    assert.equal(new URL(page.url()).pathname, '/');
  }
  assert.deepEqual(errors, [], 'Public routes must not raise browser exceptions');
  console.log('Public site passed: production routes, 404 recovery, metadata, support links, robots, sitemap, PNG, mobile/desktop layouts and browser errors.');
} finally {
  if (browser) await browser.close();
  server.kill('SIGTERM');
  await writeFile(`${output}/server.log`, serverLog);
}
