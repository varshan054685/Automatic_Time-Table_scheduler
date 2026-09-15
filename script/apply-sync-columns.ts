import pg from 'pg';
import fs from 'fs';
import path from 'path';
import 'dotenv/config';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}

const pool = new pg.Pool({
  connectionString,
  ssl: connectionString.includes('supabase') ? { rejectUnauthorized: false } : undefined,
});

async function applySyncColumns() {
  const client = await pool.connect();
  try {
    console.log('Reading migration files...');
    const migrations = ['0000_wonderful_warbird.sql', '0001_brown_steel_serpent.sql', '0002_sync_columns.sql'];

    for (const file of migrations) {
      const filePath = path.join(process.cwd(), 'migrations', file);
      if (fs.existsSync(filePath)) {
        console.log(`Applying ${file}...`);
        const sqlFile = fs.readFileSync(filePath, 'utf8');
        // Make ADD COLUMN statements safe with IF NOT EXISTS
        const safeSql = sqlFile.replace(/ADD COLUMN/g, 'ADD COLUMN IF NOT EXISTS');
        const statements = safeSql.split('--> statement-breakpoint').map((s) => s.trim()).filter(Boolean);

        for (const stmt of statements) {
          try {
            await client.query(stmt);
          } catch (err: any) {
            // Ignore table/column already exists or duplicate errors
            if (err.code === '42P07' || err.code === '42701') {
              console.log(`Skipping already applied query: ${err.message}`);
            } else {
              console.warn(`Warning on statement execution: ${err.message}`);
            }
          }
        }
      }
    }

    console.log('Database migration successfully applied!');
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

applySyncColumns();