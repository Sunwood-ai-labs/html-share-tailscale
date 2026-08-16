import { existsSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { parse, stringify } from 'yaml';

export interface PageConfig {
  path: string;
  title?: string;
  slug?: string;
  repository?: string;
  stream?: string;
  streamLabel?: string;
}

export interface HtmlShareConfig {
  server: {
    host: string;
    port: number;
    publicUrl: string;
    dataDir: string;
    siteDir: string;
    tailscale: {
      hostname: string;
      httpsPort: number;
    };
  };
  content: {
    roots: string[];
    pages: PageConfig[];
    maximumShareDays: number;
    maximumAssetBytes: number;
  };
  configFile: string;
  baseDir: string;
}

function text(value: unknown, name: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${name} is required`);
  return value.trim();
}

function positiveInteger(value: unknown, fallback: number, name: string): number {
  const number = value === undefined ? fallback : Number(value);
  if (!Number.isInteger(number) || number < 1) throw new Error(`${name} must be a positive integer`);
  return number;
}

function port(value: unknown, fallback: number, name: string): number {
  const result = positiveInteger(value, fallback, name);
  if (result > 65_535) throw new Error(`${name} must be between 1 and 65535`);
  return result;
}

function hostname(value: unknown, name: string): string {
  const result = text(value, name).toLowerCase();
  if (!/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(result)) {
    throw new Error(`${name} must be a hostname without a scheme or path`);
  }
  return result;
}

function bindHost(value: unknown): string {
  const result = text(value, 'server.host');
  if (!['127.0.0.1', 'localhost', '::1'].includes(result)) {
    throw new Error('server.host must be loopback-only (127.0.0.1, localhost, or ::1)');
  }
  return result === 'localhost' ? '127.0.0.1' : result;
}

function publicUrl(value: unknown): string {
  const raw = text(value, 'server.publicUrl');
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error('server.publicUrl must be a valid HTTPS URL');
  }
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.search || parsed.hash) {
    throw new Error('server.publicUrl must be an HTTPS URL without credentials, query, or hash');
  }
  if (parsed.pathname !== '/' || !parsed.hostname) {
    throw new Error('server.publicUrl must point to the Tailscale origin without a path');
  }
  hostname(parsed.hostname, 'server.publicUrl hostname');
  if (!parsed.hostname.endsWith('.ts.net')) {
    throw new Error('server.publicUrl must use a Tailscale *.ts.net hostname');
  }
  return parsed.origin;
}

function relativeDirectory(value: unknown, name: string): string {
  const result = text(value, name);
  if (path.isAbsolute(result)) throw new Error(`${name} must be relative to the config directory`);
  const normalized = path.normalize(result);
  if (normalized === '.' || normalized === '..' || normalized.startsWith(`..${path.sep}`)) {
    throw new Error(`${name} must stay inside the config directory`);
  }
  return result;
}

export function resolveFromConfig(config: HtmlShareConfig, value: string): string {
  return path.resolve(config.baseDir, value);
}

function configPath(file?: string): string {
  if (file) return path.resolve(file);
  if (process.env.HTML_SHARE_CONFIG) return path.resolve(process.env.HTML_SHARE_CONFIG);
  const local = path.resolve('html-share.config.yaml');
  if (existsSync(local)) return local;
  const global = path.join(homedir(), '.config', 'html-share', 'config.yaml');
  return existsSync(global) ? global : local;
}

export function loadConfig(file?: string): HtmlShareConfig {
  const configFile = configPath(file);
  if (!existsSync(configFile)) {
    throw new Error(`Config file not found: ${configFile}. Copy html-share.config.example.yaml first.`);
  }
  const raw = parse(readFileSync(configFile, 'utf8')) as Record<string, any>;
  const server = raw?.server ?? {};
  const tailscale = server?.tailscale ?? {};
  const content = raw?.content ?? {};
  const pages = Array.isArray(content.pages) ? content.pages : [];
  const roots = Array.isArray(content.roots) ? content.roots.map((item: unknown) => text(item, 'content.roots[]')) : [];
  if (roots.length === 0) throw new Error('content.roots must contain at least one directory');

  const configuredPublicUrl = publicUrl(server.publicUrl);
  const parsedPublicUrl = new URL(configuredPublicUrl);
  const tailHostname = hostname(tailscale.hostname ?? parsedPublicUrl.hostname, 'server.tailscale.hostname');
  if (tailHostname !== parsedPublicUrl.hostname) {
    throw new Error('server.tailscale.hostname must match server.publicUrl');
  }
  const publicHttpsPort = Number(parsedPublicUrl.port) || 443;
  const httpsPort = port(tailscale.httpsPort, publicHttpsPort, 'server.tailscale.httpsPort');
  if (publicHttpsPort !== httpsPort) {
    throw new Error('server.tailscale.httpsPort must match the port in server.publicUrl');
  }

  return {
    server: {
      host: bindHost(server.host ?? '127.0.0.1'),
      port: port(server.port, 4311, 'server.port'),
      publicUrl: configuredPublicUrl,
      dataDir: relativeDirectory(server.dataDir ?? '.html-share/data', 'server.dataDir'),
      siteDir: relativeDirectory(server.siteDir ?? '.html-share/site', 'server.siteDir'),
      tailscale: { hostname: tailHostname, httpsPort },
    },
    content: {
      roots,
      pages: pages.map((item: unknown, index: number) => {
        const page = typeof item === 'string' ? { path: item } : item as Record<string, unknown>;
        return {
          path: text(page.path, `content.pages[${index}].path`),
          title: typeof page.title === 'string' ? page.title.trim() : undefined,
          slug: typeof page.slug === 'string' ? page.slug.trim() : undefined,
          repository: typeof page.repository === 'string' ? page.repository.trim() : undefined,
          stream: typeof page.stream === 'string' ? page.stream.trim() : undefined,
          streamLabel: typeof page.streamLabel === 'string' ? page.streamLabel.trim() : undefined,
        };
      }),
      maximumShareDays: positiveInteger(content.maximumShareDays, 30, 'content.maximumShareDays'),
      maximumAssetBytes: positiveInteger(content.maximumAssetBytes, 10 * 1024 * 1024, 'content.maximumAssetBytes'),
    },
    configFile,
    baseDir: path.dirname(configFile),
  };
}

export function addPageToConfig(file: string | undefined, pagePath: string, title?: string): boolean {
  const configFile = configPath(file);
  const raw = parse(readFileSync(configFile, 'utf8')) as Record<string, any>;
  raw.content ??= {};
  raw.content.pages ??= [];
  if (!Array.isArray(raw.content.pages)) throw new Error('content.pages must be an array');
  const storedPath = pagePath;
  const exists = raw.content.pages.some((item: unknown) =>
    (typeof item === 'string' ? item : (item as Record<string, unknown>)?.path) === storedPath,
  );
  if (exists) return false;
  raw.content.pages.push(title ? { path: storedPath, title } : { path: storedPath });
  writeFileSync(configFile, stringify(raw, { lineWidth: 120 }));
  return true;
}

export function validatedRoots(config: HtmlShareConfig): string[] {
  return config.content.roots.map((root) => {
    const absolute = resolveFromConfig(config, root);
    if (!existsSync(absolute)) throw new Error(`Content root not found: ${absolute}`);
    return realpathSync(absolute);
  });
}
