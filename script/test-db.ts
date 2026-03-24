import pg from 'pg';
import 'dotenv/config';

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function test() {
  try {
    console.log('Killing other connections...');
    const q = `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'college_hub' AND pid <> pg_backend_pid();`;
    await pool.query(q);
    console.log('Killed connections. Exiting...');
    process.exit(0);
  } catch (err) {
    console.error('ERROR:', err);
    process.exit(1);
  }
}
test();
