import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { HtmlShareConfig } from './config.js';
import { resolveFromConfig } from './config.js';

export interface ReviewRecord {
  id: string;
  sessionId: string;
  title: string;
  question: string;
  context: string;
  recommendation: string;
  status: 'waiting' | 'answered' | 'completed' | 'deleted';
  source: 'owner' | 'claude-code';
  approved?: boolean;
  responseText?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export interface PreferencesRecord {
  starredSources: string[];
  recentSources: string[];
  hiddenSources: string[];
  readMarks: Record<string, { v: string | null; at: string }> | null;
  updatedAt: string;
}

export interface ShareRecord {
  token: string;
  slug: string;
  scope: 'internal' | 'public';
  createdAt: string;
  expiresAt: string;
}

export function stateRoot(config: HtmlShareConfig): string {
  return resolveFromConfig(config, config.server.dataDir);
}

export function siteRoot(config: HtmlShareConfig): string {
  return resolveFromConfig(config, config.server.siteDir);
}

export function ensureLocalState(config: HtmlShareConfig): void {
  mkdirSync(stateRoot(config), { recursive: true });
  mkdirSync(siteRoot(config), { recursive: true });
}

function stateFile(config: HtmlShareConfig, name: string): string {
  if (!/^[a-z0-9-]+\.json$/.test(name)) throw new Error(`Invalid local state file: ${name}`);
  return path.join(stateRoot(config), name);
}

export function loadState<T>(config: HtmlShareConfig, name: string, fallback: T): T {
  ensureLocalState(config);
  const file = stateFile(config, name);
  if (!existsSync(file)) return fallback;
  try {
    return JSON.parse(readFileSync(file, 'utf8')) as T;
  } catch {
    throw new Error(`Local state is not valid JSON: ${file}`);
  }
}

export function saveState<T>(config: HtmlShareConfig, name: string, value: T): void {
  ensureLocalState(config);
  const file = stateFile(config, name);
  const temporary = `${file}.${process.pid}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, { encoding: 'utf8', flag: 'w' });
  renameSync(temporary, file);
}

export function readReviews(config: HtmlShareConfig): ReviewRecord[] {
  const value = loadState<unknown>(config, 'reviews.json', []);
  if (!Array.isArray(value)) throw new Error('Local review state must be an array');
  return value as ReviewRecord[];
}

export function writeReviews(config: HtmlShareConfig, reviews: ReviewRecord[]): void {
  saveState(config, 'reviews.json', reviews);
}

export function readShares(config: HtmlShareConfig): ShareRecord[] {
  const value = loadState<unknown>(config, 'shares.json', []);
  if (!Array.isArray(value)) throw new Error('Local share state must be an array');
  return value as ShareRecord[];
}

export function writeShares(config: HtmlShareConfig, shares: ShareRecord[]): void {
  saveState(config, 'shares.json', shares);
}
