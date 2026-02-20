import { storage } from "./storage";

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
    // First, find subjects SPECIFICALLY assigned to this section
    const sectionSubjects = subjects.filter(s => s.sectionId === section.id);
    
    // If no specific subjects, use department subjects (fallback/shared)
    const subjectsToSchedule = sectionSubjects.length > 0 ? sectionSubjects : subjects;
    
    for (const subject of subjectsToSchedule) {
      const requiredSlots = subject.weeklyHours;
      
      // Use assigned faculty from subject if available
      const assignedFaculty = subject.facultyId ? faculty.find(f => f.id === subject.facultyId) : null;
      
      if (!assignedFaculty) {
        // Skip if no faculty assigned to subject - we need someone to teach it
        continue;
      }

      let slotsAssigned = 0;
      
      // Shuffle time slots to provide more varied distribution
      const shuffledSlots = [...timeSlots].sort(() => Math.random() - 0.5);

      for (const slot of shuffledSlots) {
        if (slotsAssigned >= requiredSlots) break;

        // Check availability
        // 1. Is Section free?
        const sectionTimetable = await storage.getTimetable(section.id, undefined);
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
