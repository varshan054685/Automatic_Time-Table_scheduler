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

  // Fire-and-forget: regenerate timetable for a list of department IDs
  const triggerRegenForDepartments = (departmentIds: number[]) => {
    const unique = Array.from(new Set(departmentIds)).filter(Boolean);
    if (unique.length === 0) return;
    Promise.allSettled(unique.map(async (deptId) => {
      try {
        const count = await generateAndPersistTimetable(deptId);
        console.log(`[Auto-regen] Department ${deptId} → saved ${count} entries`);
      } catch (err: any) {
        const msg = err instanceof Error ? err.message : JSON.stringify(err);
        console.warn(`[Auto-regen] Department ${deptId} → skipped: ${msg}`);
      }
    }));
  };

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

    // Remove aggressive throw errors; it should evaluate normally or schedule what it can.
    if (classrooms.length === 0) throw new Error("No classrooms found");
    if (timeSlots.length === 0) throw new Error("No time slots found");
    
    if (subjects.length === 0) {
      console.warn("No subjects found for selected department, returning 0");
      return { received: 0, saved: 0, failed: 0 };
    }
    
    if (faculty.length === 0) {
       console.warn("No faculty found for selected department, returning 0");
       return { received: 0, saved: 0, failed: 0 };
    }

    for (const section of sections) {
      await storage.clearTimetable(section.id);
    }

    const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const pythonResult = await generateWithPython({
      classrooms: classrooms.map((classroom) => ({
        roomNumber: classroom.roomNumber,
      })),
      subjects: subjects.map((subject) => ({
        id: subject.id,
        name: subject.name,
        departmentId: subject.departmentId,
        sectionId: subject.sectionId,
        facultyId: subject.facultyId,
        weeklyHours: subject.weeklyHours,
        type: subject.type,
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

    const sectionById = new Map(sections.map((s) => [s.id, s]));
    const facultyById = new Map(faculty.map((f) => [f.id, f]));
    const subjectById = new Map(subjects.map((s) => [s.id, s]));
    const roomByNumber = new Map(classrooms.map((c) => [c.roomNumber.trim(), c]));
    const slotByKey = new Map(
      timeSlots.map((slot) => [`${slot.dayOfWeek.trim()}__${slot.label.trim()}`, slot] as const),
    );

    let saved = 0;
    let failed = 0;
    for (const row of pythonResult.timetable) {
      const section = sectionById.get(row.sectionId);
      const subject = subjectById.get(row.subjectId);
      const facultyMember = facultyById.get(row.facultyId);
      const room = roomByNumber.get(row.room.trim());
      const slot = slotByKey.get(`${row.day.trim()}__${row.period.trim()}`);

      if (!section || !subject || !facultyMember || !room || !slot) {
        failed += 1;
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

    return {
      received: pythonResult.timetable.length,
      saved,
      failed
    };
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
      if (error.response?.data?.detail) {
        res.status(400).json({ message: error.response.data.detail });
      } else {
        res.status(500).json({ message: "Failed to generate timetable with Python: " + error.message });
      }
    }
  });

  // Regenerate ALL departments (clears stale entries first)
  app.post("/api/timetable/regenerate-all", async (req, res) => {
    try {
      await storage.clearAllTimetable();
      const allDepts = await storage.getDepartments();
      const results = await Promise.allSettled(
        allDepts.map(dept => generateAndPersistTimetable(dept.id))
      );
      
      const summary = results.map((r, i) => ({
        deptId: allDepts[i].id,
        deptName: allDepts[i].name,
        status: r.status,
        result: r.status === "fulfilled" ? r.value : undefined,
        error: r.status === "rejected" ? (r.reason?.message || String(r.reason)) : undefined,
      }));

      const totalSaved = summary.reduce((acc, s) => acc + (s.result?.saved || 0), 0);
      
      res.json({
        message: `Regenerated timetable for ${allDepts.length} department(s). Total entries: ${totalSaved}.`,
        summary,
        totalSaved,
      });
    } catch (error: any) {
      res.status(500).json({ message: "Failed to regenerate: " + error.message });
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
    triggerRegenForDepartments([dept.id]);
  });
  app.patch(api.departments.update.path, async (req, res) => {
    const dept = await storage.updateDepartment(parseInt(req.params.id), req.body);
    res.json(dept);
    triggerRegenForDepartments([dept.id]);
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
    const allDepts = await storage.getDepartments();
    triggerRegenForDepartments(allDepts.map(d => d.id));
  });
  app.patch(api.classrooms.update.path, async (req, res) => {
    const room = await storage.updateClassroom(parseInt(req.params.id), req.body);
    res.json(room);
    const allDepts = await storage.getDepartments();
    triggerRegenForDepartments(allDepts.map(d => d.id));
  });
  app.delete(api.classrooms.delete.path, async (req, res) => {
    await storage.deleteClassroom(parseInt(req.params.id));
    res.status(204).send();
    const allDepts = await storage.getDepartments();
    triggerRegenForDepartments(allDepts.map(d => d.id));
  });

  // Subjects
  app.get(api.subjects.list.path, async (req, res) => {
    const subjs = await storage.getSubjects();
    res.json(subjs);
  });
  app.post(api.subjects.create.path, async (req, res) => {
    const subj = await storage.createSubject(req.body);
    res.status(201).json(subj);
    if (subj.departmentId) triggerRegenForDepartments([subj.departmentId]);
  });
  app.patch(api.subjects.update.path, async (req, res) => {
    const subj = await storage.updateSubject(parseInt(req.params.id), req.body);
    res.json(subj);
    if (subj.departmentId) triggerRegenForDepartments([subj.departmentId]);
  });
  app.delete(api.subjects.delete.path, async (req, res) => {
    const subj = await storage.getSubject(parseInt(req.params.id));
    await storage.deleteSubject(parseInt(req.params.id));
    res.status(204).send();
    if (subj?.departmentId) triggerRegenForDepartments([subj.departmentId]);
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
      if (fac.departmentId) triggerRegenForDepartments([fac.departmentId]);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });
  app.patch(api.faculty.update.path, async (req, res) => {
    try {
      const fac = await storage.updateFaculty(parseInt(req.params.id), req.body);
      res.json(fac);
      if (fac.departmentId) triggerRegenForDepartments([fac.departmentId]);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });
  app.delete(api.faculty.delete.path, async (req, res) => {
    try {
      const fac = await storage.getFacultyById(parseInt(req.params.id));
      await storage.deleteFaculty(parseInt(req.params.id));
      res.status(204).send();
      if (fac?.departmentId) triggerRegenForDepartments([fac.departmentId]);
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
      if (sec.departmentId) triggerRegenForDepartments([sec.departmentId]);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });
  app.patch(api.sections.update.path, async (req, res) => {
    try {
      const sec = await storage.updateSection(parseInt(req.params.id), req.body);
      res.json(sec);
      if (sec.departmentId) triggerRegenForDepartments([sec.departmentId]);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });
  app.delete(api.sections.delete.path, async (req, res) => {
    try {
      const sec = await storage.getSection(parseInt(req.params.id));
      await storage.deleteSection(parseInt(req.params.id));
      res.status(204).send();
      if (sec?.departmentId) triggerRegenForDepartments([sec.departmentId]);
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
      const allDepts = await storage.getDepartments();
      triggerRegenForDepartments(allDepts.map(d => d.id));
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });
  app.patch(api.timeSlots.update.path, async (req, res) => {
    try {
      const slot = await storage.updateTimeSlot(parseInt(req.params.id), req.body);
      res.json(slot);
      const allDepts = await storage.getDepartments();
      triggerRegenForDepartments(allDepts.map(d => d.id));
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });
  app.delete(api.timeSlots.delete.path, async (req, res) => {
    await storage.deleteTimeSlot(parseInt(req.params.id));
    res.status(204).send();
    const allDepts = await storage.getDepartments();
    triggerRegenForDepartments(allDepts.map(d => d.id));
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
