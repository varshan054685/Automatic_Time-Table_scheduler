import { z } from 'zod';
import { 
  insertUserSchema, 
  insertDepartmentSchema, 
  insertClassroomSchema, 
  insertSubjectSchema, 
  insertFacultySchema, 
  insertSectionSchema, 
  insertTimeSlotSchema,
} from './schema';

export const errorSchemas = {
  validation: z.object({
    message: z.string(),
    field: z.string().optional(),
  }),
  notFound: z.object({
    message: z.string(),
  }),
  conflict: z.object({
    message: z.string(),
  }),
};

// Request schema for generating timetable
export const generateTimetableSchema = z.object({
  departmentId: z.number(),
  semester: z.number().optional(),
});

export const api = {
  auth: {
    register: {
      method: 'POST' as const,
      path: '/api/auth/register' as const,
      input: z.object({ email: z.string().email(), password: z.string().min(6), name: z.string().optional() }),
      responses: {
        201: z.any(),
        400: errorSchemas.validation,
      },
    },
    login: {
      method: 'POST' as const,
      path: '/api/auth/login' as const,
      input: z.object({ email: z.string(), password: z.string() }),
      responses: {
        200: z.any(),
        401: z.object({ message: z.string() }),
      },
    },
    logout: {
      method: 'POST' as const,
      path: '/api/logout' as const,
      responses: {
        200: z.void(),
      },
    },
    me: {
      method: 'GET' as const,
      path: '/api/user' as const,
      responses: {
        200: z.any(),
        401: z.void(),
      },
    },
  },
  workspaces: {
    create: {
      method: 'POST' as const,
      path: '/api/workspaces' as const,
      input: z.object({ name: z.string().min(1) }),
      responses: { 201: z.any() },
    },
    join: {
      method: 'POST' as const,
      path: '/api/workspaces/join' as const,
      input: z.object({ referralCode: z.string().min(1) }),
      responses: { 200: z.any() },
    },
    current: {
      method: 'GET' as const,
      path: '/api/workspaces/current' as const,
      responses: { 200: z.any() },
    },
    regenerateCode: {
      method: 'POST' as const,
      path: '/api/workspaces/regenerate-code' as const,
      responses: { 200: z.any() },
    },
  },
  changeRequests: {
    list: {
      method: 'GET' as const,
      path: '/api/change-requests' as const,
      responses: { 200: z.array(z.any()) },
    },
    approve: {
      method: 'POST' as const,
      path: '/api/change-requests/:id/approve' as const,
      responses: { 200: z.any() },
    },
    reject: {
      method: 'POST' as const,
      path: '/api/change-requests/:id/reject' as const,
      responses: { 200: z.any() },
    },
  },
  departments: {
    list: {
      method: 'GET' as const,
      path: '/api/departments' as const,
      responses: { 200: z.array(z.any()) },
    },
    create: {
      method: 'POST' as const,
      path: '/api/departments' as const,
      input: insertDepartmentSchema,
      responses: { 201: z.any() },
    },
    update: {
      method: 'PATCH' as const,
      path: '/api/departments/:id' as const,
      input: insertDepartmentSchema.partial(),
      responses: { 200: z.any() },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/departments/:id' as const,
      responses: { 204: z.void() },
    },
  },
  classrooms: {
    list: {
      method: 'GET' as const,
      path: '/api/classrooms' as const,
      responses: { 200: z.array(z.any()) },
    },
    create: {
      method: 'POST' as const,
      path: '/api/classrooms' as const,
      input: insertClassroomSchema,
      responses: { 201: z.any() },
    },
    update: {
      method: 'PATCH' as const,
      path: '/api/classrooms/:id' as const,
      input: insertClassroomSchema.partial(),
      responses: { 200: z.any() },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/classrooms/:id' as const,
      responses: { 204: z.void() },
    },
  },
  subjects: {
    list: {
      method: 'GET' as const,
      path: '/api/subjects' as const,
      responses: { 200: z.array(z.any()) },
    },
    create: {
      method: 'POST' as const,
      path: '/api/subjects' as const,
      input: insertSubjectSchema,
      responses: { 201: z.any() },
    },
    update: {
      method: 'PATCH' as const,
      path: '/api/subjects/:id' as const,
      input: insertSubjectSchema.partial(),
      responses: { 200: z.any() },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/subjects/:id' as const,
      responses: { 204: z.void() },
    },
  },
  faculty: {
    list: {
      method: 'GET' as const,
      path: '/api/faculty' as const,
      responses: { 200: z.array(z.any()) },
    },
    create: {
      method: 'POST' as const,
      path: '/api/faculty' as const,
      input: insertFacultySchema,
      responses: { 201: z.any() },
    },
    update: {
      method: 'PATCH' as const,
      path: '/api/faculty/:id' as const,
      input: insertFacultySchema.partial(),
      responses: { 200: z.any() },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/faculty/:id' as const,
      responses: { 204: z.void() },
    },
  },
  sections: {
    list: {
      method: 'GET' as const,
      path: '/api/sections' as const,
      responses: { 200: z.array(z.any()) },
    },
    create: {
      method: 'POST' as const,
      path: '/api/sections' as const,
      input: insertSectionSchema,
      responses: { 201: z.any() },
    },
    update: {
      method: 'PATCH' as const,
      path: '/api/sections/:id' as const,
      input: insertSectionSchema.partial(),
      responses: { 200: z.any() },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/sections/:id' as const,
      responses: { 204: z.void() },
    },
  },
  timeSlots: {
    list: {
      method: 'GET' as const,
      path: '/api/timeslots' as const,
      responses: { 200: z.array(z.any()) },
    },
    create: {
      method: 'POST' as const,
      path: '/api/timeslots' as const,
      input: insertTimeSlotSchema,
      responses: { 201: z.any() },
    },
    update: {
      method: 'PATCH' as const,
      path: '/api/timeslots/:id' as const,
      input: insertTimeSlotSchema.partial(),
      responses: { 200: z.any() },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/timeslots/:id' as const,
      responses: { 204: z.void() },
    },
  },
  timetable: {
    list: {
      method: 'GET' as const,
      path: '/api/timetable' as const,
      input: z.object({
        sectionId: z.string().optional(),
        facultyId: z.string().optional(),
      }).optional(),
      responses: { 
        200: z.array(z.any()) 
      },
    },
    generate: {
      method: 'POST' as const,
      path: '/api/timetable/generate' as const,
      input: generateTimetableSchema,
      responses: {
        200: z.object({ message: z.string(), count: z.number() }),
        400: errorSchemas.conflict,
      },
    },
    generatePython: {
      method: 'POST' as const,
      path: '/api/generate-timetable' as const,
      input: generateTimetableSchema,
      responses: {
        200: z.object({ message: z.string(), count: z.number() }),
        500: z.object({ message: z.string() }),
      },
    },
  },
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}
