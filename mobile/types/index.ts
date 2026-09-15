/**
 * Domain types for the mobile app.
 *
 * These mirror the server's PostgreSQL entities (shared/schema.ts) so API
 * payloads and local SQLite rows share one shape. Optional fields reflect
 * what the existing API does or does not return today.
 */

export type SyncStatus = "synced" | "pending" | "failed" | "conflict";

/** Base shape for any record that participates in synchronization. */
export interface Syncable {
  /** Local SQLite row id. */
  id: number;
  /** Server PostgreSQL id (null until the row has been pushed/created remotely). */
  serverId: number | null;
  /** Client-generated UUID used for idempotent offline creates. */
  clientId: string | null;
  workspaceId: number | null;
  version: number;
  createdAt: string | null;
  updatedAt: string | null;
  deletedAt: string | null;
  syncStatus: SyncStatus;
}

export interface User {
  id: number;
  email?: string | null;
  phoneNumber?: string | null;
  name?: string | null;
  role?: string | null;
  avatar?: string | null;
  isVerified?: boolean | null;
}

export interface Workspace {
  id: number;
  name: string;
  ownerId: number;
  referralCode: string;
  adminReferralCode?: string;
  academicYear?: string | null;
  role?: string | null;
}

export interface WorkspaceMember {
  id: number;
  userId: number;
  role: "owner" | "viewer";
  email?: string | null;
  name?: string | null;
}

export interface Department {
  id: number;
  workspaceId: number;
  name: string;
  code: string;
}

export interface Classroom {
  id: number;
  workspaceId: number;
  roomNumber: string;
  capacity: number;
  type: "lecture" | "lab" | string | null;
}

export interface Faculty {
  id: number;
  workspaceId: number;
  name: string;
  code: string;
  departmentId: number;
  email?: string | null;
  availability?: string[] | null;
}

export interface Section {
  id: number;
  workspaceId: number;
  name: string;
  year: number;
  semester: number;
  departmentId: number;
  classroomId?: number | null;
}

export interface Subject {
  id: number;
  workspaceId: number;
  code: string;
  name: string;
  weeklyHours: number;
  departmentId: number;
  facultyId?: number | null;
  sectionId?: number | null;
  type?: "lecture" | "lab" | string | null;
}

export interface TimeSlot {
  id: number;
  workspaceId: number;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  label: string;
}

export interface TimetableEntry {
  id: number;
  workspaceId: number;
  sectionId: number;
  subjectId: number;
  facultyId: number;
  classroomId: number;
  timeSlotId: number;
  /** Joined display data (present when the API returns nested objects). */
  subject?: Subject | null;
  faculty?: Faculty | null;
  classroom?: Classroom | null;
  timeSlot?: TimeSlot | null;
  section?: Section | null;
}

export interface ChangeRequest {
  id: number;
  workspaceId: number;
  requestedBy: number;
  type: "edit" | "delete" | string;
  data: Record<string, unknown>;
  status: "pending" | "approved" | "rejected" | string;
  requesterName?: string | null;
  requesterEmail?: string | null;
  createdAt?: string | null;
}

/** Locally persisted session snapshot (no credentials — cookie lives in SecureStore). */
export interface LocalSession {
  user: User;
  workspace: Workspace & { role: "owner" | "viewer" };
  lastSyncedAt: string | null;
}
