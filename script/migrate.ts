import pg from 'pg';
import fs from 'fs';
import path from 'path';
import 'dotenv/config';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function migrate() {
  const client = await pool.connect();
  try {
    console.log('Dropping specific tables...');
    await client.query(`DROP TABLE IF EXISTS "generation_results", "generation_jobs", "otp_verifications", "change_requests", "timetable", "time_slots", "sections", "faculty", "subjects", "classrooms", "departments", "workspace_members", "workspaces", "users" CASCADE;`);
    
    console.log('Reading migration SQL...');
    const sql0 = fs.readFileSync(path.join(process.cwd(), 'migrations', '0000_wonderful_warbird.sql'), 'utf8');
    const sql1 = fs.readFileSync(path.join(process.cwd(), 'migrations', '0001_brown_steel_serpent.sql'), 'utf8');
    const sql2 = fs.readFileSync(path.join(process.cwd(), 'migrations', '0002_sync_columns.sql'), 'utf8');
    
    console.log('Applying migration...');
    await client.query('BEGIN');
    await client.query(sql0);
    await client.query(sql1);
    await client.query(sql2);
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
