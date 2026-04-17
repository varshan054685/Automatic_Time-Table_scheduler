import axios from "axios";

async function run() {
  const payload = {
    classrooms: [{ roomNumber: "101" }],
    subjects: [{
      id: 1, name: "Math", departmentId: 1, sectionId: 1, facultyId: 1, weeklyHours: 2, type: "lecture"
    }],
    faculty: [{ id: 1, name: "Dr. Smith", departmentId: 1 }],
    sections: [{ id: 1, name: "Section A", departmentId: 1 }],
    timeslots: [
      { id: 1, dayOfWeek: "Monday", label: "P1", startTime: "09:00", endTime: "10:00" },
      { id: 2, dayOfWeek: "Monday", label: "P2", startTime: "10:00", endTime: "11:00" },
      { id: 3, dayOfWeek: "Monday", label: "P3", startTime: "11:00", endTime: "12:00" }
    ],
    days: ["Monday"]
  };

  console.log("Pinging https://automatic-time-table-scheduler.onrender.com/generate-timetable ...");
  try {
    const res = await axios.post("https://automatic-time-table-scheduler.onrender.com/generate-timetable", payload);
    console.log("SUCCESS! Got data:", res.data);
  } catch (err: any) {
    if (err.response) {
      console.error("FAILED with status:", err.response.status);
      console.error("Data:", err.response.data);
    } else {
      console.error("FAILED with error:", err.message);
    }
  }
}
run();
