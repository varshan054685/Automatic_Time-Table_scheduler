import { storage } from "../server/storage";
import { generateWithPython } from "../server/python-scheduler";

async function run() {
  const wsId = 1; // Assuming first workspace
  const depts = await storage.getDepartments(wsId);
  if (depts.length === 0) {
    console.log("No departments found");
    return;
  }
  const departmentId = depts[0].id;
  console.log("Testing generation for department:", departmentId);

  // Re-implement the payload building logic to trace it
  const allSections = await storage.getSections(wsId);
  const filteredSections = allSections.filter(
    (section: any) => section.departmentId === departmentId,
  );

  const allSubjects = await storage.getSubjects(wsId);
  const subjectsForDept = allSubjects.filter(
    (subject) => subject.departmentId === departmentId &&
      (!subject.sectionId || filteredSections.some((section: any) => section.id === subject.sectionId)),
  );
  
  const allClassrooms = await storage.getClassrooms(wsId);
  const allTimeSlots = await storage.getTimeSlots(wsId);
  const allFaculty = await storage.getFaculty(wsId);
  const facultyForDept = allFaculty.filter((f) => f.departmentId === departmentId);

  const daySet: Set<string> = new Set();
  allTimeSlots.forEach(s => daySet.add(s.dayOfWeek));
  const dayOrder = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const days = dayOrder.filter(d => daySet.has(d));

  const payload = {
    classrooms: allClassrooms.map((classroom) => ({ roomNumber: classroom.roomNumber })),
    subjects: subjectsForDept.map((subject) => ({
      id: subject.id, name: subject.name, departmentId: subject.departmentId,
      sectionId: subject.sectionId, facultyId: subject.facultyId,
      weeklyHours: subject.weeklyHours, type: subject.type,
    })),
    faculty: facultyForDept.map((f) => ({ id: f.id, name: f.name, departmentId: f.departmentId })),
    sections: filteredSections.map((section: any) => ({
      id: section.id, name: section.name, departmentId: section.departmentId,
    })),
    timeslots: allTimeSlots.map((slot) => ({
      id: slot.id, dayOfWeek: slot.dayOfWeek, label: slot.label,
      startTime: slot.startTime, endTime: slot.endTime,
    })),
    days,
  };

  console.log("PAYLOAD:", JSON.stringify(payload, null, 2));

  try {
    const pythonResult = await generateWithPython(payload);
    console.log("RESULT SCHEDULE SIZE:", pythonResult.timetable.length);

    let failed = 0;
    const sectionById = new Map(filteredSections.map((s: any) => [s.id, s]));
    const facultyById = new Map(facultyForDept.map((f) => [f.id, f]));
    const subjectById = new Map(subjectsForDept.map((s) => [s.id, s]));
    const roomByNumber = new Map(allClassrooms.map((c) => [c.roomNumber.trim(), c]));
    const slotByKey = new Map(
      allTimeSlots.map((slot) => [`${slot.dayOfWeek.trim()}__${slot.label.trim()}`, slot] as const),
    );

    for (const row of pythonResult.timetable) {
      const section = sectionById.get(row.sectionId);
      const subject = subjectById.get(row.subjectId);
      const facultyMember = facultyById.get(row.facultyId);
      const room = roomByNumber.get(row.room.trim());
      const slot = slotByKey.get(`${row.day.trim()}__${row.period.trim()}`);

      if (!section || !subject || !facultyMember || !room || !slot) {
        console.error(`Failed mapping: section=${!!section}, subject=${!!subject}, faculty=${!!facultyMember}, room=${!!room}, slot=${!!slot}`);
        console.error("Row:", row);
        failed++;
      }
    }
    console.log(`Mapping result: out of ${pythonResult.timetable.length}, failed ${failed}`);
  } catch(e) {
    console.error("Generator failed", e);
  }
}

run().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});
