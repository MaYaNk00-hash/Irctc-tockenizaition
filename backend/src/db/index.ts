import { Pool } from 'pg';
import Redis from 'ioredis';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

const PG_URI = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/tatkal_db';
const REDIS_URI = process.env.REDIS_URL || 'redis://localhost:6379';

export const pool = new Pool({
  connectionString: PG_URI,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

export const redis = new Redis(REDIS_URI, {
  maxRetriesPerRequest: 1,
  retryStrategy(times) {
    if (times > 2) return null;
    return Math.min(times * 100, 1000);
  },
  lazyConnect: true,
  enableOfflineQueue: false
});

// Suppress unhandled error event crashes when Redis is offline locally
redis.on('error', (err) => {
  // Silent fallback to in-memory store
});

let isPgConnected = false;
let isRedisConnected = false;

export async function initDb() {
  try {
    const client = await pool.connect();
    const schemaPath = path.join(__dirname, 'schema.sql');
    if (fs.existsSync(schemaPath)) {
      const sql = fs.readFileSync(schemaPath, 'utf8');
      await client.query(sql);
    }
    client.release();
    isPgConnected = true;
    console.log('[db] Postgres connected.');
  } catch (err: any) {
    console.log('[db] Postgres offline. Using in-memory store.');
  }

  try {
    await redis.connect();
    isRedisConnected = true;
    console.log('[db] Redis connected.');
  } catch (err: any) {
    console.log('[db] Redis offline. Using in-memory store.');
  }
}

export function isDbLive() {
  return { pg: isPgConnected, redis: isRedisConnected };
}
