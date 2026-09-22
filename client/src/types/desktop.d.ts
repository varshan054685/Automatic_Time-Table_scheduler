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
        integrity(): Promise<{ ok: boolean; result: string }>;
      };
      institutions: {
        current(): Promise<Record<string, unknown> & { id: number; name: string; type: string; academicYear: string | null; activeYearId: number | null }>;
        list(): Promise<Array<Record<string, unknown>>>;
        create(data: unknown): Promise<Record<string, unknown>>;
        update(id: number, data: unknown): Promise<Record<string, unknown>>;
        delete(id: number): Promise<void>;
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
        conflicts(institutionId?: number): Promise<Array<Record<string, unknown>>>;
        activateVersion(versionId: number): Promise<{ ok: boolean }>;
        deleteVersion(versionId: number): Promise<{ ok: boolean }>;
      };
      scheduler: {
        ready(): Promise<{ ready: boolean; port: number }>;
        generate(opts?: {
          allSections?: boolean;
          sectionIds?: number[];
          institutionId?: number;
          timeLimitSeconds?: number;
        }): Promise<{ jobId: number }>;
        cancel(jobId: number): Promise<{ ok: boolean }>;
        job(jobId: number): Promise<Record<string, unknown>>;
        history(institutionId?: number): Promise<Array<Record<string, unknown>>>;
        staged(jobId: number): Promise<Array<Record<string, unknown>>>;
        accept(jobId: number, label?: string): Promise<{ versionId: number; entries: number }>;
        discard(jobId: number): Promise<{ ok: boolean }>;
        audit(opts?: { institutionId?: number; sectionIds?: number[] }): Promise<Record<string, unknown>>;
        onProgress(cb: (progress: Record<string, unknown>) => void): () => void;
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
      pdf: {
        exportReport(
          kind: "timetable" | "teacherWorkload" | "roomUtilization" | "analytics",
          opts?: { sectionId?: number; departmentId?: number; institutionId?: number },
        ): Promise<{ path?: string; sizeBytes?: number; cancelled?: boolean }>;
      };
      excel: {
        preview(kind: string, institutionId?: number): Promise<Record<string, unknown>>;
        commit(batchId: number): Promise<{ kind: string; created: number; updated: number; batchId: number }>;
        template(kind: string): Promise<{ path?: string; cancelled?: boolean }>;
        batches(): Promise<Array<Record<string, unknown>>>;
      };
      data: {
        resetAll(): Promise<{ ok: boolean }>;
      };
      updater: {
        status(): Promise<{
          state: string;
          currentVersion: string;
          latestVersion: string | null;
          releaseName: string | null;
          releaseDate: string | null;
          releaseNotes: string | null;
          progress: {
            percent: number;
            transferred: number;
            total: number;
            bytesPerSecond: number;
          } | null;
          message: string | null;
          code: string | null;
          silent: boolean;
          updateSupported: boolean;
          unsupportedReason: string | null;
          canCheck: boolean;
          canDownload: boolean;
          canInstall: boolean;
          preInstallBackup: string | null;
          autoCheck: boolean;
          autoDownload: boolean;
        }>;
        check(): Promise<Record<string, unknown>>;
        download(): Promise<Record<string, unknown>>;
        install(): Promise<{ ok: boolean; code: string; message: string; status: Record<string, unknown> }>;
        setAutoOption(key: "autoCheck" | "autoDownload", value: boolean): Promise<Record<string, unknown>>;
        onEvent(cb: (status: Record<string, unknown>) => void): () => void;
      };
    };
  }
}

