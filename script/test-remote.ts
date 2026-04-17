import { generateWithPython } from "../server/python-scheduler";
import { storage } from "../server/storage";
import "dotenv/config";

async function run() {
  process.env.PYTHON_SERVICE_URL = "https://automatic-time-table-scheduler.onrender.com";
  const wsId = 1;
  const depts = await storage.getDepartments(wsId);
  if (!depts.length) return;
  const departmentId = depts[0].id;
  
  const allSections = await storage.getSections(wsId);
  const filteredSections = allSections.filter((section: any) => section.departmentId === departmentId);
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
    classrooms: allClassrooms.map((c) => ({ roomNumber: c.roomNumber })),
    subjects: subjectsForDept.map((s) => ({
      id: s.id, name: s.name, departmentId: s.departmentId,
      sectionId: s.sectionId, facultyId: s.facultyId,
      weeklyHours: s.weeklyHours, type: s.type,
    })),
    faculty: facultyForDept.map((f) => ({ id: f.id, name: f.name, departmentId: f.departmentId })),
    sections: filteredSections.map((s: any) => ({
      id: s.id, name: s.name, departmentId: s.departmentId,
    })),
    timeslots: allTimeSlots.map((s) => ({
      id: s.id, dayOfWeek: s.dayOfWeek, label: s.label,
      startTime: s.startTime, endTime: s.endTime,
    })),
    days,
  };

  console.log("Pinging Remote Python...");
  try {
    const start = Date.now();
    const res = await generateWithPython(payload);
    console.log("Success! Timetable size:", res.timetable.length);
    console.log("Time taken:", (Date.now() - start) / 1000, "seconds");
  } catch(e: any) {
    console.error("Remote failed:", e.message || e);
  }
}
run();
