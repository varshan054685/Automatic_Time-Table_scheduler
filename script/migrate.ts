import pg from 'pg';
import fs from 'fs';
import path from 'path';
import 'dotenv/config';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function migrate() {
  const client = await pool.connect();
  try {
    console.log('Dropping specific tables...');
    await client.query(`DROP TABLE IF EXISTS "change_requests", "timetable", "time_slots", "sections", "faculty", "subjects", "classrooms", "departments", "workspace_members", "workspaces", "users" CASCADE;`);
    
    console.log('Reading migration SQL...');
    const sqlPath = path.join(process.cwd(), 'migrations', '0000_wonderful_warbird.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    console.log('Applying migration...');
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');
    console.log('Migration successful!');
    process.exit(0);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Migration error:', err);
    process.exit(1);
  } finally {
    client.release();
  }
}

migrate();
