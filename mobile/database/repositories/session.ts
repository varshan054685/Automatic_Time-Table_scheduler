import { getDb } from "../sqlite";
import { nowIso } from "@/utils/date";
import { LocalSession, Workspace } from "@/types";

interface SessionRow {
  user_json: string;
  workspace_json: string;
  last_synced_at: string | null;
}

/** The workspace snapshot stored alongside the user (role is the membership role). */
export type StoredWorkspace = Workspace & { role: "owner" | "viewer" };

export function saveSession(session: LocalSession): void {
  const db = getDb();
  db.runSync(
    `INSERT INTO "app_session" ("id", "user_json", "workspace_json", "last_synced_at", "updated_at")
     VALUES (1, ?, ?, ?, ?)
     ON CONFLICT ("id") DO UPDATE SET
       "user_json" = excluded."user_json",
       "workspace_json" = excluded."workspace_json",
       "last_synced_at" = excluded."last_synced_at",
       "updated_at" = excluded."updated_at"`,
    [
      JSON.stringify(session.user),
      JSON.stringify(session.workspace),
      session.lastSyncedAt,
      nowIso(),
    ],
  );
}

export function loadSession(): LocalSession | null {
  const db = getDb();
  const row = db.getFirstSync<SessionRow>(
    `SELECT "user_json", "workspace_json", "last_synced_at" FROM "app_session" WHERE "id" = 1`,
  );
  if (!row) return null;
  try {
    return {
      user: JSON.parse(row.user_json),
      workspace: JSON.parse(row.workspace_json) as StoredWorkspace,
      lastSyncedAt: row.last_synced_at,
    };
  } catch {
    return null;
  }
}

export function clearSession(): void {
  getDb().runSync(`DELETE FROM "app_session" WHERE "id" = 1`);
}

export function updateLastSyncedAt(timestamp: string | null): void {
  getDb().runSync(
    `UPDATE "app_session" SET "last_synced_at" = ?, "updated_at" = ? WHERE "id" = 1`,
    [timestamp, nowIso()],
  );
}
