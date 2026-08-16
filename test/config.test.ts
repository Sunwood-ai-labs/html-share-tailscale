import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { addPageToConfig, loadConfig } from '../src/config.js';

function fixture(): { root: string; config: string } {
  const root = mkdtempSync(path.join(tmpdir(), 'html-share-config-'));
  mkdirSync(path.join(root, 'pages'));
  writeFileSync(path.join(root, 'pages', 'demo.html'), '<h1>Demo</h1>');
  const config = path.join(root, 'html-share.config.yaml');
  writeFileSync(config, `server:
  host: 127.0.0.1
  port: 4311
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
      repository: examples
      stream: release-notes
      streamLabel: リリースノート
  maximumShareDays: 30
  maximumAssetBytes: 1024
`);
  return { root, config };
}

test('loads a Tailscale config and resolves its base directory', () => {
  const { root, config } = fixture();
  const loaded = loadConfig(config);
  assert.equal(loaded.baseDir, root);
  assert.equal(loaded.server.host, '127.0.0.1');
  assert.equal(loaded.server.port, 4311);
  assert.equal(loaded.server.publicUrl, 'https://your-device.example.ts.net:9222');
  assert.equal(loaded.server.tailscale.httpsPort, 9222);
  assert.equal(loaded.content.pages[0].path, 'pages/demo.html');
  assert.equal(loaded.content.pages[0].repository, 'examples');
  assert.equal(loaded.content.pages[0].stream, 'release-notes');
  assert.equal(loaded.content.pages[0].streamLabel, 'リリースノート');
});

test('allows an empty page list for a newly initialized local dashboard', () => {
  const { config } = fixture();
  const source = readFileSync(config, 'utf8').replace(/  pages:\n    - path: pages\/demo\.html\n      repository: examples\n      stream: release-notes\n      streamLabel: リリースノート\n/, '  pages: []\n');
  writeFileSync(config, source);
  assert.deepEqual(loadConfig(config).content.pages, []);
});

test('adds a page only once', () => {
  const { config } = fixture();
  assert.equal(addPageToConfig(config, 'pages/second.html', 'Second'), true);
  assert.equal(addPageToConfig(config, 'pages/second.html', 'Second'), false);
  assert.equal((readFileSync(config, 'utf8').match(/pages\/second\.html/g) ?? []).length, 1);
});

test('requires a loopback bind host', () => {
  const { config } = fixture();
  writeFileSync(config, readFileSync(config, 'utf8').replace('host: 127.0.0.1', 'host: 0.0.0.0'));
  assert.throws(() => loadConfig(config), /loopback-only/);
});

test('requires the Tailscale hostname and public URL to match', () => {
  const { config } = fixture();
  writeFileSync(config, readFileSync(config, 'utf8').replace('hostname: your-device.example.ts.net', 'hostname: other.example.ts.net'));
  assert.throws(() => loadConfig(config), /must match server\.publicUrl/);
});

test('allows private Tailnet values to live in ignored environment variables', () => {
  const { config } = fixture();
  const names = [
    'HTML_SHARE_PUBLIC_URL',
    'HTML_SHARE_TAILSCALE_HOSTNAME',
    'HTML_SHARE_TAILSCALE_HTTPS_PORT',
    'HTML_SHARE_CONTENT_ROOTS',
  ];
  const previous = new Map(names.map((name) => [name, process.env[name]]));
  try {
    process.env.HTML_SHARE_PUBLIC_URL = 'https://private-device.example.ts.net:9443';
    process.env.HTML_SHARE_TAILSCALE_HOSTNAME = 'private-device.example.ts.net';
    process.env.HTML_SHARE_TAILSCALE_HTTPS_PORT = '9443';
    process.env.HTML_SHARE_CONTENT_ROOTS = 'pages';
    const loaded = loadConfig(config);
    assert.equal(loaded.server.publicUrl, 'https://private-device.example.ts.net:9443');
    assert.equal(loaded.server.tailscale.hostname, 'private-device.example.ts.net');
    assert.equal(loaded.server.tailscale.httpsPort, 9443);
    assert.deepEqual(loaded.content.roots, ['pages']);
  } finally {
    for (const name of names) {
      const value = previous.get(name);
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
});
