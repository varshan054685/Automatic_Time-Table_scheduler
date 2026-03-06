import axios from "axios";

type SchedulerInput = {
  classrooms: Array<{ roomNumber: string }>;
  subjects: Array<{
    name: string;
    departmentId: number;
    sectionId: number | null;
    facultyId: number | null;
    weeklyHours: number;
  }>;
  faculty: Array<{ id: number; name: string; departmentId: number }>;
  sections: Array<{ id: number; name: string; departmentId: number }>;
  timeslots: Array<{
    dayOfWeek: string;
    label: string;
    startTime: string;
    endTime: string;
  } & { id: number }>;
  days: string[];
};

type SchedulerOutput = {
  timetable: Array<{
    day: string;
    period: string;
    section: string;
    subject: string;
    faculty: string;
    room: string;
  }>;
};

export async function generateWithPython(payload: SchedulerInput): Promise<SchedulerOutput> {
  const baseUrl = process.env.PYTHON_SERVICE_URL || "http://127.0.0.1:8000";
  const response = await axios.post<SchedulerOutput>(`${baseUrl}/generate-timetable`, payload, {
    timeout: 30000,
  });
  return response.data;
}
