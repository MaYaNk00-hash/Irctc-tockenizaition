import { Pool } from 'pg';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '../.env') });

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL is missing. Create ../.env from .env.example and set the PostgreSQL URI from Supabase Project Settings -> Database.');
}

if (/^https?:\/\//i.test(databaseUrl)) {
  throw new Error('DATABASE_URL must be a PostgreSQL URI (postgresql:// or postgres://), not the Supabase REST URL.');
}

const usePgSsl = process.env.DB_SSL === 'true' || /supabase\.co|supabase\.com/i.test(databaseUrl);
const useIpv4 = process.env.DB_IPV4 === 'true';
const pool = new Pool({
  connectionString: databaseUrl,
  ...(usePgSsl ? { ssl: { rejectUnauthorized: false } } : {}),
  ...(useIpv4 ? { family: 4 } : {})
});

async function migrate() {
  const schemaPath = path.resolve(__dirname, 'schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf8');
  const client = await pool.connect();

  try {
    await client.query(schema);
    console.log('Database schema migrated successfully.');
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch(error => {
  console.error(`Database migration failed: ${error instanceof Error ? error.message : error}`);
  process.exitCode = 1;
});