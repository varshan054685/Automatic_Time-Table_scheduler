import axios from "axios";

type SchedulerInput = {
  classrooms: Array<{ roomNumber: string }>;
  subjects: Array<{
    id: number; // ✅ REQUIRED
    name: string;
    departmentId: number;
    sectionId: number | null;
    facultyId: number | null;
    weeklyHours: number;
    type: string | null;
  }>;
  faculty: Array<{ id: number; name: string; departmentId: number }>;
  sections: Array<{ id: number; name: string; departmentId: number }>;
  timeslots: Array<{
    id: number;
    dayOfWeek: string;
    label: string;
    startTime: string;
    endTime: string;
  }>;
  days: string[];
};

type SchedulerOutput = {
  timetable: Array<{
    day: string;
    period: string;
    sectionId: number;
    subjectId: number;
    facultyId: number;
    room: string;
  }>;
};

export async function generateWithPython(
  payload: SchedulerInput
): Promise<SchedulerOutput> {
  // ✅ Works for both LOCAL and PRODUCTION
  const baseUrl =
    process.env.PYTHON_SERVICE_URL || "http://127.0.0.1:8000";

  console.log("📡 Using Python Service:", baseUrl);

  try {
    console.log("Sending to Python:", JSON.stringify(payload, null, 2));

    const response = await axios.post<SchedulerOutput>(
      `${baseUrl}/generate-timetable`,
      payload,
      {
        headers: {
          "Content-Type": "application/json",
        },
        timeout: 190000, // OR-Tools can be slow
      }
    );

    // ✅ Debug output
    console.log("📥 Python response:");
    console.log(JSON.stringify(response.data, null, 2));

    return response.data;
  } catch (error: any) {
    console.error("Python ERROR FULL:", error.response?.data || error.message);
    throw new Error("Python failed");
  }
}