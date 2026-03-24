import { pgTable, text, serial, integer, boolean, jsonb, timestamp, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

// === USER & AUTH ===
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  role: text("role").notNull().default("staff"), // 'admin' or 'staff'
  name: text("name"),
  createdAt: timestamp("created_at").defaultNow(),
});

// === WORKSPACES & PERMISSIONS ===
export const workspaces = pgTable("workspaces", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  ownerId: integer("owner_id").notNull(),
  referralCode: text("referral_code").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const workspaceMembers = pgTable("workspace_members", {
  id: serial("id").primaryKey(),
  workspaceId: integer("workspace_id").notNull(),
  userId: integer("user_id").notNull(),
  role: text("role").notNull().default("viewer"), // 'owner', 'viewer'
  createdAt: timestamp("created_at").defaultNow(),
});

export const changeRequests = pgTable("change_requests", {
  id: serial("id").primaryKey(),
  workspaceId: integer("workspace_id").notNull(),
  requestedBy: integer("requested_by").notNull(),
  type: text("type").notNull(), // 'edit', 'delete'
  data: jsonb("data").notNull(),
  status: text("status").notNull().default("pending"), // 'pending', 'approved', 'rejected'
  createdAt: timestamp("created_at").defaultNow(),
});

// === MASTER DATA ===
export const departments = pgTable("departments", {
  id: serial("id").primaryKey(),
  workspaceId: integer("workspace_id").notNull(),
  name: text("name").notNull(),
  code: text("code").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const classrooms = pgTable("classrooms", {
  id: serial("id").primaryKey(),
  workspaceId: integer("workspace_id").notNull(),
  roomNumber: text("room_number").notNull(),
  capacity: integer("capacity").notNull(),
  type: text("type").default("lecture"), // lecture, lab
  createdAt: timestamp("created_at").defaultNow(),
});

export const subjects = pgTable("subjects", {
  id: serial("id").primaryKey(),
  workspaceId: integer("workspace_id").notNull(),
  code: text("code").notNull(),
  name: text("name").notNull(),
  weeklyHours: integer("weekly_hours").notNull(),
  departmentId: integer("department_id").notNull(), // Foreign key to departments
  facultyId: integer("faculty_id"), // Default faculty
  sectionId: integer("section_id"), // Primary section
  type: text("type").default("lecture"), // lecture, lab
  createdAt: timestamp("created_at").defaultNow(),
});

export const faculty = pgTable("faculty", {
  id: serial("id").primaryKey(),
  workspaceId: integer("workspace_id").notNull(),
  name: text("name").notNull(),
  code: text("code").notNull(), 
  departmentId: integer("department_id").notNull(),
  email: text("email"),
  availability: jsonb("availability").$type<string[]>().default([]), 
  createdAt: timestamp("created_at").defaultNow(),
});

export const sections = pgTable("sections", {
  id: serial("id").primaryKey(),
  workspaceId: integer("workspace_id").notNull(),
  name: text("name").notNull(), // e.g., "CS-A", "ME-B"
  year: integer("year").notNull(),
  semester: integer("semester").notNull(),
  departmentId: integer("department_id").notNull(),
  classroomId: integer("classroom_id"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const timeSlots = pgTable("time_slots", {
  id: serial("id").primaryKey(),
  workspaceId: integer("workspace_id").notNull(),
  dayOfWeek: text("day_of_week").notNull(), // Monday, Tuesday...
  startTime: text("start_time").notNull(), // "09:00"
  endTime: text("end_time").notNull(), // "10:00"
  label: text("label").notNull(), // "Period 1"
});

export const timetable = pgTable("timetable", {
  id: serial("id").primaryKey(),
  workspaceId: integer("workspace_id").notNull(),
  sectionId: integer("section_id").notNull(),
  subjectId: integer("subject_id").notNull(),
  facultyId: integer("faculty_id").notNull(),
  classroomId: integer("classroom_id").notNull(),
  timeSlotId: integer("time_slot_id").notNull(),
});

// === RELATIONS ===
export const workspacesRelations = relations(workspaces, ({ one, many }) => ({
  owner: one(users, {
    fields: [workspaces.ownerId],
    references: [users.id],
  }),
  members: many(workspaceMembers),
}));

export const workspaceMembersRelations = relations(workspaceMembers, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [workspaceMembers.workspaceId],
    references: [workspaces.id],
  }),
  user: one(users, {
    fields: [workspaceMembers.userId],
    references: [users.id],
  }),
}));

export const changeRequestsRelations = relations(changeRequests, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [changeRequests.workspaceId],
    references: [workspaces.id],
  }),
  requestedBy: one(users, {
    fields: [changeRequests.requestedBy],
    references: [users.id],
  }),
}));

export const subjectsRelations = relations(subjects, ({ one }) => ({
  department: one(departments, {
    fields: [subjects.departmentId],
    references: [departments.id],
  }),
  workspace: one(workspaces, {
    fields: [subjects.workspaceId],
    references: [workspaces.id],
  })
}));

export const facultyRelations = relations(faculty, ({ one }) => ({
  department: one(departments, {
    fields: [faculty.departmentId],
    references: [departments.id],
  }),
  workspace: one(workspaces, {
    fields: [faculty.workspaceId],
    references: [workspaces.id],
  })
}));

export const sectionsRelations = relations(sections, ({ one }) => ({
  department: one(departments, {
    fields: [sections.departmentId],
    references: [departments.id],
  }),
  classroom: one(classrooms, {
    fields: [sections.classroomId],
    references: [classrooms.id],
  }),
  workspace: one(workspaces, {
    fields: [sections.workspaceId],
    references: [workspaces.id],
  })
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
  workspace: one(workspaces, {
    fields: [timetable.workspaceId],
    references: [workspaces.id],
  })
}));

export const departmentsRelations = relations(departments, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [departments.workspaceId],
    references: [workspaces.id],
  })
}));

export const classroomsRelations = relations(classrooms, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [classrooms.workspaceId],
    references: [workspaces.id],
  })
}));

export const timeSlotsRelations = relations(timeSlots, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [timeSlots.workspaceId],
    references: [workspaces.id],
  })
}));

// === INSERTS ===
export const insertUserSchema = createInsertSchema(users);
export const insertWorkspaceSchema = createInsertSchema(workspaces);
export const insertWorkspaceMemberSchema = createInsertSchema(workspaceMembers);
export const insertChangeRequestSchema = createInsertSchema(changeRequests);
export const insertDepartmentSchema = createInsertSchema(departments);
export const insertClassroomSchema = createInsertSchema(classrooms);
export const insertSubjectSchema = createInsertSchema(subjects);
export const insertFacultySchema = createInsertSchema(faculty);
export const insertSectionSchema = createInsertSchema(sections);
export const insertTimeSlotSchema = createInsertSchema(timeSlots);
export const insertTimetableSchema = createInsertSchema(timetable);

// === TYPES ===
export type User = typeof users.$inferSelect;
export type Workspace = typeof workspaces.$inferSelect;
export type WorkspaceMember = typeof workspaceMembers.$inferSelect;
export type ChangeRequest = typeof changeRequests.$inferSelect;
export type Department = typeof departments.$inferSelect;
export type Classroom = typeof classrooms.$inferSelect;
export type Subject = typeof subjects.$inferSelect;
export type Faculty = typeof faculty.$inferSelect;
export type Section = typeof sections.$inferSelect;
export type TimeSlot = typeof timeSlots.$inferSelect;
export type TimetableEntry = typeof timetable.$inferSelect;
