import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import type { HtmlShareConfig } from './config.js';
import { localOrigin } from './local-server.js';

export interface ReviewCard {
  id?: string;
  sessionId?: string;
  title: string;
  question: string;
  context?: string;
  recommendation?: string;
  status?: string;
  source?: string;
  target?: string | null;
  responseText?: string;
  updatedAt?: string;
  createdAt?: string;
}

function apiBase(config: HtmlShareConfig): string {
  return `${localOrigin(config)}/api`;
}

async function request(config: HtmlShareConfig, pathname: string, options: {
  method?: string;
  body?: unknown;
} = {}): Promise<any> {
  const serialized = options.body === undefined ? undefined : JSON.stringify(options.body);
  const response = await fetch(`${apiBase(config)}${pathname}`, {
    method: options.method ?? 'GET',
    headers: serialized ? { 'content-type': 'application/json' } : {},
    body: serialized,
    signal: AbortSignal.timeout(15_000),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error ?? `Review API returned ${response.status}`);
  return payload;
}

export async function pushReviews(config: HtmlShareConfig, sessionId: string, cards: ReviewCard[]): Promise<ReviewCard[]> {
  const created: ReviewCard[] = [];
  for (const card of cards) {
    const result = await request(config, '/device/reviews', {
      method: 'POST',
      body: { ...card, sessionId },
    });
    created.push(result.item);
  }
  return created;
}

export async function pullReviews(config: HtmlShareConfig, sessionId?: string): Promise<ReviewCard[]> {
  const query = new URLSearchParams({ status: 'answered' });
  if (sessionId) query.set('sessionId', sessionId);
  const result = await request(config, `/device/reviews?${query}`);
  return result.items ?? [];
}

export async function listInbox(config: HtmlShareConfig): Promise<ReviewCard[]> {
  const result = await request(config, `/device/reviews?${new URLSearchParams({ status: 'waiting', sessionId: 'inbox' })}`);
  return [...(result.items ?? [])]
    .filter((item) => item.source === 'owner' || item.sessionId === 'inbox')
    .sort((left, right) => String(left.updatedAt ?? '').localeCompare(String(right.updatedAt ?? '')))
    .map((item) => ({
      ...item,
      target: item.target || null,
    }));
}

export async function completeReviews(config: HtmlShareConfig, ids: string[]): Promise<void> {
  for (const id of ids) {
    await request(config, `/device/reviews/${encodeURIComponent(id)}/complete`, { method: 'POST', body: {} });
  }
}

const sleep = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const pidFile = (sessionId: string) => path.join(
  homedir(),
  '.cache',
  'html-share',
  `review-watch-${sessionId.replace(/[^A-Za-z0-9_-]/g, '')}.pid`,
);

function alive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export async function watchReviews(config: HtmlShareConfig, sessionId: string, timeoutMinutes = 240): Promise<ReviewCard[]> {
  if (!Number.isFinite(timeoutMinutes) || timeoutMinutes <= 0) throw new Error('timeout-minutes must be positive');
  const file = pidFile(sessionId);
  if (existsSync(file)) {
    const previous = Number(readFileSync(file, 'utf8').trim());
    if (Number.isInteger(previous) && alive(previous)) throw new Error(`This session is already being watched by PID ${previous}`);
  }
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, `${process.pid}\n`);
  const cleanup = () => { if (existsSync(file)) rmSync(file); };
  process.once('SIGINT', () => { cleanup(); process.exit(0); });
  process.once('SIGTERM', () => { cleanup(); process.exit(0); });
  const pollMilliseconds = 20_000;
  const deadline = Date.now() + timeoutMinutes * 60_000;
  const maximumPolls = Math.max(1, Math.ceil((timeoutMinutes * 60_000) / pollMilliseconds));
  try {
    for (let attempt = 0; attempt < maximumPolls && Date.now() < deadline; attempt += 1) {
      const items = await pullReviews(config, sessionId);
      if (items.length) return items;
      const remaining = deadline - Date.now();
      if (remaining > 0 && attempt + 1 < maximumPolls) await sleep(Math.min(pollMilliseconds, remaining));
    }
    return [];
  } finally {
    cleanup();
  }
}

export function stopWatching(sessionId: string): boolean {
  const file = pidFile(sessionId);
  if (!existsSync(file)) return false;
  const pid = Number(readFileSync(file, 'utf8').trim());
  if (Number.isInteger(pid) && alive(pid)) process.kill(pid, 'SIGTERM');
  if (existsSync(file)) rmSync(file);
  return true;
}
