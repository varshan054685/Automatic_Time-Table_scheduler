/**
 * Download side of the sync engine.
 *
 * Writes server data into local SQLite (bootstrap snapshot + incremental
 * changes). Local rows that carry pending local edits (sync_status != 'synced')
 * are NEVER overwritten silently — the upload phase resolves them; this module
 * only applies remote state to rows that are currently clean.
 *
 * Rows deleted remotely are soft-deleted locally so history remains intact.
 */
import { getDb } from "@/database/sqlite";
import {
  departmentRepo,
  classroomRepo,
  facultyRepo,
  sectionRepo,
  subjectRepo,
  timeSlotRepo,
} from "@/database/repositories/master-data";
import { timetableEntryRepo } from "@/database/repositories/timetable";
import { changeRequestRepo } from "@/database/repositories/change-requests";
import { workspaceMemberRepo } from "@/database/repositories/master-data";
import { nowIso } from "@/utils/date";
import {
  BootstrapResponse,
  RemoteChange,
} from "@/services/sync";

type Row = Record<string, unknown>;
type UpsertFn = (serverId: number, data: Row) => number;

/** Canonical entity → local repo mapping used by both bootstrap and changes. */
export interface EntityRepo {
  table: string;
  upsert: UpsertFn;
  findByServerId: (id: number) => Row | undefined;
}

export const ENTITY_REPOS: Record<string, EntityRepo> = {
  department: {
    table: "department",
    upsert: (serverId, data) => departmentRepo.upsertByServerId(serverId, data as never),
    findByServerId: (id) => departmentRepo.findByServerId(id) as Row | undefined,
  },
  classroom: {
    table: "classroom",
    upsert: (serverId, data) => classroomRepo.upsertByServerId(serverId, data as never),
    findByServerId: (id) => classroomRepo.findByServerId(id) as Row | undefined,
  },
  faculty: {
    table: "faculty",
    upsert: (serverId, data) => facultyRepo.upsertByServerId(serverId, data as never),
    findByServerId: (id) => facultyRepo.findByServerId(id) as Row | undefined,
  },
  section: {
    table: "section",
    upsert: (serverId, data) => sectionRepo.upsertByServerId(serverId, data as never),
    findByServerId: (id) => sectionRepo.findByServerId(id) as Row | undefined,
  },
  subject: {
    table: "subject",
    upsert: (serverId, data) => subjectRepo.upsertByServerId(serverId, data as never),
    findByServerId: (id) => subjectRepo.findByServerId(id) as Row | undefined,
  },
  time_slot: {
    table: "time_slot",
    upsert: (serverId, data) => timeSlotRepo.upsertByServerId(serverId, data as never),
    findByServerId: (id) => timeSlotRepo.findByServerId(id) as Row | undefined,
  },
  timetable_entry: {
    table: "timetable_entry",
    upsert: (serverId, data) => timetableEntryRepo.upsertByServerId(serverId, data as never),
    findByServerId: (id) => timetableEntryRepo.findByServerId(id) as Row | undefined,
  },
  change_request: {
    table: "change_request",
    upsert: (serverId, data) => changeRequestRepo.upsertByServerId(serverId, data as never),
    findByServerId: (id) => changeRequestRepo.findByServerId(id) as Row | undefined,
  },
};

function softDeleteLocalRow(repo: EntityRepo, serverId: number): void {
  const local = repo.findByServerId(serverId);
  if (!local) return;
  const db = getDb();
  // The upserted row exists; mark it deleted locally without touching pending edits.
  db.runSync(
    `UPDATE "${repo.table}" SET "deleted_at" = ?, "updated_at" = ?, "sync_status" = 'synced' WHERE "server_id" = ?`,
    [nowIso(), nowIso(), serverId],
  );
}

/**
 * Apply one remote change to the local database.
 * Returns true when the local DB was modified.
 */
