import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth } from "./auth";
import { api } from "@shared/routes";
import { generateTimetable } from "./scheduler";
import { z } from "zod";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  setupAuth(app);

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
    const facs = await storage.getFaculty();
    res.json(facs);
  });
  app.post(api.faculty.create.path, async (req, res) => {
    const fac = await storage.createFaculty(req.body);
    res.status(201).json(fac);
  });
  app.patch(api.faculty.update.path, async (req, res) => {
    const fac = await storage.updateFaculty(parseInt(req.params.id), req.body);
    res.json(fac);
  });
  app.delete(api.faculty.delete.path, async (req, res) => {
    await storage.deleteFaculty(parseInt(req.params.id));
    res.status(204).send();
  });

  // Sections
  app.get(api.sections.list.path, async (req, res) => {
    const secs = await storage.getSections();
    res.json(secs);
  });
  app.post(api.sections.create.path, async (req, res) => {
    const sec = await storage.createSection(req.body);
    res.status(201).json(sec);
  });
  app.patch(api.sections.update.path, async (req, res) => {
    const sec = await storage.updateSection(parseInt(req.params.id), req.body);
    res.json(sec);
  });
  app.delete(api.sections.delete.path, async (req, res) => {
    await storage.deleteSection(parseInt(req.params.id));
    res.status(204).send();
  });

  // TimeSlots
  app.get(api.timeSlots.list.path, async (req, res) => {
    const slots = await storage.getTimeSlots();
    res.json(slots);
  });
  app.post(api.timeSlots.create.path, async (req, res) => {
    const slot = await storage.createTimeSlot(req.body);
    res.status(201).json(slot);
  });
  app.patch(api.timeSlots.update.path, async (req, res) => {
    const slot = await storage.updateTimeSlot(parseInt(req.params.id), req.body);
    res.json(slot);
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
      const { departmentId, semester } = req.body;
      const count = await generateTimetable(departmentId, semester);
      res.json({ message: "Timetable generated successfully", count });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  return httpServer;
}
