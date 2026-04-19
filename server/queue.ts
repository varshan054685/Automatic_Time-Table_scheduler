import { Queue, Worker, Job } from "bullmq";
import IORedis from "ioredis";
import { storage } from "./storage";
import { generateWithPython } from "./python-scheduler";
import { log } from "./index";

const redisUrl = process.env.REDIS_URL || "redis://127.0.0.1:6379";

export const connection = new IORedis(redisUrl, {
  maxRetriesPerRequest: null,
});

export const timetableQueue = new Queue("timetable-generation", {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 5000,
    },
    removeOnComplete: true,
  },
});

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

  await timetableQueue.addBulk(jobs);
  return jobRecord;
}
