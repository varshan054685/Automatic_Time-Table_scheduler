import pg from 'pg';
const pool = new pg.Pool({ connectionString: 'postgresql://college_user:college123@127.0.0.1:5432/postgres' });
async function start() {
    await pool.query('CREATE DATABASE college_hub;').catch(()=>console.log("already exists"));
    console.log("created");
    process.exit(0);
}
start();
