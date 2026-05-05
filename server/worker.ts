import { storage } from "./storage";
import { generateWithPython } from "./python-scheduler";
import { log } from "./index";

/**
 * Process a single section's timetable generation.
 * Writes results to the staging table (generation_results), NOT the live timetable.
 * The caller (queue) is responsible for the atomic swap after all sections complete.
 */
export async function processTimetableJob(job: any) {
  const { workspaceId, sectionId, jobRecordId } = job.data;
  
  log(`[Worker] Started processing section ${sectionId} for job ${jobRecordId}`);

  try {
    // 1. Fetch data for this section
    const section = await storage.getSection(sectionId);
    if (!section) throw new Error(`Section ${sectionId} not found`);

    const allSubjects = await storage.getSubjects(workspaceId);
    const subjectsForSection = allSubjects.filter(
      s => s.sectionId === sectionId || (s.sectionId === null && s.departmentId === section.departmentId)
    );
    
    const allFaculty = await storage.getFaculty(workspaceId);
    // Faculty related to subjects in this section
    const facultyIds = new Set(subjectsForSection.map(s => s.facultyId).filter(Boolean));
    const facultyForSection = allFaculty.filter(f => facultyIds.has(f.id));

    const allClassrooms = await storage.getClassrooms(workspaceId);
    const allTimeSlots = await storage.getTimeSlots(workspaceId);

    if (subjectsForSection.length === 0) {
      log(`[Worker] Section ${sectionId}: No subjects assigned, skipping`);
      return { success: true, saved: 0 };
    }
    if (facultyForSection.length === 0) {
      log(`[Worker] Section ${sectionId}: No faculty assigned, skipping`);
      return { success: true, saved: 0 };
    }

    // 2. Build occupiedSlots from TWO sources:
    //    a) Existing LIVE timetable entries for OTHER sections (not being regenerated in this job)
    //    b) Already-staged results from earlier sections in THIS job
    
    // Source A: Live timetable (other sections)
    const existingEntries = await storage.getTimetable(undefined, undefined, workspaceId);
    const liveOccupied = existingEntries
      .filter(e => e.sectionId !== sectionId && e.timeSlot && e.classroom)
      .map(e => ({
        day: e.timeSlot!.dayOfWeek,
        period: e.timeSlot!.label,
        facultyId: e.facultyId,
        room: e.classroom!.roomNumber,
      }));
    
    // Source B: Staged results from this job (earlier sections already solved)
    const stagedEntries = await storage.getStagedEntriesForConflictCheck(jobRecordId, workspaceId);
    const stagedOccupied = stagedEntries.map(e => ({
      day: e.dayOfWeek,
      period: e.label,
      facultyId: e.facultyId,
      room: e.roomNumber,
    }));

    const occupiedSlots = [...liveOccupied, ...stagedOccupied];

    // 3. Prepare days
    const daySet: Set<string> = new Set();
    allTimeSlots.forEach(s => daySet.add(s.dayOfWeek));
    const dayOrder = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const days = dayOrder.filter(d => daySet.has(d));

    // 4. Call Python Solver (single section — fast solve)
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

    // 5. Write results to STAGING table (NOT live timetable)
    const roomByNumber = new Map(allClassrooms.map(c => [c.roomNumber.trim(), c]));
    const slotByKey = new Map(allTimeSlots.map(s => [`${s.dayOfWeek.trim()}__${s.label.trim()}`, s] as const));

    let saved = 0;
    for (const row of pythonResult.timetable) {
      const room = roomByNumber.get(row.room.trim());
      const slot = slotByKey.get(`${row.day.trim()}__${row.period.trim()}`);
      if (room && slot) {
        await storage.createStagedEntry({
          jobId: jobRecordId,
          workspaceId,
          sectionId,
          subjectId: row.subjectId,
          facultyId: row.facultyId,
          classroomId: room.id,
          timeSlotId: slot.id,
        });
        saved++;
      }
    }

    log(`[Worker] Section ${sectionId}: staged ${saved} entries`);
    return { success: true, saved };

  } catch (error: any) {
    log(`[Worker] Error in section ${sectionId}: ${error.message}`);
    throw error; // Re-throw so the queue can handle it
  }
}
