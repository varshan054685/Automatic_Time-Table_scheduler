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
      
      // Use assigned faculty/section from subject if available
      const targetFaculty = subject.facultyId ? faculty.find(f => f.id === subject.facultyId) : null;
      const targetSection = subject.sectionId ? relevantSections.find(s => s.id === subject.sectionId) : null;

      // If subject is tied to a specific section, only schedule for that section
      const sectionsToSchedule = targetSection ? [targetSection] : relevantSections;

      for (const currentSection of sectionsToSchedule) {
        let slotsAssigned = 0;
        
        // Find faculty for this subject
        const availableFaculty = faculty.filter(f => f.departmentId === departmentId);
        if (availableFaculty.length === 0 && !targetFaculty) continue; 
        
        const assignedFaculty = targetFaculty || availableFaculty[Math.floor(Math.random() * availableFaculty.length)];

        for (const slot of timeSlots) {
          if (slotsAssigned >= requiredSlots) break;

          // Check availability
          // 1. Is Section free?
          const sectionTimetable = await storage.getTimetable(currentSection.id, undefined);
          const sectionBusy = sectionTimetable.find(t => t.timeSlotId === slot.id);
          if (sectionBusy) continue;

          // 2. Is Faculty free?
          const facultyTimetable = await storage.getTimetable(undefined, assignedFaculty.id);
          const facultyBusy = facultyTimetable.find(t => t.timeSlotId === slot.id);
          if (facultyBusy) continue;
        
          // 3. Is Room free?
          let assignedRoom = null;
          const allTimetable = await storage.getTimetable(undefined, undefined);
          for (const room of classrooms) {
            const roomBusy = allTimetable.find(t => t.timeSlotId === slot.id && t.classroomId === room.id);
              
            if (!roomBusy) {
              assignedRoom = room;
              break;
            }
          }

          if (!assignedRoom) continue;

          // Create Entry
          await storage.createTimetableEntry({
            sectionId: currentSection.id,
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
  }

  return scheduledCount;
}
