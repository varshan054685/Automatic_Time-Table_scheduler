import { getDb } from "../sqlite";
import { nowIso } from "@/utils/date";
import { uuid } from "@/utils/id";

export type Row = Record<string, unknown>;

/** Values accepted by expo-sqlite bind parameters. */
export type SqlValue = string | number | null;

/** Wrap a single table's insertable column set (excludes sync bookkeeping). */
type ColumnSet = Record<string, "string" | "number" | "boolean" | "json" | "json-string-array">;

const SYNC_COLUMNS = [
  "server_id",
  "client_id",
  "workspace_id",
  "version",
  "created_at",
  "updated_at",
  "deleted_at",
  "sync_status",
] as const;

function isSyncColumn(name: string): boolean {
  return (SYNC_COLUMNS as readonly string[]).includes(name);
}

function coerceValue(colType: string, value: unknown): SqlValue {
  if (value === undefined) return null;
  if (value === null) return null;
  switch (colType) {
    case "json": {
      const serialized = JSON.stringify(value);
      return serialized === undefined ? null : serialized;
    }
    case "json-string-array":
      return JSON.stringify(value ?? []);
    case "boolean":
      return value ? 1 : 0;
    default:
      return (value as SqlValue) ?? null;
  }
}

function decodeValue(colType: string, value: unknown): unknown {
  if (value === null || value === undefined) return null;
  switch (colType) {
    case "json":
      try {
        return JSON.parse(String(value));
      } catch {
        return null;
      }
    case "json-string-array": {
      try {
        const parsed = JSON.parse(String(value));
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }
    case "boolean":
      return value === 1 || value === true;
    default:
      return value;
  }
}

/**
 * Builds typed CRUD primitives for one table.
 * `columns` maps camelCase column names to their storage type; row keys use the
 * camelCase names (mirroring the server's Drizzle naming) and are translated to
 * snake_case for SQLite.
 */
export function defineRepository<T extends Row>(
  table: string,
  columns: ColumnSet,
) {
  const db = getDb;

  function colNames(): string[] {
    return Object.keys(columns);
  }

  function toSnake(key: string): string {
    return key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
  }

  function toCamel(key: string): string {
    return key.replace(/_([a-z])/g, (_m, c: string) => c.toUpperCase());
  }

  function rowToCamel(raw: Row): Row {
    const out: Row = {};
    for (const [k, v] of Object.entries(raw)) {
      const camel = toCamel(k);
      const colType = columns[camel] ?? "string";
      out[camel] = decodeValue(colType, v);
    }
    return out;
  }

  function findRow(field: string, value: unknown): Row | undefined {
    const safeField = field.replace(/[^a-z_]/gi, "");
    const rows = db().getAllSync(
      `SELECT * FROM "${table}" WHERE "${safeField}" = ? LIMIT 1`,
      [value as SqlValue],
    );
    return (rows[0] as Row | undefined) ?? undefined;
  }

  function findById(id: number): Row | undefined {
    const rows = db().getAllSync(`SELECT * FROM "${table}" WHERE "id" = ? LIMIT 1`, [id]);
    return (rows[0] as Row | undefined) ?? undefined;
  }

  function listForWorkspace<T = Row>(workspaceId: number): T[] {
    const rows = db().getAllSync(
      `SELECT * FROM "${table}" WHERE "workspace_id" = ? AND "deleted_at" IS NULL ORDER BY "id"`,
      [workspaceId],
    );
    return rows.map((r) => rowToCamel(r as Row)) as unknown as T[];
  }

  function listAll<T = Row>(): T[] {
    const rows = db().getAllSync(`SELECT * FROM "${table}" WHERE "deleted_at" IS NULL ORDER BY "id"`);
    return rows.map((r) => rowToCamel(r as Row)) as unknown as T[];
  }

  /**
   * Upsert a server-provided row (matched by server_id). Marks it synced.
   * Sync columns (version/updatedAt/createdAt/clientId/deletedAt) are preserved
   * from the server row when present so conflict detection stays accurate.
   * Returns the local row id.
   */
  function upsertByServerId(serverId: number, data: Partial<T>): number {
    const existing = findRow("server_id", serverId);
    const now = nowIso();
    const columnKeys = Object.keys(columns);

    const rowVersion = (data as Row).version as SqlValue | undefined;
    const rowClientId = (data as Row).clientId as SqlValue | undefined;
    const rowCreatedAt = (data as Row).createdAt as SqlValue | undefined;
    const rowUpdatedAt = (data as Row).updatedAt as SqlValue | undefined;

    if (existing) {
      const values: SqlValue[] = [];
      const assignments: string[] = [];
      for (const key of columnKeys) {
        if (isSyncColumn(key)) continue;
        const value = (data as Row)[key];
        if (value === undefined) continue;
        assignments.push(`"${toSnake(key)}" = ?`);
        values.push(coerceValue(columns[key] as string, value));
      }
      assignments.push(`"version" = ?`, `"updated_at" = ?`, `"sync_status" = 'synced'`, `"deleted_at" = NULL`);
      values.push(rowVersion ?? 1, rowUpdatedAt ?? now);
      if (rowClientId) {
        assignments.push(`"client_id" = ?`);
        values.push(rowClientId);
      }
      db().runSync(
        `UPDATE "${table}" SET ${assignments.join(", ")} WHERE "id" = ?`,
        [...values, Number(existing.id)],
      );
      return Number(existing.id);
    }

    const names: string[] = [];
    const placeholders: string[] = [];
    const insertValues: SqlValue[] = [];
    for (const key of columnKeys) {
      if (isSyncColumn(key)) continue;
      const value = (data as Row)[key];
      if (value === undefined) continue;
      names.push(`"${toSnake(key)}"`);
      placeholders.push("?");
      insertValues.push(coerceValue(columns[key] as string, value));
    }
    names.push(`"server_id"`, `"client_id"`, `"version"`, `"created_at"`, `"updated_at"`, `"sync_status"`);
    placeholders.push("?", "?", "?", "?", "?", "'synced'");
    insertValues.push(serverId, rowClientId ?? uuid(), rowVersion ?? 1, rowCreatedAt ?? now, rowUpdatedAt ?? now);
    const result = db().runSync(
      `INSERT INTO "${table}" (${names.join(", ")}) VALUES (${placeholders.join(", ")})`,
      insertValues,
    );
    return Number(result.lastInsertRowId);
  }



  /** Insert a locally-created (offline) row. Returns { id, clientId }. */
  function insertDirty(data: Partial<T>, workspaceId?: number): { id: number; clientId: string } {
    const clientId = uuid();
    const now = nowIso();
    const names: string[] = [];
    const placeholders: string[] = [];
    const values: SqlValue[] = [];
    for (const key of colNames()) {
      if (isSyncColumn(key)) continue;
      const value = (data as Row)[key];
      if (value === undefined) continue;
      names.push(`"${toSnake(key)}"`);
      placeholders.push("?");
      values.push(coerceValue(columns[key] as string, value));
    }
    names.push(
      `"client_id"`, `"workspace_id"`, `"version"`, `"created_at"`, `"updated_at"`, `"sync_status"`,
    );
    placeholders.push("?", "?", "1", "?", "?", "'pending'");
    values.push(clientId, workspaceId ?? ((data as Row).workspaceId as SqlValue | null) ?? null, now, now);
    const result = db().runSync(
      `INSERT INTO "${table}" (${names.join(", ")}) VALUES (${placeholders.join(", ")})`,
      values,
    );
    return { id: Number(result.lastInsertRowId), clientId };
  }

  /** Apply local (offline) changes to an existing row and mark it dirty. */
  function applyLocalUpdate(id: number, data: Partial<T>): void {
    const existing = findById(id);
    if (!existing) throw new Error(`${table} row ${id} not found`);
    const now = nowIso();
    const assignments: string[] = [];
    const values: SqlValue[] = [];
    for (const key of colNames()) {
      if (isSyncColumn(key)) continue;
      const value = (data as Row)[key];
      if (value === undefined) continue;
      assignments.push(`"${toSnake(key)}" = ?`);
      values.push(coerceValue(columns[key] as string, value));
    }
    assignments.push(
      `"updated_at" = ?`,
      `"version" = "version" + 1`,
      `"sync_status" = 'pending'`,
      `"deleted_at" = NULL`,
    );
    values.push(now);
    db().runSync(`UPDATE "${table}" SET ${assignments.join(", ")} WHERE "id" = ?`, [...values, id]);
  }

  function softDelete(id: number, opts?: { markPending?: boolean }): void {
    db().runSync(
      `UPDATE "${table}" SET "deleted_at" = ?, "updated_at" = ?, "sync_status" = ? WHERE "id" = ?`,
      [nowIso(), nowIso(), opts?.markPending ? "pending" : "synced", id],
    );
  }

  function markSynced(id: number, serverId: number): void {
    db().runSync(
      `UPDATE "${table}" SET "server_id" = ?, "sync_status" = 'synced', "updated_at" = ? WHERE "id" = ?`,
      [serverId, nowIso(), id],
    );
  }

  function markStatus(id: number, syncStatus: string): void {
    db().runSync(
      `UPDATE "${table}" SET "sync_status" = ?, "updated_at" = ? WHERE "id" = ?`,
      [syncStatus, nowIso(), id],
    );
  }

  function countPending(): number {
    const row = db().getFirstSync<{ n: number }>(
      `SELECT COUNT(*) AS n FROM "${table}" WHERE "sync_status" = 'pending'`,
    );
    return row?.n ?? 0;
  }

  return {
    findById: (id: number) => (findById(id) ? (rowToCamel(findById(id)!) as T) : undefined),
    findByServerId: (serverId: number) => {
      const row = findRow("server_id", serverId);
      return row ? (rowToCamel(row) as T) : undefined;
    },
    findByClientId: (clientId: string) => {
      const row = findRow("client_id", clientId);
      return row ? (rowToCamel(row) as T) : undefined;
    },
    listForWorkspace,
    listAll,
    upsertByServerId,
    insertDirty,
    applyLocalUpdate,
    softDelete,
    markSynced,
    markStatus,
    countPending,
    rowToCamel,
  };
}

export type Repository<T extends Row> = ReturnType<typeof defineRepository<T>>;
