function isoOrNull(value: unknown): string | null {
  const text = typeof value === 'string' ? value.trim() : '';
  return text && !Number.isNaN(Date.parse(text)) ? text : null;
}

export function cleanReadMark(value: unknown): { v: string | null; at: string } | null {
  const legacy = typeof value === 'string' ? isoOrNull(value) : null;
  if (legacy) return { v: legacy, at: legacy };
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as { v?: unknown; at?: unknown };
  const at = isoOrNull(record.at);
  return at ? { v: isoOrNull(record.v), at } : null;
}

export function cleanReadMarks(value: unknown, maximum: number): Record<string, { v: string | null; at: string }> {
  if (value === undefined || value === null) return {};
  if (typeof value !== 'object' || Array.isArray(value)) throw new Error('readMarks is invalid');
  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length > maximum) throw new Error('readMarks is too large');
  const marks: Record<string, { v: string | null; at: string }> = {};
  for (const [source, mark] of entries) {
    if (!source || source.length > 500) continue;
    const cleaned = cleanReadMark(mark);
    if (cleaned) marks[source] = cleaned;
  }
  return marks;
}
