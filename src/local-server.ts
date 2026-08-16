import { randomUUID } from 'node:crypto';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import type { HtmlShareConfig } from './config.js';
import { createShare } from './publish.js';
import { cleanReadMarks } from './read-marks.js';
import {
  ensureLocalState,
  loadState,
  readReviews,
  readShares,
  saveState,
  siteRoot,
  writeReviews,
  type PreferencesRecord,
  type ReviewRecord,
} from './local-state.js';

const CONTENT_TYPES: Record<string, string> = {
  '.css': 'text/css; charset=utf-8',
  '.csv': 'text/csv; charset=utf-8',
  '.gif': 'image/gif',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.mp3': 'audio/mpeg',
  '.mp4': 'video/mp4',
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.wav': 'audio/wav',
  '.webm': 'video/webm',
  '.webmanifest': 'application/manifest+json',
  '.webp': 'image/webp',
};

const MAX_JSON_BYTES = 1_000_000;
const DEFAULT_PREFERENCES: PreferencesRecord = {
  starredSources: [],
  recentSources: [],
  hiddenSources: [],
  readMarks: null,
  updatedAt: '',
};

function json(response: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  response.writeHead(status, {
    'cache-control': 'no-store',
    'content-type': 'application/json; charset=utf-8',
    'x-robots-tag': 'noindex, nofollow',
  });
  response.end(payload);
}

function error(response: ServerResponse, status: number, message: string): void {
  json(response, status, { error: message });
}

function clean(value: unknown, name: string, maximum: number, required = false): string {
  const result = typeof value === 'string' ? value.trim() : '';
  if (required && !result) throw new HttpError(400, `${name} is required`);
  if (result.length > maximum) throw new HttpError(400, `${name} is too long`);
  return result;
}

function list(value: unknown, name: string, maximum: number, itemMaximum: number): string[] {
  if (!Array.isArray(value) || value.length > maximum) throw new HttpError(400, `${name} is invalid`);
  return [...new Set(value.map((item) => clean(item, name, itemMaximum, true)))];
}

function readMarks(value: unknown): PreferencesRecord['readMarks'] {
  try {
    return cleanReadMarks(value, 800);
  } catch (caught: unknown) {
    throw new HttpError(400, caught instanceof Error ? caught.message : 'readMarks is invalid');
  }
}

class HttpError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
  }
}

async function body(request: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.from(chunk);
    size += buffer.length;
    if (size > MAX_JSON_BYTES) throw new HttpError(413, 'Request body is too large');
    chunks.push(buffer);
  }
  if (size === 0) return {};
  try {
    const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('not an object');
    return parsed as Record<string, unknown>;
  } catch {
    throw new HttpError(400, 'Invalid JSON');
  }
}

function publicReview(review: ReviewRecord): ReviewRecord {
  return { ...review };
}

function newReview(bodyValue: Record<string, unknown>, source: ReviewRecord['source']): ReviewRecord {
  const now = new Date().toISOString();
  const question = clean(bodyValue.question, 'question', source === 'owner' ? 2_000 : 1_000, true);
  const firstLine = question.split('\n').find((line) => line.trim())?.trim() ?? question;
  return {
    id: randomUUID(),
    sessionId: clean(bodyValue.sessionId, 'sessionId', 180, source !== 'owner') || 'inbox',
    title: clean(bodyValue.title, 'title', 160) || (firstLine.length > 28 ? `${firstLine.slice(0, 28)}…` : firstLine),
    question,
    context: clean(bodyValue.context, 'context', 3_000),
    recommendation: clean(bodyValue.recommendation, 'recommendation', 1_000),
    status: 'waiting',
    source,
    createdAt: now,
    updatedAt: now,
  };
}

function sortedReviews(config: HtmlShareConfig): ReviewRecord[] {
  return readReviews(config)
    .filter((item) => item.status !== 'deleted')
    .sort((left, right) => String(right.updatedAt).localeCompare(String(left.updatedAt)))
    .map(publicReview);
}

function findReview(config: HtmlShareConfig, id: string): { review: ReviewRecord; all: ReviewRecord[] } {
  const all = readReviews(config);
  const review = all.find((item) => item.id === id);
  if (!review) throw new HttpError(404, 'Review item not found');
  return { review, all };
}

