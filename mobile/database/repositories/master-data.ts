import { defineRepository } from "./helpers";
import {
  Department,
  Classroom,
  Faculty,
  Section,
  Subject,
  TimeSlot,
  Workspace,
  WorkspaceMember,
} from "@/types";

export const workspaceRepo = defineRepository<Workspace & Record<string, unknown>>("workspace", {
  name: "string",
  ownerId: "number",
  referralCode: "string",
  adminReferralCode: "string",
  academicYear: "string",
});

export const workspaceMemberRepo = defineRepository<WorkspaceMember & Record<string, unknown>>(
  "workspace_member",
  {
    userId: "number",
    role: "string",
    name: "string",
    email: "string",
  },
);

export const departmentRepo = defineRepository<Department & Record<string, unknown>>("department", {
  name: "string",
  code: "string",
});

export const classroomRepo = defineRepository<Classroom & Record<string, unknown>>("classroom", {
  roomNumber: "string",
  capacity: "number",
  type: "string",
});

export const facultyRepo = defineRepository<Faculty & Record<string, unknown>>("faculty", {
  name: "string",
  code: "string",
  departmentId: "number",
  email: "string",
  availability: "json-string-array",
});

export const sectionRepo = defineRepository<Section & Record<string, unknown>>("section", {
  name: "string",
  year: "number",
  semester: "number",
  departmentId: "number",
  classroomId: "number",
});

export const subjectRepo = defineRepository<Subject & Record<string, unknown>>("subject", {
  code: "string",
  name: "string",
  weeklyHours: "number",
  departmentId: "number",
  facultyId: "number",
  sectionId: "number",
  type: "string",
});

export const timeSlotRepo = defineRepository<TimeSlot & Record<string, unknown>>("time_slot", {
  dayOfWeek: "string",
  startTime: "string",
  endTime: "string",
  label: "string",
});

export function listMasterDataForWorkspace<T>(workspaceId: number): T[] {
  return [
    ...(departmentRepo.listForWorkspace(workspaceId) as T[]),
    ...(classroomRepo.listForWorkspace(workspaceId) as T[]),
    ...(facultyRepo.listForWorkspace(workspaceId) as T[]),
    ...(sectionRepo.listForWorkspace(workspaceId) as T[]),
    ...(subjectRepo.listForWorkspace(workspaceId) as T[]),
    ...(timeSlotRepo.listForWorkspace(workspaceId) as T[]),
  ];
}
