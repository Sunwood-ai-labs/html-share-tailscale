import { randomBytes } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { BuildManifest, BuiltPage } from './bundle.js';
import { buildSite } from './bundle.js';
import type { HtmlShareConfig } from './config.js';
import { readShares, siteRoot, writeShares, type ShareRecord } from './local-state.js';

function packageRoot(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [path.resolve(here, '..'), path.resolve(here, '..', '..'), process.cwd()];
  return candidates.find((candidate) => existsSync(path.join(candidate, 'web'))) ?? process.cwd();
}

const PACKAGE_ROOT = packageRoot();

function copyConsole(buildRoot: string, manifest: BuildManifest): void {
  const consoleRoot = path.join(buildRoot, 'console');
  cpSync(path.join(PACKAGE_ROOT, 'web'), consoleRoot, { recursive: true });
  mkdirSync(path.join(consoleRoot, 'app'), { recursive: true });
  writeFileSync(path.join(consoleRoot, 'app', 'manifest.json'), `${JSON.stringify({
    generatedAt: manifest.generatedAt,
    pages: manifest.pages.map((page: BuiltPage) => ({
      ...page,
      href: `/content/${page.objectKey}`,
    })),
  }, null, 2)}\n`);
  writeFileSync(path.join(consoleRoot, 'app.webmanifest'), `${JSON.stringify({
    name: 'HTML Share — Tailscale',
    short_name: 'HTML Share',
    lang: 'ja',
    start_url: '/app/index.html',
    scope: '/',
    display: 'standalone',
    background_color: '#f6f7f9',
    theme_color: '#0e0d6a',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }, null, 2)}\n`);
}

export function buildOnly(config: HtmlShareConfig): { buildRoot: string; manifest: BuildManifest } {
  const buildRoot = path.resolve(config.baseDir, '.html-share', 'build');
  const manifest = buildSite(config, buildRoot);
  copyConsole(buildRoot, manifest);
  return { buildRoot, manifest };
}

export async function publish(config: HtmlShareConfig): Promise<{ consoleUrl: string; pages: number; siteRoot: string }> {
  const { buildRoot, manifest } = buildOnly(config);
  const target = siteRoot(config);
  rmSync(target, { recursive: true, force: true });
  mkdirSync(target, { recursive: true });
  cpSync(path.join(buildRoot, 'content'), path.join(target, 'content'), { recursive: true });
  cpSync(path.join(buildRoot, 'console'), target, { recursive: true });
  return {
    consoleUrl: `${config.server.publicUrl}/app/index.html`,
    pages: manifest.pages.length,
    siteRoot: target,
  };
}

function publishedManifest(config: HtmlShareConfig): BuildManifest {
  const candidates = [
    path.join(siteRoot(config), 'app', 'manifest.json'),
    path.resolve(config.baseDir, '.html-share', 'build', 'manifest.json'),
  ];
  const file = candidates.find((candidate) => existsSync(candidate));
  if (!file) throw new Error('No published site found. Run `html-share publish` first.');
  const parsed = JSON.parse(readFileSync(file, 'utf8')) as BuildManifest;
  if (!Array.isArray(parsed.pages)) throw new Error(`Published manifest is invalid: ${file}`);
  return parsed;
}

function matchPage(manifest: BuildManifest, query: string): BuiltPage {
  const matches = manifest.pages.filter((page) => page.slug === query || page.slug.includes(query) || page.title.includes(query));
  if (matches.length !== 1) {
    throw new Error(matches.length
      ? `Multiple pages match ${query}: ${matches.map((page) => page.slug).join(', ')}`
      : `Page not found: ${query}`);
  }
  return matches[0];
}

export function createShare(
  config: HtmlShareConfig,
  query: string,
  days: number,
  scope: 'internal' | 'public' = 'public',
): { url: string; expiresAt: string; scope: 'internal' | 'public' } {
  if (!Number.isInteger(days) || days < 1 || days > config.content.maximumShareDays) {
    throw new Error(`Share duration must be between 1 and ${config.content.maximumShareDays} days`);
  }
  const page = matchPage(publishedManifest(config), query);
  const token = randomBytes(18).toString('base64url');
  const createdAt = new Date();
  const expiresAt = new Date(createdAt.getTime() + days * 24 * 60 * 60 * 1000);
  const record: ShareRecord = {
    token,
    slug: page.slug,
    scope,
    createdAt: createdAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
  };
  writeShares(config, [...readShares(config), record]);
  return {
    url: `${config.server.publicUrl}/share/${token}`,
    expiresAt: record.expiresAt,
    scope,
  };
}

export function share(config: HtmlShareConfig, query: string, days: number): string {
  return createShare(config, query, days, 'public').url;
}
