/**
 * Row shape helpers. The renderer expects camelCase keys (legacy UI contract);
 * SQLite stores snake_case columns. Convert at the IPC boundary only.
 */
type Row = Record<string, unknown>;

export function toCamel(key: string): string {
  return key.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase());
}

export function mapRow<T = Record<string, unknown>>(row: unknown): T {
  if (!row || typeof row !== "object") return row as T;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row as Row)) {
    out[toCamel(k)] = v;
  }
  return out as T;
}

export function mapRows<T = Record<string, unknown>>(rows: unknown[]): T[] {
  return rows.map((r) => mapRow<T>(r));
}
