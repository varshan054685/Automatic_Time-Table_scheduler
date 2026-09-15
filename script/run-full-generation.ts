import pg from 'pg';
import { storage } from '../server/storage';
import { processTimetableJob } from '../server/worker';
import 'dotenv/config';

async function runFullGeneration() {
  console.log("🚀 Starting full timetable generation & promotion...");
  try {
    const workspaceId = 1;
    const allSections = await storage.getSections(workspaceId);
    console.log(`Found ${allSections.length} sections:`, allSections.map(s => s.name));

    const jobRecord = await storage.createGenerationJob(workspaceId, allSections.length);
    console.log(`Created generation job #${jobRecord.id}`);

    const succeededSectionIds: number[] = [];

    for (const section of allSections) {
      console.log(`\n--- Processing section ${section.id} (${section.name}) ---`);
      const job = {
        data: {
          workspaceId,
          sectionId: section.id,
          jobRecordId: jobRecord.id,
        }
      };

      try {
        const res = await processTimetableJob(job);
        console.log(`Section ${section.name} result: saved ${res.saved} entries`);
        if (res.saved > 0) {
          succeededSectionIds.push(section.id);
        }
        await storage.updateJobProgress(jobRecord.id, succeededSectionIds.length);
      } catch (err: any) {
        console.error(`Section ${section.name} failed:`, err.message);
      }
    }

    if (succeededSectionIds.length > 0) {
      console.log(`\nPromoting staged entries for ${succeededSectionIds.length} sections...`);
      const promotedCount = await storage.promoteStagedEntries(jobRecord.id, workspaceId, succeededSectionIds);
      await storage.updateJobStatus(jobRecord.id, "completed");
      console.log(`✅ SUCCESS! Promoted ${promotedCount} timetable entries to live database.`);
    } else {
      console.log("❌ No entries were generated.");
    }

  } catch (err: any) {
    console.error("Full generation failed:", err);
  }
}

runFullGeneration();
