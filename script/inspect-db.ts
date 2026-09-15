import pg from 'pg';
import 'dotenv/config';

const connectionString = process.env.DATABASE_URL;
const pool = new pg.Pool({
  connectionString,
  ssl: connectionString?.includes('supabase') ? { rejectUnauthorized: false } : undefined,
});

async function inspect() {
  const client = await pool.connect();
  try {
    console.log("=== SECTIONS ===");
    const sectionsRes = await client.query('SELECT id, name, department_id, semester FROM sections ORDER BY id');
    console.table(sectionsRes.rows);

    console.log("\n=== SUBJECTS ===");
    const subjectsRes = await client.query('SELECT id, name, code, department_id, section_id, faculty_id, weekly_hours FROM subjects ORDER BY id');
    console.table(subjectsRes.rows);

    console.log("\n=== FACULTY ===");
    const facultyRes = await client.query('SELECT id, name, department_id FROM faculty ORDER BY id');
    console.table(facultyRes.rows);

    console.log("\n=== TIMETABLE ENTRIES PER SECTION ===");
    const ttRes = await client.query(`
      SELECT s.id as section_id, s.name as section_name, COUNT(t.id) as entry_count
      FROM sections s
      LEFT JOIN timetable t ON t.section_id = s.id AND t.deleted_at IS NULL
      GROUP BY s.id, s.name
      ORDER BY s.id
    `);
    console.table(ttRes.rows);

  } catch (err) {
    console.error("Error inspecting DB:", err);
  } finally {
    client.release();
    await pool.end();
  }
}

inspect();