export function applyRemoteChange(change: RemoteChange): boolean {
  const repo = ENTITY_REPOS[change.entity];
  if (!repo) return false;

  const isDirtyLocally = (serverId: number): boolean => {
    const local = repo.findByServerId(serverId) as Row | undefined;
    return local?.sync_status === "pending" || local?.sync_status === "conflict";
  };

  switch (change.operation) {
    case "DELETE": {
      // Keep pending local edits: if the local row is dirty, ignore the remote
      // delete (upload will resolve). Otherwise soft-delete locally.
      if (isDirtyLocally(change.id)) return false;
      softDeleteLocalRow(repo, change.id);
      return true;
    }
    case "CREATE":
    case "UPDATE": {
      if (isDirtyLocally(change.id)) return false;
      repo.upsert(change.id, change.row);
      return true;
    }
  }
}

/**
 * Apply a full bootstrap snapshot. Used on first login or after a full reset.
 * Non-destructive: rows with local pending edits are preserved.
 */
export function applyBootstrap(bootstrap: BootstrapResponse): void {
  const db = getDb();
  db.execSync("BEGIN TRANSACTION");
  try {
    // Workspace snapshot → sync_metadata + app_session workspace id is handled by
    // the sync engine; here we only store master data + timetable + requests.
    const collections: Array<{ entity: string; rows: Row[] }> = [
      { entity: "department", rows: bootstrap.departments },
      { entity: "classroom", rows: bootstrap.classrooms },
      { entity: "faculty", rows: bootstrap.faculty },
      { entity: "section", rows: bootstrap.sections },
      { entity: "subject", rows: bootstrap.subjects },
      { entity: "time_slot", rows: bootstrap.timeSlots },
      { entity: "timetable_entry", rows: bootstrap.timetableEntries },
      { entity: "change_request", rows: bootstrap.changeRequests },
    ];

    for (const { entity, rows } of collections) {
      const repo = ENTITY_REPOS[entity];
      if (!repo) continue;
      for (const row of rows) {
        const serverId = Number(row.id);
        if (!serverId) continue;
        applyRemoteChange({ entity, id: serverId, operation: "CREATE", row });
      }
    }

    // Members: the bootstrap returns workspace members with a userId and role.
    for (const member of bootstrap.members) {
      const serverId = Number(member.id);
      if (!serverId) continue;
      workspaceMemberRepo.upsertByServerId(serverId, member as never);
    }

    db.execSync("COMMIT");
  } catch (err) {
    db.execSync("ROLLBACK");
    throw err;
  }
}

/** Per-section timetable bookkeeping (source + label) mirrored from entries. */
export function refreshTimetableIndex(workspaceId: number): void {
  const db = getDb();
  const rows = db.getAllSync(
    `SELECT "section_id", COUNT(*) AS n
     FROM "timetable_entry"
     WHERE "workspace_id" = ? AND "deleted_at" IS NULL
     GROUP BY "section_id"`,
    [workspaceId],
  );
  for (const row of rows as Array<Record<string, unknown>>) {
    const sectionId = Number(row.section_id);
    const existing = db.getFirstSync<{ id: number }>(
      `SELECT "id" FROM "timetable" WHERE "section_id" = ?`,
      [sectionId],
    );
    if (existing) {
      db.runSync(
        `UPDATE "timetable" SET "label" = ?, "source" = 'cloud', "updated_at" = ? WHERE "id" = ?`,
        [`Section ${sectionId}`, nowIso(), existing.id],
      );
    } else {
      db.runSync(
        `INSERT INTO "timetable" ("client_id", "workspace_id", "section_id", "label", "source", "version", "created_at", "updated_at", "sync_status")
         VALUES (?, ?, ?, ?, 'cloud', 1, ?, ?, 'synced')`,
        [`section-${sectionId}`, workspaceId, sectionId, `Section ${sectionId}`, nowIso(), nowIso()],
      );
    }
  }
}
