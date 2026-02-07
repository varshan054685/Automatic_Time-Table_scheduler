import { storage } from "./storage";
import { type TimetableEntry } from "@shared/schema";

// Simple greedy scheduler
export async function generateTimetable(departmentId: number, semester?: number): Promise<number> {
  // 1. Fetch all required data
  const subjects = await storage.getSubjectsByDepartment(departmentId);
  const sections = await storage.getSections();
  const classrooms = await storage.getClassrooms();
  const faculty = await storage.getFaculty();
  const timeSlots = await storage.getTimeSlots();

  // Filter sections by semester if provided, or just department
  const relevantSections = sections.filter(s => 
    s.departmentId === departmentId && 
    (semester ? s.semester === semester : true)
  );

  if (relevantSections.length === 0) {
    throw new Error("No sections found for this department/semester");
  }

  // Clear existing timetable for these sections to avoid duplicates/conflicts with old runs
  for (const section of relevantSections) {
    await storage.clearTimetable(section.id);
  }

  let scheduledCount = 0;

  // 2. Schedule
  // Iterate over sections
  for (const section of relevantSections) {
    // For each section, we need to schedule its subjects
    // We don't have a direct "Subject-Section" link in the schema (e.g., Curriculum), 
    // so we'll assume ALL subjects of the department are valid for the section's semester.
    // In a real app, we'd have a 'Curriculum' table. 
    // Heuristic: Match subject 'year/semester' if we had it, or just schedule all department subjects.
    // Let's assume subjects are shared across the department for now.
    
    for (const subject of subjects) {
      const requiredSlots = subject.weeklyHours;
      let slotsAssigned = 0;

      // Find faculty for this subject (naive: just pick the first one in the dept, or random)
      // In real app: Faculty-Subject mapping.
      const availableFaculty = faculty.filter(f => f.departmentId === departmentId);
      if (availableFaculty.length === 0) continue; 
      
      // Simple round-robin or random assignment of faculty to subject/section
      const assignedFaculty = availableFaculty[Math.floor(Math.random() * availableFaculty.length)];

      for (const slot of timeSlots) {
        if (slotsAssigned >= requiredSlots) break;

        // Check availability
        // 1. Is Section free? (We are building it, so we check DB + local cache if we had one. 
        //    Since we cleared DB, we can just check if we already assigned this slot to this section in this run? 
        //    Wait, we need to check against OTHER allocations made in this transaction. 
        //    For simplicity, let's query DB for global conflicts or keep a local set.)
        
        // 2. Is Faculty free?
        // 3. Is Room free?
        
        // Let's try to find a room
        let assignedRoom = null;
        for (const room of classrooms) {
          // Check if room is taken at this slot by anyone
          // This requires checking the *current* state of the schedule, including what we just added.
          // Since we are writing to DB sequentially, let's just do a naive "try insert" or check.
          // PERFORMANCE WARNING: This is N^3 DB calls. 
          // For a "Lite" app, let's just proceed.
          
          const existingRoomEntry = (await storage.getTimetable(undefined, undefined))
            .find(t => t.timeSlotId === slot.id && t.classroomId === room.id);
            
          if (!existingRoomEntry) {
            assignedRoom = room;
            break;
          }
        }

        if (!assignedRoom) continue; // No rooms available for this slot

        // Check faculty availability
        const existingFacultyEntry = (await storage.getTimetable(undefined, assignedFaculty.id))
            .find(t => t.timeSlotId === slot.id);
        
        if (existingFacultyEntry) continue; // Faculty busy

        // Check section availability
        const existingSectionEntry = (await storage.getTimetable(section.id, undefined))
            .find(t => t.timeSlotId === slot.id);

        if (existingSectionEntry) continue; // Section busy

        // Create Entry
        await storage.createTimetableEntry({
          sectionId: section.id,
          subjectId: subject.id,
          facultyId: assignedFaculty.id,
          classroomId: assignedRoom.id,
          timeSlotId: slot.id,
        });

        slotsAssigned++;
        scheduledCount++;
      }
    }
  }

  return scheduledCount;
}
