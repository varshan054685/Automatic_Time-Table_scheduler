import pg from 'pg';
const pool = new pg.Pool({ connectionString: 'postgresql://college_user:college123@127.0.0.1:5432/postgres' });
async function start() {
    try {
        console.log("Attempting to create college_hub...");
        await pool.query('CREATE DATABASE college_hub;');
        console.log("SUCCESS: Database college_hub created!");
    } catch(err) {
        console.error("FAILED TO CREATE:", err);
    }
    process.exit(0);
}
start();
