/**
 * Offline editing service.
 *
 * Entry point for all master-data mutations. Every change is written to local
 * SQLite immediately (so it shows in the UI) and recorded in the sync queue
 * for later upload. The queue records the server version the row had when the
 * edit was made (__baseVersion) so the server can detect conflicts.
 *
 * The backend remains authoritative: owner edits push direct updates; viewer
 * edits are queued as change requests (the server's existing viewerCheck
 * behavior, replayed offline).
 */
import {
  departmentRepo,
  classroomRepo,
  facultyRepo,
  sectionRepo,
  subjectRepo,
  timeSlotRepo,
} from "@/database/repositories/master-data";
import { changeRequestRepo } from "@/database/repositories/change-requests";
import { queueLocalChange, refreshPendingCount } from "./sync-queue";
import { EntityType } from "@/types/sync";
import { getDb } from "@/database/sqlite";
import { uuid } from "@/utils/id";
import { nowIso } from "@/utils/date";

type Row = Record<string, unknown>;

interface EntityRepoLike {
  findByServerId: (id: number) => Row | undefined;
  findByClientId: (id: string) => Row | undefined;
  insertDirty: (data: Row, workspaceId: number) => { id: number; clientId: string };
  applyLocalUpdate: (id: number, data: Row) => void;
  softDelete: (id: number, opts?: { markPending?: boolean }) => void;
}

const ENTITIES: Record<string, { entityType: EntityType; repo: EntityRepoLike }> = {
  department: { entityType: "department", repo: departmentRepo },
  classroom: { entityType: "classroom", repo: classroomRepo },
  faculty: { entityType: "faculty", repo: facultyRepo },
  section: { entityType: "section", repo: sectionRepo },
  subject: { entityType: "subject", repo: subjectRepo },
  time_slot: { entityType: "time_slot", repo: timeSlotRepo },
};

export type EditableEntity = keyof typeof ENTITIES;

/**
 * Apply a local update to an existing row and queue it for sync.
 * Returns the row's local id.
 */
export function editLocalRow(
  entity: EditableEntity,
  serverId: number,
  changes: Row,
): number {
  const def = ENTITIES[entity];
  if (!def) throw new Error(`Unknown entity ${entity}`);

  const existing = def.repo.findByServerId(serverId);
  if (!existing) throw new Error(`${entity} ${serverId} not found locally`);

  const localId = Number(existing.id);
  const baseVersion = Number(existing.version ?? 1);
  def.repo.applyLocalUpdate(localId, changes);

  queueLocalChange({
    entityType: def.entityType,
    entityId: localId,
    clientId: String(existing.clientId ?? uuid()),
    operation: "UPDATE",
    payload: {
      ...stripLocalKeys(existing),
      ...changes,
      __baseVersion: baseVersion,
    },
  });
  refreshPendingCount();
  return localId;
}

/**
 * Create a new row locally and queue a CREATE for sync.
 * Returns { id, clientId } of the new local row.
 */
export function createLocalRow(
  entity: EditableEntity,
  data: Row,
  workspaceId: number,
): { id: number; clientId: string } {
  const def = ENTITIES[entity];
  if (!def) throw new Error(`Unknown entity ${entity}`);

  const { id, clientId } = def.repo.insertDirty(data, workspaceId);
  queueLocalChange({
    entityType: def.entityType,
    entityId: id,
    clientId,
    operation: "CREATE",
    payload: { ...data, __baseVersion: 0 },
  });
  refreshPendingCount();
  return { id, clientId };
}

/**
 * Soft-delete a row locally and queue a DELETE for sync.
 * Rows created offline (never synced) are removed locally only — nothing to push.
 */
export function deleteLocalRow(
  entity: EditableEntity,
  serverId: number | null,
  clientId: string,
): void {
  const def = ENTITIES[entity];
  if (!def) throw new Error(`Unknown entity ${entity}`);

  const existing = serverId ? def.repo.findByServerId(serverId) : def.repo.findByClientId(clientId);
  if (!existing) return;

  const localId = Number(existing.id);
  const isDirtyCreate = !serverId || existing.syncStatus === "pending";

  if (isDirtyCreate) {
    // Never synced: remove locally, drop queued ops for it.
    getDb().runSync(
      `UPDATE "${def.entityType}" SET "deleted_at" = ?, "updated_at" = ?, "sync_status" = 'synced' WHERE "id" = ?`,
      [nowIso(), nowIso(), localId],
    );
    return;
  }

  def.repo.softDelete(localId, { markPending: true });
  queueLocalChange({
    entityType: def.entityType,
    entityId: localId,
    clientId,
    operation: "DELETE",
    payload: {
      __baseVersion: Number(existing.version ?? 1),
      serverId: existing.serverId ?? serverId,
    },
  });
  refreshPendingCount();
}

/**
 * Viewer edit: create a change request offline instead of a direct edit.
 * Carries the same shape the web app uses (table, id, changes) so the owner's
 * approval flow works unchanged.
 */
export function createChangeRequestOffline(
  data: {
    type: "edit" | "delete";
    table: string;
    id: number;
    changes?: Row;
  },
  workspaceId: number,
  requestedBy: number,
  requesterName?: string,
): { id: number; clientId: string } {
  const clientId = uuid();
  const requestData =
    data.type === "edit"
      ? { table: data.table, id: data.id, changes: data.changes }
      : { table: data.table, id: data.id };
  const { id } = changeRequestRepo.insertDirty(
    {
      type: data.type,
      data: requestData,
      status: "pending",
      requestedBy,
      requesterName,
    } as Row,
    workspaceId,
  );
  queueLocalChange({
    entityType: "change_request",
    entityId: id,
    clientId,
    operation: "CREATE",
    payload: { type: data.type, data: requestData, __baseVersion: 0 },
  });
  refreshPendingCount();
  return { id, clientId };
}

/** Strip local bookkeeping keys (camelCase) from a row before pushing. */
function stripLocalKeys(row: Row): Row {
  const { id, serverId, clientId, workspaceId, version, createdAt, updatedAt, deletedAt, syncStatus, ...rest } = row as Row & {
    id: unknown; serverId: unknown; clientId: unknown; workspaceId: unknown;
    version: unknown; createdAt: unknown; updatedAt: unknown; deletedAt: unknown; syncStatus: unknown;
  };
  void id; void serverId; void clientId; void workspaceId;
  void version; void createdAt; void updatedAt; void deletedAt; void syncStatus;
  return rest;
}
