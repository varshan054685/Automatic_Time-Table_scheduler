/**
 * Master-data entity configuration.
 *
 * Single source of truth for the list + form screens: which local repository
 * backs an entity, which fields exist, and how they render. Offline edits flow
 * through services/offline-edit.ts with these field sets.
 */
import {
  departmentRepo,
  classroomRepo,
  facultyRepo,
  sectionRepo,
  subjectRepo,
  timeSlotRepo,
} from "@/database/repositories/master-data";
import { EditableEntity } from "@/services/offline-edit";

export type FieldType = "text" | "number" | "select" | "multiselect";

export interface FieldSpec {
  /** Property name on the row (camelCase, matches server + local). */
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  placeholder?: string;
  options?: string[];
  /** For select/multiselect over another entity's rows. */
  optionsFrom?: EditableEntity;
  labelFor?: (row: { name?: string; code?: string; roomNumber?: string; label?: string }) => string;
}

export interface EntitySpec {
  entity: EditableEntity;
  title: string;
  singular: string;
  icon: "building" | "faculty" | "book" | "layers" | "door" | "clock";
  /** Primary display value. */
  primaryKey: string;
  subtitleKey?: string;
  fields: FieldSpec[];
  /** Repository used to list rows. */
  listForWorkspace: (workspaceId: number) => unknown[];
}

function nameLabel(row: { name?: string }): string {
  return row.name ?? "—";
}

export const ENTITY_SPECS: Record<EditableEntity, EntitySpec> = {
  department: {
    entity: "department",
    title: "Departments",
    singular: "Department",
    icon: "building",
    primaryKey: "name",
    subtitleKey: "code",
    fields: [
      { key: "name", label: "Name", type: "text", required: true, placeholder: "Computer Science" },
      { key: "code", label: "Code", type: "text", required: true, placeholder: "CS" },
    ],
    listForWorkspace: (wsId) => departmentRepo.listForWorkspace(wsId),
  },
  faculty: {
    entity: "faculty",
    title: "Faculty",
    singular: "Faculty member",
    icon: "faculty",
    primaryKey: "name",
    subtitleKey: "code",
    fields: [
      { key: "name", label: "Name", type: "text", required: true, placeholder: "Prof. Jane Doe" },
      { key: "code", label: "Code", type: "text", required: true, placeholder: "FAC01" },
      { key: "departmentId", label: "Department", type: "select", required: true, optionsFrom: "department", labelFor: nameLabel },
      { key: "email", label: "Email", type: "text", placeholder: "jane@college.edu" },
    ],
    listForWorkspace: (wsId) => facultyRepo.listForWorkspace(wsId),
  },
  subject: {
    entity: "subject",
    title: "Subjects",
    singular: "Subject",
    icon: "book",
    primaryKey: "name",
    subtitleKey: "code",
    fields: [
      { key: "code", label: "Code", type: "text", required: true, placeholder: "CS101" },
      { key: "name", label: "Name", type: "text", required: true, placeholder: "Data Analytics" },
      { key: "weeklyHours", label: "Weekly hours", type: "number", required: true },
      { key: "departmentId", label: "Department", type: "select", required: true, optionsFrom: "department", labelFor: nameLabel },
      { key: "facultyId", label: "Faculty", type: "select", optionsFrom: "faculty", labelFor: nameLabel },
      { key: "type", label: "Type", type: "select", options: ["lecture", "lab"] },
    ],
    listForWorkspace: (wsId) => subjectRepo.listForWorkspace(wsId),
  },
  section: {
    entity: "section",
    title: "Sections",
    singular: "Section",
    icon: "layers",
    primaryKey: "name",
    subtitleKey: "semester",
    fields: [
      { key: "name", label: "Name", type: "text", required: true, placeholder: "CS-A" },
      { key: "year", label: "Year", type: "number", required: true },
      { key: "semester", label: "Semester", type: "number", required: true },
      { key: "departmentId", label: "Department", type: "select", required: true, optionsFrom: "department", labelFor: nameLabel },
      { key: "classroomId", label: "Classroom", type: "select", optionsFrom: "classroom", labelFor: (r) => r.roomNumber ?? "—" },
    ],
    listForWorkspace: (wsId) => sectionRepo.listForWorkspace(wsId),
  },
  classroom: {
    entity: "classroom",
    title: "Classrooms",
    singular: "Classroom",
    icon: "door",
    primaryKey: "roomNumber",
    subtitleKey: "type",
    fields: [
      { key: "roomNumber", label: "Room number", type: "text", required: true, placeholder: "204" },
      { key: "capacity", label: "Capacity", type: "number", required: true },
      { key: "type", label: "Type", type: "select", options: ["lecture", "lab"] },
    ],
    listForWorkspace: (wsId) => classroomRepo.listForWorkspace(wsId),
  },
  time_slot: {
    entity: "time_slot",
    title: "Time slots",
    singular: "Time slot",
    icon: "clock",
    primaryKey: "label",
    subtitleKey: "startTime",
    fields: [
      { key: "label", label: "Label", type: "text", required: true, placeholder: "Period 1" },
      { key: "dayOfWeek", label: "Day", type: "select", required: true, options: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] },
      { key: "startTime", label: "Start (HH:MM)", type: "text", required: true, placeholder: "09:00" },
      { key: "endTime", label: "End (HH:MM)", type: "text", required: true, placeholder: "10:00" },
    ],
    listForWorkspace: (wsId) => timeSlotRepo.listForWorkspace(wsId),
  },
};

/** All editable entities (ordered for the Data screen). */
export const ENTITY_ORDER: EditableEntity[] = [
  "department",
  "faculty",
  "subject",
  "section",
  "classroom",
  "time_slot",
];
