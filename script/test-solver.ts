import pg from 'pg';
import { generateWithPython } from '../server/python-scheduler';
import 'dotenv/config';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('supabase') ? { rejectUnauthorized: false } : undefined,
});

async function testSolverForSection(sectionId: number) {
  const client = await pool.connect();
  try {
    console.log(`Testing solver for section ${sectionId}...`);
    const secRes = await client.query('SELECT * FROM sections WHERE id = $1', [sectionId]);
    const section = secRes.rows[0];

    const subRes = await client.query('SELECT * FROM subjects WHERE section_id = $1 OR (section_id IS NULL AND department_id = $2)', [sectionId, section.department_id]);
    const subjectsForSection = subRes.rows;

    const facultyIds = Array.from(new Set(subjectsForSection.map(s => s.faculty_id).filter(Boolean)));
    const facRes = await client.query('SELECT * FROM faculty WHERE id = ANY($1)', [facultyIds]);
    const facultyForSection = facRes.rows;

    const classRes = await client.query('SELECT * FROM classrooms WHERE workspace_id = $1', [section.workspace_id || 1]);
    const allClassrooms = classRes.rows;

    const slotRes = await client.query('SELECT * FROM time_slots WHERE workspace_id = $1', [section.workspace_id || 1]);
    const allTimeSlots = slotRes.rows;

    console.log(`Subjects count: ${subjectsForSection.length}`);
    console.log(`Faculty count: ${facultyForSection.length}`);
    console.log(`Classrooms count: ${allClassrooms.length}`);
    console.log(`TimeSlots count: ${allTimeSlots.length}`);

    const daySet = new Set(allTimeSlots.map(s => s.day_of_week));
    const dayOrder = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const days = dayOrder.filter(d => daySet.has(d));

    const payload = {
      classrooms: allClassrooms.map(c => ({ roomNumber: c.room_number })),
      subjects: subjectsForSection.map(s => ({
        id: s.id,
        name: s.name,
        departmentId: s.department_id,
        sectionId: s.section_id,
        facultyId: s.faculty_id,
        weeklyHours: s.weekly_hours,
        type: s.type,
      })),
      faculty: facultyForSection.map(f => ({ id: f.id, name: f.name, departmentId: f.department_id })),
      sections: [{ id: section.id, name: section.name, departmentId: section.department_id }],
      timeslots: allTimeSlots.map(slot => ({
        id: slot.id,
        dayOfWeek: slot.day_of_week,
        label: slot.label,
        startTime: slot.start_time,
        endTime: slot.end_time,
      })),
      days,
      occupiedSlots: [],
    };

    console.log("Sending payload to Python solver...");
    const res = await generateWithPython(payload as any);
    console.log("Solver result:", res);

  } catch (err: any) {
    console.error("Solver error:", err);
  } finally {
    client.release();
    await pool.end();
  }
}

testSolverForSection(1);
