import assert from 'node:assert/strict';
import { createServer } from 'node:net';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { loadConfig } from '../src/config.js';
import { localOrigin, startLocalServer } from '../src/local-server.js';
import { publish } from '../src/publish.js';

async function freePort(): Promise<number> {
  const probe = createServer();
  await new Promise<void>((resolve, reject) => {
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => resolve());
  });
  const address = probe.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  await new Promise<void>((resolve) => probe.close(() => resolve()));
  return port;
}

test('publishes configured pages and serves local review state', async () => {
  const root = mkdtempSync(path.join(tmpdir(), 'html-share-server-'));
  mkdirSync(path.join(root, 'pages'));
  writeFileSync(path.join(root, 'pages', 'demo.html'), '<!doctype html><title>Demo</title><h1>Demo</h1>');
  const port = await freePort();
  const configFile = path.join(root, 'html-share.config.yaml');
  writeFileSync(configFile, `server:
  host: 127.0.0.1
  port: ${port}
  publicUrl: https://your-device.example.ts.net:9222
  dataDir: .html-share/data
  siteDir: .html-share/site
  tailscale:
    hostname: your-device.example.ts.net
    httpsPort: 9222
content:
  roots: [pages]
  pages:
    - path: pages/demo.html
  maximumShareDays: 30
  maximumAssetBytes: 1048576
`);
  const config = loadConfig(configFile);
  await publish(config);
  const server = await startLocalServer(config);
  try {
    const origin = localOrigin(config);
    const home = await fetch(`${origin}/app/index.html`);
    assert.equal(home.status, 200);
    const homeHtml = await home.text();
    assert.match(homeHtml, /HTML Share — Tailscale/);
    assert.doesNotMatch(homeHtml, /HTML共有くん/);
    assert.match(homeHtml, /最新の<em>TL;DR<\/em>/);

    const manifest = await fetch(`${origin}/app/manifest.json`);
    assert.equal(manifest.status, 200);
    assert.equal((await manifest.json()).pages.length, 1);

    const created = await fetch(`${origin}/api/owner/reviews`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ question: 'スマホからの依頼' }),
    });
    assert.equal(created.status, 201);
    const createdItem = (await created.json()).item;
    const listed = await fetch(`${origin}/api/device/reviews?status=waiting&sessionId=inbox`);
    assert.equal((await listed.json()).items.length, 1);

    const answered = await fetch(`${origin}/api/owner/reviews/${createdItem.id}/answer`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ approved: true, responseText: '' }),
    });
    assert.equal(answered.status, 200);

    const share = await fetch(`${origin}/api/owner/shares`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ slug: 'demo', scope: 'internal', days: 1 }),
    });
    assert.equal(share.status, 201);
    const sharedPath = new URL((await share.json()).url).pathname;
    const shared = await fetch(`${origin}${sharedPath}`);
    assert.equal(shared.status, 200);
    assert.match(await shared.text(), /<h1>Demo<\/h1>/);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
