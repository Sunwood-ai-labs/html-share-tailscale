import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '..');

test('ships the full dashboard UI and inbox wording', () => {
  const dashboard = readFileSync(path.join(root, 'web', 'app', 'index.html'), 'utf8');
  const review = readFileSync(path.join(root, 'web', 'review', 'index.html'), 'utf8');
  const list = readFileSync(path.join(root, 'web', 'page-list.js'), 'utf8');
  const shell = readFileSync(path.join(root, 'web', 'mobile-page-shell.js'), 'utf8');
  const wallpaper = readFileSync(path.join(root, 'web', 'app', 'wallpaper.js'), 'utf8');

  assert.match(dashboard, /HTML Share — Tailscale/);
  assert.doesNotMatch(dashboard, /HTML共有くん/);
  assert.match(dashboard, /最新の<em>TL;DR<\/em>/);
  assert.doesNotMatch(dashboard, /確認・返信を、/);
  assert.match(dashboard, /インボックス/);
  assert.match(dashboard, /未読に戻す/);
  assert.match(dashboard, /groupByStream/);
  assert.match(dashboard, /削除済み/);
  assert.match(dashboard, /api\/owner\/shares/);
  assert.match(list, /function markUnread/);
  assert.match(list, /v: null/);
  assert.match(shell, /class="action star-action"/);
  assert.match(shell, /class="action unread-action"/);
  assert.match(review, /Claudeへの依頼/);
  assert.match(review, /\/inbox/);
  assert.match(review, /PCへ渡す依頼はありません/);
  assert.match(review, /id="compose-target" type="text"/);
  assert.doesNotMatch(review, /<select[^>]*id="compose-target"/);
  assert.match(review, /id="target-list"/);
  assert.match(review, /function renderTargetOptions/);
  assert.match(review, /JSON\.stringify\(\{ question: text, target \}\)/);
  assert.match(review, /targetField\.value = '';/);
  assert.match(dashboard, /id="review-dot"/);
  assert.match(dashboard, /function refreshInboxDot/);
  assert.match(dashboard, /\/api\/owner\/reviews/);
  assert.match(dashboard, /\/app\/wallpaper\.js/);
  assert.match(dashboard, /--wallpaper-image/);
  assert.match(wallpaper, /max-width: 46rem/);
  assert.match(wallpaper, /ROTATION_MS/);
  for (const file of [
    'desktop-01-lacquer-tail.png', 'desktop-02-washi-ink.png',
    'desktop-03-signal-path.png', 'desktop-04-comet-tail.png',
    'mobile-01-lacquer-tail.png', 'mobile-02-washi-ink.png',
    'mobile-03-signal-path.png', 'mobile-04-comet-tail.png',
  ]) {
    const asset = path.join(root, 'web', 'app', 'wallpapers', file);
    assert.ok(existsSync(asset), `wallpaper asset exists: ${file}`);
    assert.ok(statSync(asset).size > 100_000, `wallpaper asset is not empty: ${file}`);
  }
});

test('folds overflowing tables on the viewing origin without network access', () => {
  const tables = readFileSync(path.join(root, 'web', 'mobile-tables.js'), 'utf8');
  const server = readFileSync(path.join(root, 'src', 'local-server.ts'), 'utf8');
  assert.match(tables, /data-mb-tables="off"/);
  assert.doesNotMatch(tables, /\bfetch\s*\(/);
  assert.doesNotMatch(tables, /XMLHttpRequest/);
  assert.match(server, /sessionId: clean\(bodyValue\.sessionId, 'sessionId', 180, source !== 'owner'\)/);
  assert.match(server, /Pairing is not needed when the console is shared through Tailscale/);
  assert.doesNotMatch(server, /DynamoDB|CloudFront/);
});

test('does not ship the discarded simplified dashboard files', () => {
  for (const file of ['app.css', 'app.js', 'review.html', 'review.js']) {
    assert.throws(() => readFileSync(path.join(root, 'web', 'app', file), 'utf8'));
  }
});
