/**
 * Ambient declaration for the preload bridge. Structure mirrors
 * electron/preload.ts (kept in sync manually).
 */
export {};

declare global {
  interface DesktopApiNamespace {
    [key: string]: unknown;
  }

  interface Window {
    api?: {
      system: {
        version(): Promise<Record<string, unknown>>;
        openPath(kind: "backups" | "exports" | "imports" | "reports" | "logs" | "database"): Promise<string>;
      };
      database: {
        status(): Promise<{ schemaVersion: number; paths: Record<string, string> }>;
      };
      institutions: {
        current(): Promise<Record<string, unknown> & { id: number; name: string; type: string; academicYear: string | null; activeYearId: number | null }>;
        update(id: number, data: unknown): Promise<Record<string, unknown>>;
      };
      academicYears: {
        list(institutionId?: number): Promise<Array<Record<string, unknown>>>;
        create(data: unknown): Promise<Record<string, unknown>>;
        activate(institutionId: number, yearId: number): Promise<{ ok: boolean }>;
        delete(id: number): Promise<void>;
      };
      departments: {
        list(institutionId?: number): Promise<Array<Record<string, unknown>>>;
        create(data: unknown): Promise<Record<string, unknown>>;
        update(id: number, data: unknown): Promise<Record<string, unknown>>;
        delete(id: number): Promise<void>;
      };
      sections: {
        list(institutionId?: number): Promise<Array<Record<string, unknown>>>;
        create(data: unknown): Promise<Record<string, unknown>>;
        update(id: number, data: unknown): Promise<Record<string, unknown>>;
        delete(id: number): Promise<void>;
      };
      teachers: {
        list(institutionId?: number): Promise<Array<Record<string, unknown>>>;
        create(data: unknown): Promise<Record<string, unknown>>;
        update(id: number, data: unknown): Promise<Record<string, unknown>>;
        delete(id: number): Promise<void>;
        getAvailability(teacherId: number): Promise<Record<string, number>>;
        setAvailability(teacherId: number, slotIds: number[], available: boolean): Promise<{ ok: boolean }>;
      };
      classrooms: {
        list(institutionId?: number): Promise<Array<Record<string, unknown>>>;
        create(data: unknown): Promise<Record<string, unknown>>;
        update(id: number, data: unknown): Promise<Record<string, unknown>>;
        delete(id: number): Promise<void>;
      };
      timeSlots: {
        list(institutionId?: number): Promise<Array<Record<string, unknown>>>;
        create(data: unknown): Promise<Record<string, unknown>>;
        update(id: number, data: unknown): Promise<Record<string, unknown>>;
        delete(id: number): Promise<void>;
      };
      subjects: {
        list(institutionId?: number): Promise<Array<Record<string, unknown>>>;
        create(data: unknown): Promise<Record<string, unknown>>;
        update(id: number, data: unknown): Promise<Record<string, unknown>>;
        delete(id: number): Promise<void>;
      };
      timetable: {
        entries(filters?: { versionId?: number; sectionId?: number; teacherId?: number; classroomId?: number; institutionId?: number }): Promise<Array<Record<string, unknown>>>;
        versions(institutionId?: number): Promise<Array<Record<string, unknown>>>;
      };
      dashboard: {
        stats(institutionId: number): Promise<Record<string, number>>;
      };
      backup: {
        list(): Promise<Array<Record<string, unknown>>>;
        create(label?: string): Promise<Record<string, unknown>>;
        restore(id: string): Promise<unknown>;
        delete(id: string): Promise<{ ok: boolean }>;
        verify(id: string): Promise<{ ok: boolean; reason?: string; sizeBytes: number }>;
      };
      settings: {
        all(): Promise<Record<string, unknown>>;
        get(key: string): Promise<unknown>;
        set(key: string, value: unknown): Promise<{ ok: boolean }>;
      };
    };
  }
}
