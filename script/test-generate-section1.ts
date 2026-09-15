import { processTimetableJob } from '../server/worker';
import { storage } from '../server/storage';
import 'dotenv/config';

async function testSection1() {
  console.log("Testing generation for Section 1 (I B.com.(IT))...");
  try {
    const job = {
      data: {
        workspaceId: 1,
        sectionId: 1,
        jobRecordId: 99999, // mock job ID
      }
    };
    
    // Check what processTimetableJob does
    const result = await processTimetableJob(job);
    console.log("Generation result:", result);
  } catch (err: any) {
    console.error("Section 1 generation error:", err.message);
    if (err.stack) console.error(err.stack);
  }
}

testSection1();
