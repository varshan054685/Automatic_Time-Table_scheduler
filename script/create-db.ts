import pg from 'pg';

const pool = new pg.Pool({ connectionString: 'postgresql://college_user:college123@127.0.0.1:5432/postgres' });
async function run() {
  try {
    await pool.query('DROP DATABASE IF EXISTS college_hub WITH (FORCE);').catch(() => {});
    await pool.query('DROP DATABASE IF EXISTS college_hub_new WITH (FORCE);').catch(() => {});
    await pool.query('CREATE DATABASE college_hub_new;');
    console.log('Created db');
  } catch(e) { console.error(e) }
  process.exit(0);
}
run();
