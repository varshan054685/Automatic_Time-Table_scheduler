import { storage } from "./storage";
import { processTimetableJob } from "./worker";
import { log } from "./index";

// In-memory queue to replace BullMQ and avoid Redis dependency
const memoryQueue: any[] = [];
let isProcessing = false;

async function processQueue() {
  if (isProcessing || memoryQueue.length === 0) return;
  isProcessing = true;
  
  while (memoryQueue.length > 0) {
    const job = memoryQueue.shift();
    try {
      await processTimetableJob(job);
    } catch (error) {
      log(`[MemoryQueue] Job failed: ${error}`);
      // Simple retry logic could go here
    }
  }
  
  isProcessing = false;
}

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
  
  // Start processing in the background
  processQueue().catch(e => log(`Queue processing error: ${e}`));
  
  return jobRecord;
}
