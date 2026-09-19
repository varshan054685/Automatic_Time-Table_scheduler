import { z } from "zod";

/**
 * Form validation schemas for the master-data pages.
 *
 * These used to come from the shared REST route definitions (`@shared/routes`),
 * which described the removed cloud API. They are now local: the renderer
 * validates for user feedback, and the Electron main process re-validates every
 * IPC argument authoritatively (electron/ipc/schemas.ts).
 */

const requiredText = (label, max = 200) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required`)
    .max(max, `${label} must be ${max} characters or fewer`);

const optionalText = (max) => z.string().trim().max(max).optional().nullable();
const optionalId = z.coerce.number().int().min(0).optional();

export const departmentFormSchema = z.object({
  name: requiredText("Department name"),
  code: requiredText("Department code", 50),
});

export const classroomFormSchema = z.object({
  roomNumber: requiredText("Room number", 100),
  capacity: z.coerce
    .number()
    .int("Capacity must be a whole number")
    .min(0, "Capacity cannot be negative")
    .max(10000, "Capacity looks too large"),
  type: z.enum(["lecture", "lab", "special"]).default("lecture"),
});

export const facultyFormSchema = z.object({
  name: requiredText("Faculty name"),
  code: optionalText(50),
  departmentId: z.coerce.number().int().positive("Select a department"),
  email: z
    .union([z.string().trim().email("Enter a valid email address").max(255), z.literal("")])
    .optional(),
  availability: z.array(z.string()).optional(),
});

export const sectionFormSchema = z.object({
  name: requiredText("Section name", 100),
  year: z.coerce.number().int("Year is required").min(1, "Year must be at least 1").max(10),
  semester: z.coerce
    .number()
    .int("Semester is required")
    .min(1, "Semester must be at least 1")
    .max(20),
  departmentId: z.coerce.number().int().positive("Select a department"),
  classroomId: optionalId,
});

export const subjectFormSchema = z.object({
  code: requiredText("Subject code", 50),
  name: requiredText("Subject name"),
  weeklyHours: z.coerce
    .number()
    .int("Weekly hours must be a whole number")
    .min(1, "Weekly hours must be at least 1")
    .max(40, "Weekly hours must be 40 or less"),
  departmentId: z.coerce.number().int().positive("Select a department"),
  facultyId: optionalId,
  sectionId: optionalId,
  type: z.enum(["lecture", "lab"]).default("lecture"),
});