function inside(root: string, file: string): boolean {
  return file === root || file.startsWith(`${root}${path.sep}`);
}

function safeFile(root: string, pathname: string): string | null {
  if (pathname.includes('\0')) return null;
  const candidate = path.resolve(root, `.${pathname}`);
  return inside(root, candidate) ? candidate : null;
}

function sendFile(response: ServerResponse, file: string, requestMethod: string, status = 200): void {
  if (!existsSync(file) || !statSync(file).isFile()) {
    error(response, 404, 'Not found');
    return;
  }
  response.writeHead(status, {
    'cache-control': 'no-store',
    'content-type': CONTENT_TYPES[path.extname(file).toLowerCase()] ?? 'application/octet-stream',
    'x-robots-tag': 'noindex, nofollow',
  });
  if (requestMethod !== 'HEAD') response.end(readFileSync(file));
  else response.end();
}

function shareFile(config: HtmlShareConfig, token: string): string | HttpError {
  const record = readShares(config).find((item) => item.token === token);
  if (!record) return new HttpError(404, 'Share link not found');
  if (Date.parse(record.expiresAt) <= Date.now()) return new HttpError(410, 'Share link has expired');
  if (!/^[a-z0-9-]+$/.test(record.slug)) return new HttpError(404, 'Share link target is invalid');
  const file = safeFile(siteRoot(config), `/content/pages/${record.slug}/index.html`);
  if (!file || !existsSync(file)) return new HttpError(404, 'Shared page not found');
  return file;
}

function localStatic(config: HtmlShareConfig, pathname: string): string | null {
  const normalized = pathname === '/' ? '/app/index.html' : pathname.endsWith('/') ? `${pathname}index.html` : pathname;
  return safeFile(siteRoot(config), normalized);
}

async function api(config: HtmlShareConfig, request: IncomingMessage, response: ServerResponse, url: URL): Promise<boolean> {
  const method = request.method ?? 'GET';
  const pathname = url.pathname;
  if (pathname === '/api/health' && method === 'GET') {
    json(response, 200, { ok: true, mode: 'tailscale', tailnetOnly: true });
    return true;
  }

  if (pathname === '/api/owner/reviews' && method === 'GET') {
    json(response, 200, { items: sortedReviews(config) });
    return true;
  }
  if (pathname === '/api/owner/reviews' && method === 'POST') {
    const item = newReview(await body(request), 'owner');
    writeReviews(config, [...readReviews(config), item]);
    json(response, 201, { item: publicReview(item) });
    return true;
  }
  if (pathname === '/api/owner/preferences' && method === 'GET') {
    const saved = loadState<PreferencesRecord | null>(config, 'preferences.json', null);
    json(response, 200, {
      exists: Boolean(saved),
      ...(saved ?? DEFAULT_PREFERENCES),
      readMarks: saved?.readMarks ?? null,
    });
    return true;
  }
  if (pathname === '/api/owner/preferences' && method === 'PUT') {
    const input = await body(request);
    const saved: PreferencesRecord = {
      starredSources: list(input.starredSources ?? [], 'starredSources', 200, 500),
      recentSources: list(input.recentSources ?? [], 'recentSources', 6, 500),
      hiddenSources: list(input.hiddenSources ?? [], 'hiddenSources', 500, 500),
      readMarks: readMarks(input.readMarks ?? {}),
      updatedAt: new Date().toISOString(),
    };
    saveState(config, 'preferences.json', saved);
    json(response, 200, saved);
    return true;
  }
  if (pathname === '/api/owner/shares' && method === 'POST') {
    const input = await body(request);
    const slug = clean(input.slug, 'slug', 128, true);
    if (!/^[a-z0-9][a-z0-9-]*$/.test(slug)) throw new HttpError(400, 'Invalid slug');
    const scope = input.scope === 'internal' || input.scope === 'public' ? input.scope : '';
    if (!scope) throw new HttpError(400, 'Invalid share scope');
    const days = Number(input.days);
    const share = createShare(config, slug, days, scope);
    json(response, 201, { ...share, tailnetOnly: true });
    return true;
  }
  const ownerDelete = pathname.match(/^\/api\/owner\/reviews\/([^/]+)$/);
  if (ownerDelete && method === 'DELETE') {
    const { review, all } = findReview(config, decodeURIComponent(ownerDelete[1]));
    review.status = 'deleted';
    review.updatedAt = new Date().toISOString();
    writeReviews(config, all);
    json(response, 200, { ok: true });
    return true;
  }
  const ownerAnswer = pathname.match(/^\/api\/owner\/reviews\/([^/]+)\/answer$/);
  if (ownerAnswer && method === 'POST') {
    const input = await body(request);
    const { review, all } = findReview(config, decodeURIComponent(ownerAnswer[1]));
    if (review.status !== 'waiting') throw new HttpError(409, 'Review item is no longer waiting');
    const responseText = clean(input.responseText, 'responseText', 4_000);
    const approved = input.approved === true;
    if (!approved && !responseText) throw new HttpError(400, 'Approval or comment is required');
    review.status = 'answered';
    review.approved = approved;
    review.responseText = responseText;
    review.updatedAt = new Date().toISOString();
    writeReviews(config, all);
    json(response, 200, { item: publicReview(review) });
    return true;
  }
  if (pathname === '/api/owner/pairings' && method === 'POST') {
    throw new HttpError(410, 'Pairing is not needed when the console is shared through Tailscale');
  }

  if (pathname === '/api/device/reviews' && method === 'POST') {
    const item = newReview(await body(request), 'claude-code');
    writeReviews(config, [...readReviews(config), item]);
    json(response, 201, { item: publicReview(item) });
    return true;
  }
  if (pathname === '/api/device/reviews' && method === 'GET') {
    const status = url.searchParams.get('status');
    const sessionId = url.searchParams.get('sessionId');
    const items = sortedReviews(config).filter((item) =>
      (!status || item.status === status) && (!sessionId || item.sessionId === sessionId));
    json(response, 200, { items });
    return true;
  }
  const complete = pathname.match(/^\/api\/device\/reviews\/([^/]+)\/complete$/);
  if (complete && method === 'POST') {
    const { review, all } = findReview(config, decodeURIComponent(complete[1]));
    if (review.status === 'deleted') throw new HttpError(409, 'Review item was deleted');
    review.status = 'completed';
    review.completedAt = new Date().toISOString();
    review.updatedAt = review.completedAt;
    writeReviews(config, all);
    json(response, 200, { ok: true });
    return true;
  }
  return false;
}

