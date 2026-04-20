import { storage } from "./storage";
import { processTimetableJob } from "./worker";
import { log } from "./index";

// In-memory queue for section-based generation (no Redis dependency)
const memoryQueue: any[] = [];
let isProcessing = false;

/**
 * Process the queue sequentially. Each section sees the previously solved
 * sections' results as occupiedSlots, preventing faculty/room conflicts.
 * 
 * On completion: performs an atomic swap from staging → live timetable.
 * On failure: continues remaining sections, marks partial failures.
 */
async function processQueue() {
  if (isProcessing || memoryQueue.length === 0) return;
  isProcessing = true;
  
  // Group jobs by jobRecordId so we can handle the atomic swap per-job
  const jobGroups = new Map<number, any[]>();
  while (memoryQueue.length > 0) {
    const job = memoryQueue.shift();
    const groupId = job.data.jobRecordId;
    if (!jobGroups.has(groupId)) jobGroups.set(groupId, []);
    jobGroups.get(groupId)!.push(job);
  }

  for (const [jobRecordId, jobs] of jobGroups) {
    let completedSections = 0;
    let failedSections = 0;
    const succeededSectionIds: number[] = [];
    const errors: string[] = [];
    const workspaceId = jobs[0].data.workspaceId;

    log(`[Queue] Job ${jobRecordId}: processing ${jobs.length} section(s) sequentially`);

    for (const job of jobs) {
      const sectionId = job.data.sectionId;
      try {
        const result = await processTimetableJob(job);
        completedSections++;
        if (result.saved > 0) {
          succeededSectionIds.push(sectionId);
        }
        
        // Update progress after each section
        await storage.updateJobProgress(jobRecordId, completedSections, failedSections);
        log(`[Queue] Job ${jobRecordId}: section ${sectionId} done (${completedSections}/${jobs.length})`);
        
      } catch (error: any) {
        failedSections++;
        completedSections++;
        errors.push(`Section ${sectionId}: ${error.message}`);
        
        // Update progress but continue processing remaining sections
        await storage.updateJobProgress(jobRecordId, completedSections, failedSections);
        log(`[Queue] Job ${jobRecordId}: section ${sectionId} FAILED, continuing... (${completedSections}/${jobs.length})`);
      }
    }

    // All sections processed — decide outcome
    if (failedSections === 0 && succeededSectionIds.length > 0) {
      // ✅ Full success: atomic swap staging → live
      try {
        const promoted = await storage.promoteStagedEntries(jobRecordId, workspaceId, succeededSectionIds);
        await storage.updateJobStatus(jobRecordId, "completed");
        log(`[Queue] Job ${jobRecordId}: COMPLETED — promoted ${promoted} entries to live timetable`);
      } catch (swapError: any) {
        await storage.cleanupStagedEntries(jobRecordId);
        await storage.updateJobStatus(jobRecordId, "failed", `Swap failed: ${swapError.message}`);
        log(`[Queue] Job ${jobRecordId}: FAILED during atomic swap: ${swapError.message}`);
      }
    } else if (failedSections > 0 && succeededSectionIds.length > 0) {
      // ⚠️ Partial success: still promote what we have
      try {
        const promoted = await storage.promoteStagedEntries(jobRecordId, workspaceId, succeededSectionIds);
        await storage.updateJobStatus(jobRecordId, "partial", errors.join("; "));
        log(`[Queue] Job ${jobRecordId}: PARTIAL — promoted ${promoted} entries, ${failedSections} section(s) failed`);
      } catch (swapError: any) {
        await storage.cleanupStagedEntries(jobRecordId);
        await storage.updateJobStatus(jobRecordId, "failed", `Swap failed: ${swapError.message}`);
      }
    } else {
      // ❌ Total failure
      await storage.cleanupStagedEntries(jobRecordId);
      await storage.updateJobStatus(jobRecordId, "failed", errors.join("; "));
      log(`[Queue] Job ${jobRecordId}: FAILED — all sections failed`);
    }
  }

  isProcessing = false;
}

/**
 * Enqueue generation jobs for a set of sections.
 * Returns the job record for status polling.
 */
export async function addGenerationJobs(workspaceId: number, sections: any[]) {
  const jobRecord = await storage.createGenerationJob(workspaceId, sections.length);
  
  const jobs = sections.map(section => ({
    name: "generate-section",
    data: {
      workspaceId,
      sectionId: section.id,
      jobRecordId: jobRecord.id,
    },
  }));

  // Add all section jobs to the queue
  memoryQueue.push(...jobs);
  
  // Start processing in the background (non-blocking)
  processQueue().catch(e => log(`Queue processing error: ${e}`));
  
  return jobRecord;
}
