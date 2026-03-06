import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth } from "./auth";
import { api, generateTimetableSchema } from "@shared/routes";
import { generateWithPython } from "./python-scheduler";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  setupAuth(app);

  const generateAndPersistTimetable = async (departmentId: number, semester?: number) => {
    const allSections = await storage.getSections();
    const sections = allSections.filter(
      (section) =>
        section.departmentId === departmentId &&
        (semester ? section.semester === semester : true),
    );

    if (sections.length === 0) {
      throw new Error("No sections found for this department/semester");
    }

    const subjects = (await storage.getSubjectsByDepartment(departmentId)).filter(
      (subject) => !subject.sectionId || sections.some((section) => section.id === subject.sectionId),
    );
    const classrooms = await storage.getClassrooms();
    const timeSlots = await storage.getTimeSlots();
    const faculty = (await storage.getFaculty()).filter((f) => f.departmentId === departmentId);

    if (subjects.length === 0) throw new Error("No subjects found for selected department");
    if (classrooms.length === 0) throw new Error("No classrooms found");
    if (timeSlots.length === 0) throw new Error("No time slots found");
    if (faculty.length === 0) throw new Error("No faculty found for selected department");

    for (const section of sections) {
      await storage.clearTimetable(section.id);
    }

    const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const pythonResult = await generateWithPython({
      classrooms: classrooms.map((classroom) => ({
        roomNumber: classroom.roomNumber,
      })),
      subjects: subjects.map((subject) => ({
        name: subject.name,
        departmentId: subject.departmentId,
        sectionId: subject.sectionId,
        facultyId: subject.facultyId,
        weeklyHours: subject.weeklyHours,
      })),
      faculty: faculty.map((f) => ({
        id: f.id,
        name: f.name,
        departmentId: f.departmentId,
      })),
      sections: sections.map((section) => ({
        id: section.id,
        name: section.name,
        departmentId: section.departmentId,
      })),
      timeslots: timeSlots.map((slot) => ({
        id: slot.id,
        dayOfWeek: slot.dayOfWeek,
        label: slot.label,
        startTime: slot.startTime,
        endTime: slot.endTime,
      })),
      days,
    });

    const sectionByName = new Map(sections.map((s) => [s.name, s]));
    const roomByNumber = new Map(classrooms.map((c) => [c.roomNumber, c]));
    const facultyByName = new Map(faculty.map((f) => [f.name, f]));
    const slotByKey = new Map(
      timeSlots.map((slot) => [`${slot.dayOfWeek}__${slot.label}`, slot] as const),
    );

    const sectionSubjectByName = new Map<string, Map<string, (typeof subjects)[number]>>();
    for (const section of sections) {
      const candidates = subjects.filter(
        (subject) => subject.sectionId === section.id || subject.sectionId === null,
      );
      const byName = new Map<string, (typeof subjects)[number]>();
      for (const subject of candidates) {
        if (!byName.has(subject.name)) byName.set(subject.name, subject);
      }
      sectionSubjectByName.set(section.name, byName);
    }

    let saved = 0;
    for (const row of pythonResult.timetable) {
      const section = sectionByName.get(row.section);
      const subject = section ? sectionSubjectByName.get(section.name)?.get(row.subject) : undefined;
      const facultyMember = facultyByName.get(row.faculty);
      const room = roomByNumber.get(row.room);
      const slot = slotByKey.get(`${row.day}__${row.period}`);

      if (!section || !subject || !facultyMember || !room || !slot) {
        continue;
      }

      await storage.createTimetableEntry({
        sectionId: section.id,
        subjectId: subject.id,
        facultyId: facultyMember.id,
        classroomId: room.id,
        timeSlotId: slot.id,
      });
      saved += 1;
    }

    if (saved === 0) {
      throw new Error("Python returned timetable rows, but none could be mapped to database IDs");
    }

    return saved;
  };

  // Python Service Integration
  app.post(api.timetable.generatePython.path, async (req, res) => {
    try {
      const parsed = generateTimetableSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ message: "Invalid payload" });
        return;
      }

      const { departmentId, semester } = parsed.data;
      const count = await generateAndPersistTimetable(departmentId, semester);

      res.json({
        message: "Timetable generated successfully",
        count,
      });
    } catch (error: any) {
      console.error("Error calling Python service:", error.message);
      res.status(500).json({ message: "Failed to generate timetable with Python" });
    }
  });

  // Departments
  app.get(api.departments.list.path, async (req, res) => {
    const depts = await storage.getDepartments();
    res.json(depts);
  });
  app.post(api.departments.create.path, async (req, res) => {
    const dept = await storage.createDepartment(req.body);
    res.status(201).json(dept);
  });
  app.patch(api.departments.update.path, async (req, res) => {
    const dept = await storage.updateDepartment(parseInt(req.params.id), req.body);
    res.json(dept);
  });
  app.delete(api.departments.delete.path, async (req, res) => {
    await storage.deleteDepartment(parseInt(req.params.id));
    res.status(204).send();
  });

  // Classrooms
  app.get(api.classrooms.list.path, async (req, res) => {
    const rooms = await storage.getClassrooms();
    res.json(rooms);
  });
  app.post(api.classrooms.create.path, async (req, res) => {
    const room = await storage.createClassroom(req.body);
    res.status(201).json(room);
  });
  app.patch(api.classrooms.update.path, async (req, res) => {
    const room = await storage.updateClassroom(parseInt(req.params.id), req.body);
    res.json(room);
  });
  app.delete(api.classrooms.delete.path, async (req, res) => {
    await storage.deleteClassroom(parseInt(req.params.id));
    res.status(204).send();
  });

  // Subjects
  app.get(api.subjects.list.path, async (req, res) => {
    const subjs = await storage.getSubjects();
    res.json(subjs);
  });
  app.post(api.subjects.create.path, async (req, res) => {
    const subj = await storage.createSubject(req.body);
    res.status(201).json(subj);
  });
  app.patch(api.subjects.update.path, async (req, res) => {
    const subj = await storage.updateSubject(parseInt(req.params.id), req.body);
    res.json(subj);
  });
  app.delete(api.subjects.delete.path, async (req, res) => {
    await storage.deleteSubject(parseInt(req.params.id));
    res.status(204).send();
  });

  // Faculty
  app.get(api.faculty.list.path, async (req, res) => {
    try {
      const facs = await storage.getFaculty();
      res.json(facs);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  app.post(api.faculty.create.path, async (req, res) => {
    try {
      const data = req.body;
      if (!data.code) {
        data.code = `FAC${Date.now()}`;
      }
      const fac = await storage.createFaculty(data);
      res.status(201).json(fac);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });
  app.patch(api.faculty.update.path, async (req, res) => {
    try {
      const fac = await storage.updateFaculty(parseInt(req.params.id), req.body);
      res.json(fac);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });
  app.delete(api.faculty.delete.path, async (req, res) => {
    try {
      await storage.deleteFaculty(parseInt(req.params.id));
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Sections
  app.get(api.sections.list.path, async (req, res) => {
    try {
      const secs = await storage.getSections();
      res.json(secs);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  app.post(api.sections.create.path, async (req, res) => {
    try {
      const sec = await storage.createSection(req.body);
      res.status(201).json(sec);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });
  app.patch(api.sections.update.path, async (req, res) => {
    try {
      const sec = await storage.updateSection(parseInt(req.params.id), req.body);
      res.json(sec);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });
  app.delete(api.sections.delete.path, async (req, res) => {
    try {
      await storage.deleteSection(parseInt(req.params.id));
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // TimeSlots
  app.get(api.timeSlots.list.path, async (req, res) => {
    const slots = await storage.getTimeSlots();
    res.json(slots);
  });
  app.post(api.timeSlots.create.path, async (req, res) => {
    try {
      const slot = await storage.createTimeSlot(req.body);
      res.status(201).json(slot);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });
  app.patch(api.timeSlots.update.path, async (req, res) => {
    try {
      const slot = await storage.updateTimeSlot(parseInt(req.params.id), req.body);
      res.json(slot);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });
  app.delete(api.timeSlots.delete.path, async (req, res) => {
    await storage.deleteTimeSlot(parseInt(req.params.id));
    res.status(204).send();
  });

  // Timetable
  app.get(api.timetable.list.path, async (req, res) => {
    const sectionId = req.query.sectionId ? parseInt(req.query.sectionId as string) : undefined;
    const facultyId = req.query.facultyId ? parseInt(req.query.facultyId as string) : undefined;
    const entries = await storage.getTimetable(sectionId, facultyId);
    res.json(entries);
  });

  app.post(api.timetable.generate.path, async (req, res) => {
    try {
      const parsed = generateTimetableSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ message: "Invalid payload" });
        return;
      }

      const { departmentId, semester } = parsed.data;
      const count = await generateAndPersistTimetable(departmentId, semester);

      res.json({
        message: "Timetable generated successfully",
        count,
      });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  return httpServer;
}
