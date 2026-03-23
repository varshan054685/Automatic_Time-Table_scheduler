import { db } from './server/db';
import { generateWithPython } from './server/python-scheduler';
import { storage } from './server/storage';
import * as fs from 'fs';

async function run() {
  const deptId = 19;
  const sections = await db.query.sections.findMany({ where: (s, { eq }) => eq(s.departmentId, deptId) });
  const subjects = (await storage.getSubjectsByDepartment(deptId)).filter(
      (subject) => !subject.sectionId || sections.some((section) => section.id === subject.sectionId),
  );
  const classrooms = await storage.getClassrooms();
  const timeSlots = await storage.getTimeSlots();
  const faculty = (await storage.getFaculty()).filter((f) => f.departmentId === deptId);

  const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const payload = {
    classrooms: classrooms.map(c => ({ roomNumber: c.roomNumber })),
    subjects: subjects.map(s => ({ id: s.id, name: s.name, departmentId: s.departmentId, sectionId: s.sectionId, facultyId: s.facultyId, weeklyHours: s.weeklyHours, type: s.type })),
    faculty: faculty.map(f => ({ id: f.id, name: f.name, departmentId: f.departmentId })),
    sections: sections.map(s => ({ id: s.id, name: s.name, departmentId: s.departmentId })),
    timeslots: timeSlots.map(s => ({ id: s.id, dayOfWeek: s.dayOfWeek, label: s.label, startTime: s.startTime, endTime: s.endTime })),
    days,
  };
  fs.writeFileSync("/tmp/payload.json", JSON.stringify(payload, null, 2));
  console.log("Saved /tmp/payload.json");
  process.exit(0);
}
run();
