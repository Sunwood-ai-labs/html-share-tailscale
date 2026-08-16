#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { addPageToConfig, loadConfig } from './config.js';
import { localOrigin, startLocalServer } from './local-server.js';
import { buildOnly, publish, share } from './publish.js';
import {
  completeReviews,
  listInbox,
  pullReviews,
  pushReviews,
  stopWatching,
  watchReviews,
  type ReviewCard,
} from './review-client.js';

function option(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function flag(name: string): boolean {
  return process.argv.includes(name);
}

async function stdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString('utf8');
}

function usage(): never {
  console.error(`HTML共有くん（ローカル + Tailscale）

Usage:
  html-share build [--config file]
  html-share publish [--config file]
  html-share serve [--config file]
  html-share tailscale serve [--config file]
  html-share share <slug> [--days 7]
  html-share page add <path> [--title title]
  html-share review push --session <id> [--file cards.json]
  html-share review pull [--session <id>]
  html-share review inbox
  html-share review complete <id...>
  html-share review watch --session <id> [--timeout-minutes 240]
  html-share review stop --session <id>`);
  process.exit(2);
}

async function serve(config: ReturnType<typeof loadConfig>): Promise<void> {
  const server = await startLocalServer(config);
  console.log(JSON.stringify({
    ok: true,
    mode: 'tailscale',
    localUrl: localOrigin(config),
    tailscaleUrl: `${config.server.publicUrl}/app/index.html`,
    siteRoot: config.server.siteDir,
  }, null, 2));
  await new Promise<void>((resolve) => {
    const close = () => server.close(() => resolve());
    process.once('SIGINT', close);
    process.once('SIGTERM', close);
  });
}

function tailscaleServe(config: ReturnType<typeof loadConfig>): void {
  const result = spawnSync('tailscale', [
    'serve',
    '--bg',
    `--https=${config.server.tailscale.httpsPort}`,
    localOrigin(config),
  ], { stdio: 'inherit', shell: false });
  if (result.error) throw new Error(`Could not run tailscale: ${result.error.message}`);
  if (result.status !== 0) throw new Error(`tailscale serve exited with status ${result.status}`);
  console.log(JSON.stringify({
    ok: true,
    tailscaleUrl: `${config.server.publicUrl}/app/index.html`,
    proxy: localOrigin(config),
  }, null, 2));
}

async function main(): Promise<void> {
  const command = process.argv[2];
  if (!command || flag('--help') || flag('-h')) usage();
  const config = loadConfig(option('--config'));

  if (command === 'build') {
    const result = buildOnly(config);
    console.log(JSON.stringify({ ok: true, pages: result.manifest.pages.length, buildRoot: result.buildRoot }, null, 2));
    return;
  }
  if (command === 'publish') {
    console.log(JSON.stringify({ ok: true, ...(await publish(config)) }, null, 2));
    return;
  }
  if (command === 'serve') {
    await serve(config);
    return;
  }
  if (command === 'tailscale') {
    if (process.argv[3] !== 'serve') usage();
    tailscaleServe(config);
    return;
  }
  if (command === 'share') {
    const query = process.argv[3];
    if (!query) usage();
    const days = Number(option('--days') ?? 7);
    console.log(share(config, query, days));
    return;
  }
  if (command === 'page') {
    const action = process.argv[3];
    const pagePath = process.argv[4];
    if (action !== 'add' || !pagePath) usage();
    const added = addPageToConfig(option('--config'), pagePath, option('--title'));
    console.log(JSON.stringify({ ok: true, added, path: pagePath }));
    return;
  }
  if (command === 'review') {
    const action = process.argv[3];
    if (action === 'push') {
      const sessionId = option('--session');
      if (!sessionId) usage();
      const file = option('--file');
      const source = file ? readFileSync(file, 'utf8') : await stdin();
      const input = JSON.parse(source) as ReviewCard | ReviewCard[];
      const cards = Array.isArray(input) ? input : [input];
      console.log(JSON.stringify({ ok: true, items: await pushReviews(config, sessionId, cards) }, null, 2));
      return;
    }
    if (action === 'pull') {
      console.log(JSON.stringify({ ok: true, items: await pullReviews(config, option('--session')) }, null, 2));
      return;
    }
    if (action === 'inbox') {
      const requests = await listInbox(config);
      const next = requests.length
        ? 'Oldest first. Close them all with `html-share review complete <id...>` before starting,'
          + ' then identify each request\'s working folder and work through them in order.'
          + ' `target` is a nickname hint, not a filesystem path — verify it before using it.'
          + ' The inbox is a handover box, not a progress tracker, so do not wait for the work to finish.'
          + ' Report progress and results in chat.'
        : undefined;
      console.log(JSON.stringify({ ok: true, requests, ...(next ? { next } : {}) }, null, 2));
      return;
    }
    if (action === 'complete') {
      const ids = process.argv.slice(4).filter((value) => !value.startsWith('--'));
      if (!ids.length) usage();
      await completeReviews(config, ids);
      console.log(JSON.stringify({ ok: true, completed: ids }));
      return;
    }
    if (action === 'watch') {
      const sessionId = option('--session');
      if (!sessionId) usage();
      const timeoutMinutes = Number(option('--timeout-minutes') ?? 240);
      console.log(JSON.stringify({ ok: true, items: await watchReviews(config, sessionId, timeoutMinutes) }, null, 2));
      return;
    }
    if (action === 'stop') {
      const sessionId = option('--session');
      if (!sessionId) usage();
      console.log(JSON.stringify({ ok: true, stopped: stopWatching(sessionId) }));
      return;
    }
    usage();
  }
  usage();
}

main().catch((caught: unknown) => {
  console.error(caught instanceof Error ? caught.message : String(caught));
  process.exitCode = 1;
});
