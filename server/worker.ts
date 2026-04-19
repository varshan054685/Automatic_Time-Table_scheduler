import { Worker, Job } from "bullmq";
import { connection, timetableQueue } from "./queue";
import { storage } from "./storage";
import { generateWithPython } from "./python-scheduler";
import { log } from "./index";

export const timetableWorker = new Worker(
  "timetable-generation",
  async (job: Job) => {
    const { workspaceId, sectionId, jobRecordId } = job.data;
    
    log(`[Worker] Started processing section ${sectionId} for job ${jobRecordId}`);

    try {
      // 1. Fetch data for this section
      const section = await storage.getSection(sectionId);
      if (!section) throw new Error(`Section ${sectionId} not found`);

      const allSubjects = await storage.getSubjects(workspaceId);
      const subjectsForSection = allSubjects.filter(s => s.sectionId === sectionId || s.sectionId === null);
      
      const allFaculty = await storage.getFaculty(workspaceId);
      // Faculty related to subjects in this section
      const facultyIds = new Set(subjectsForSection.map(s => s.facultyId).filter(Boolean));
      const facultyForSection = allFaculty.filter(f => facultyIds.has(f.id));

      const allClassrooms = await storage.getClassrooms(workspaceId);
      const allTimeSlots = await storage.getTimeSlots(workspaceId);

      // 2. Fetch already scheduled slots (to avoid conflicts)
      const existingEntries = await storage.getTimetable(undefined, undefined, workspaceId);
      // Filter out entries for THIS section (if any, though we should have cleared or we are building incrementally)
      const otherEntries = existingEntries.filter(e => e.sectionId !== sectionId);
      
      const occupiedSlots = otherEntries.map(e => ({
        day: e.timeSlot.dayOfWeek,
        period: e.timeSlot.label,
        facultyId: e.facultyId,
        room: e.classroom.roomNumber,
      }));

      // 3. Prepare days
      const daySet: Set<string> = new Set();
      allTimeSlots.forEach(s => daySet.add(s.dayOfWeek));
      const dayOrder = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
      const days = dayOrder.filter(d => daySet.has(d));

      // 4. Call Python Solver
      const pythonResult = await generateWithPython({
        classrooms: allClassrooms.map(c => ({ roomNumber: c.roomNumber })),
        subjects: subjectsForSection.map(s => ({
          id: s.id, name: s.name, departmentId: s.departmentId,
          sectionId: s.sectionId, facultyId: s.facultyId,
          weeklyHours: s.weeklyHours, type: s.type,
        })),
        faculty: facultyForSection.map(f => ({ id: f.id, name: f.name, departmentId: f.departmentId })),
        sections: [{ id: section.id, name: section.name, departmentId: section.departmentId }],
        timeslots: allTimeSlots.map(slot => ({
          id: slot.id, dayOfWeek: slot.dayOfWeek, label: slot.label,
          startTime: slot.startTime, endTime: slot.endTime,
        })),
        days,
        occupiedSlots,
      });

      if (!pythonResult.timetable || pythonResult.timetable.length === 0) {
        throw new Error(pythonResult.error || "No solution found for this section.");
      }

      // 5. Save results (incremental)
      // Note: We don't clear the whole table here, we only clear for THIS section
      await storage.clearTimetable(sectionId);
      
      const roomByNumber = new Map(allClassrooms.map(c => [c.roomNumber.trim(), c]));
      const slotByKey = new Map(allTimeSlots.map(s => [`${s.dayOfWeek.trim()}__${s.label.trim()}`, s] as const));

      for (const row of pythonResult.timetable) {
        const room = roomByNumber.get(row.room.trim());
        const slot = slotByKey.get(`${row.day.trim()}__${row.period.trim()}`);
        if (room && slot) {
          await storage.createTimetableEntry({
            sectionId,
            subjectId: row.subjectId,
            facultyId: row.facultyId,
            classroomId: room.id,
            timeSlotId: slot.id,
            workspaceId,
          });
        }
      }

      // 6. Update progress
      const currentJob = await storage.getJobStatus(jobRecordId);
      if (currentJob) {
        const completed = currentJob.completedSections + 1;
        await storage.updateJobProgress(jobRecordId, completed);
        
        if (completed >= currentJob.totalSections) {
          await storage.updateJobStatus(jobRecordId, "completed");
          log(`[Worker] Job ${jobRecordId} FULLY COMPLETED`);
        }
      }

    } catch (error: any) {
      log(`[Worker] Error in section ${sectionId}: ${error.message}`);
      await storage.updateJobStatus(jobRecordId, "failed", error.message);
      throw error; // Let BullMQ handle retries
    }
  },
  { 
    connection,
    concurrency: 1, // Crucial for non-conflicting incremental generation
  }
);