async function handle(config: HtmlShareConfig, request: IncomingMessage, response: ServerResponse): Promise<void> {
  const url = new URL(request.url ?? '/', 'http://127.0.0.1');
  if (url.pathname.startsWith('/api/')) {
    if (!(await api(config, request, response, url))) error(response, 404, 'Not found');
    return;
  }
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    error(response, 405, 'Method not allowed');
    return;
  }
  if (url.pathname.startsWith('/share/')) {
    const token = url.pathname.slice('/share/'.length);
    const target = shareFile(config, token);
    if (target instanceof HttpError) {
      error(response, target.status, target.message);
      return;
    }
    sendFile(response, target, request.method);
    return;
  }
  const target = localStatic(config, url.pathname);
  if (!target) {
    error(response, 404, 'Not found');
    return;
  }
  sendFile(response, target, request.method);
}

export function createLocalServer(config: HtmlShareConfig): Server {
  ensureLocalState(config);
  return createServer((request, response) => {
    void handle(config, request, response).catch((caught: unknown) => {
      const failure = caught instanceof HttpError ? caught : new HttpError(500, 'Request failed');
      if (!response.headersSent) error(response, failure.status, failure.message);
      else response.destroy();
    });
  });
}

export function startLocalServer(config: HtmlShareConfig): Promise<Server> {
  const server = createLocalServer(config);
  return new Promise((resolve, reject) => {
    const onError = (caught: Error) => {
      server.off('listening', onListening);
      reject(caught);
    };
    const onListening = () => {
      server.off('error', onError);
      resolve(server);
    };
    server.once('error', onError);
    server.once('listening', onListening);
    server.listen(config.server.port, config.server.host);
  });
}

export function localOrigin(config: HtmlShareConfig): string {
  const host = config.server.host.includes(':') ? `[${config.server.host}]` : config.server.host;
  return `http://${host}:${config.server.port}`;
}
