/**
 * Zod schemas for every IPC channel. The main process NEVER trusts renderer
 * arguments — each handler validates through this table first (spec §22).
 * Input shapes are legacy-compatible with the existing UI forms.
 */
import { z } from "zod";

export const idSchema = z.number().int().positive();
export const optionalIdSchema = idSchema.nullable().optional();

const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;

export const institutionInput = z.object({
  name: z.string().min(1).max(200).trim(),
  type: z.enum(["school", "college"]).default("college"),
  address: z.string().max(500).optional().nullable(),
});

export const institutionUpdate = institutionInput.partial();

export const academicYearInput = z.object({
  institutionId: idSchema,
  name: z.string().min(1).max(50).trim(),
  startDate: z.string().max(20).optional().nullable(),
  endDate: z.string().max(20).optional().nullable(),
});

export const departmentInput = z.object({
  institutionId: idSchema,
  name: z.string().min(1).max(200).trim(),
  code: z.string().min(1).max(50).trim(),
});

export const sectionInput = z.object({
  institutionId: idSchema,
  departmentId: idSchema,
  classId: optionalIdSchema,
  name: z.string().min(1).max(100).trim(),
  year: z.number().int().min(1).max(10).optional().nullable(),
  semester: z.number().int().min(1).max(20).optional().nullable(),
  strength: z.number().int().min(0).max(10000).optional().nullable(),
  defaultClassroomId: optionalIdSchema,
});

export const teacherInput = z.object({
  institutionId: idSchema,
  name: z.string().min(1).max(200).trim(),
  code: z.string().min(1).max(50).trim(),
  email: z.string().max(255).optional().nullable(),
  phone: z.string().max(50).optional().nullable(),
  departmentId: optionalIdSchema,
  maxPeriodsDay: z.number().int().min(1).max(12).optional().nullable(),
  maxPeriodsWeek: z.number().int().min(1).max(80).optional().nullable(),
  availability: z.array(z.string()).max(500).optional().nullable(),
});

export const classroomInput = z.object({
  institutionId: idSchema,
  roomNumber: z.string().min(1).max(100).trim(),
  name: z.string().max(200).optional().nullable(),
  capacity: z.number().int().min(0).max(10000).default(0),
  type: z.enum(["lecture", "lab", "special"]).default("lecture"),
  building: z.string().max(200).optional().nullable(),
});

export const timeSlotInput = z.object({
  institutionId: idSchema,
  dayOfWeek: z.union([z.enum(DAY_NAMES), z.number().int().min(0).max(6)]),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "Use HH:MM"),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, "Use HH:MM"),
  label: z.string().min(1).max(100).trim(),
  type: z.enum(["teaching", "break", "lunch"]).default("teaching"),
  sortOrder: z.number().int().min(0).max(999).default(0),
});

export const subjectInput = z.object({
  institutionId: idSchema,
  code: z.string().min(1).max(50).trim(),
  name: z.string().min(1).max(200).trim(),
  type: z.enum(["lecture", "lab"]).default("lecture"),
  weeklyHours: z.number().int().min(1).max(40).default(1),
  departmentId: idSchema,
  facultyId: optionalIdSchema,
  sectionId: optionalIdSchema,
});

export const availabilityInput = z.object({
  teacherId: idSchema,
  slotIds: z.array(idSchema),
  available: z.boolean(),
});

export const timetableFilters = z.object({
  versionId: optionalIdSchema,
  sectionId: optionalIdSchema,
  teacherId: optionalIdSchema,
  classroomId: optionalIdSchema,
});

export const backupRestoreInput = z.object({ id: z.string().min(1).max(200) });

export const settingsInput = z.object({
  key: z.string().min(1).max(100),
  value: z.unknown(),
});
