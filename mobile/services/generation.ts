/**
 * Timetable generation (online).
 *
 * The authoritative solver is the existing Python OR-Tools backend, reached
 * through the Express API. Generation is async: POST starts a job, then the
 * client polls the status endpoint until completion. When the job finishes,
 * the sync engine picks up the new timetable entries via the incremental
 * download.
 *
 * Offline generation is intentionally NOT faked — see Phase 9 notes in the
 * architecture report (a local CP-SAT-equivalent solver is not feasible in
 * Expo today; offline, the app validates but does not invent a timetable).
 */
import { api } from "./api";

export interface GenerationJobInfo {
  id: number;
  status: "pending" | "processing" | "completed" | "failed" | "partial";
  totalSections: number;
  completedSections: number;
  failedSections: number;
  error: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

/** Start cloud generation for a department (and optional semester). */
export async function startGeneration(input: {
  departmentId: number;
  semester?: number;
}): Promise<{ jobId: number; message: string }> {
  const res = await api.post<{ jobId: number; message: string; status: string }>(
    "/api/generate-timetable",
    { departmentId: input.departmentId, semester: input.semester },
    { timeoutMs: 30_000 },
  );
  return { jobId: res.data.jobId, message: res.data.message };
}

/** Start cloud generation for ALL sections (owner action). */
export async function regenerateAll(): Promise<{ jobId: number; message: string }> {
  const res = await api.post<{ jobId: number; message: string; status: string }>(
    "/api/timetable/regenerate-all",
    {},
    { timeoutMs: 30_000 },
  );
  return { jobId: res.data.jobId, message: res.data.message };
}

/** Poll a generation job's status. */
export async function getGenerationStatus(jobId: number): Promise<GenerationJobInfo> {
  const res = await api.get<GenerationJobInfo>(
    `/api/timetable/generation-status/${jobId}`,
    { timeoutMs: 30_000 },
  );
  return res.data;
}

/**
 * Poll until the job completes, fails, or times out.
 * Returns the final job info. Rejects on network errors.
 */
export async function pollGenerationUntilDone(
  jobId: number,
  onProgress?: (job: GenerationJobInfo) => void,
  timeoutMs = 180_000,
  intervalMs = 2_500,
): Promise<GenerationJobInfo> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const job = await getGenerationStatus(jobId);
    onProgress?.(job);
    if (job.status === "completed" || job.status === "failed" || job.status === "partial") {
      return job;
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error("Generation is taking longer than expected. You can check again later.");
}
