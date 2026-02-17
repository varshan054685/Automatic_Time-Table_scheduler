import { pgTable, text, serial, integer, boolean, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

// === USER & AUTH ===
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  role: text("role").notNull().default("staff"), // 'admin' or 'staff'
  name: text("name").notNull(),
});

// === MASTER DATA ===
export const departments = pgTable("departments", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  code: text("code").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const classrooms = pgTable("classrooms", {
  id: serial("id").primaryKey(),
  roomNumber: text("room_number").notNull().unique(),
  capacity: integer("capacity").notNull(),
  type: text("type").default("lecture"), // lecture, lab
  createdAt: timestamp("created_at").defaultNow(),
});

export const subjects = pgTable("subjects", {
  id: serial("id").primaryKey(),
  code: text("code").notNull(),
  name: text("name").notNull(),
  weeklyHours: integer("weekly_hours").notNull(),
  departmentId: integer("department_id").notNull(), // Foreign key to departments
  type: text("type").default("theory"), // theory, lab
  createdAt: timestamp("created_at").defaultNow(),
});

export const faculty = pgTable("faculty", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  departmentId: integer("department_id").notNull(), // Foreign key to departments
  email: text("email"),
  // JSON array of blocked time slots or preferences
  availability: jsonb("availability").$type<string[]>().default([]), 
  createdAt: timestamp("created_at").defaultNow(),
});

export const sections = pgTable("sections", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(), // e.g., "CS-A", "ME-B"
  year: integer("year").notNull(),
  semester: integer("semester").notNull(),
  departmentId: integer("department_id").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const timeSlots = pgTable("time_slots", {
  id: serial("id").primaryKey(),
  dayOfWeek: text("day_of_week").notNull(), // Monday, Tuesday...
  startTime: text("start_time").notNull(), // "09:00"
  endTime: text("end_time").notNull(), // "10:00"
  label: text("label").notNull(), // "Period 1"
});

export const timetable = pgTable("timetable", {
  id: serial("id").primaryKey(),
  sectionId: integer("section_id").notNull(),
  subjectId: integer("subject_id").notNull(),
  facultyId: integer("faculty_id").notNull(),
  classroomId: integer("classroom_id").notNull(),
  timeSlotId: integer("time_slot_id").notNull(),
});

// === RELATIONS ===
export const subjectsRelations = relations(subjects, ({ one }) => ({
  department: one(departments, {
    fields: [subjects.departmentId],
    references: [departments.id],
  }),
}));

export const facultyRelations = relations(faculty, ({ one }) => ({
  department: one(departments, {
    fields: [faculty.departmentId],
    references: [departments.id],
  }),
}));

export const sectionsRelations = relations(sections, ({ one }) => ({
  department: one(departments, {
    fields: [sections.departmentId],
    references: [departments.id],
  }),
}));

export const timetableRelations = relations(timetable, ({ one }) => ({
  section: one(sections, {
    fields: [timetable.sectionId],
    references: [sections.id],
  }),
  subject: one(subjects, {
    fields: [timetable.subjectId],
    references: [subjects.id],
  }),
  faculty: one(faculty, {
    fields: [timetable.facultyId],
    references: [faculty.id],
  }),
  classroom: one(classrooms, {
    fields: [timetable.classroomId],
    references: [classrooms.id],
  }),
  timeSlot: one(timeSlots, {
    fields: [timetable.timeSlotId],
    references: [timeSlots.id],
  }),
}));

// === INSERTS ===
export const insertUserSchema = createInsertSchema(users);
export const insertDepartmentSchema = createInsertSchema(departments);
export const insertClassroomSchema = createInsertSchema(classrooms);
export const insertSubjectSchema = createInsertSchema(subjects);
export const insertFacultySchema = createInsertSchema(faculty);
export const insertSectionSchema = createInsertSchema(sections);
export const insertTimeSlotSchema = createInsertSchema(timeSlots);
export const insertTimetableSchema = createInsertSchema(timetable);

// === TYPES ===
export type User = typeof users.$inferSelect;
export type Department = typeof departments.$inferSelect;
export type Classroom = typeof classrooms.$inferSelect;
export type Subject = typeof subjects.$inferSelect;
export type Faculty = typeof faculty.$inferSelect;
export type Section = typeof sections.$inferSelect;
export type TimeSlot = typeof timeSlots.$inferSelect;
export type TimetableEntry = typeof timetable.$inferSelect;
