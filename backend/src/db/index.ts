import { Pool } from 'pg';
import Redis from 'ioredis';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

const PG_URI = process.env.DATABASE_URL;
const REDIS_URI = process.env.REDIS_URL;

const unavailablePool = {
  connect: async () => { throw new Error('DATABASE_URL is not configured'); },
  query: async () => { throw new Error('DATABASE_URL is not configured'); }
};

export const pool = (PG_URI ? new Pool({
  connectionString: PG_URI,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
}) : unavailablePool) as Pool;

const unavailableRedis = new Proxy({ status: 'end' }, {
  get(target, property) {
    if (property === 'status') return target.status;
    if (property === 'on') return () => undefined;
    return async () => { throw new Error('REDIS_URL is not configured'); };
  }
});

export const redis = (REDIS_URI ? new Redis(REDIS_URI, {
  maxRetriesPerRequest: 1,
  retryStrategy(times) {
    if (times > 2) return null;
    return Math.min(times * 100, 1000);
  },
  lazyConnect: true,
  enableOfflineQueue: false
}) : unavailableRedis) as Redis;

// Suppress unhandled error event crashes when Redis is offline locally
redis.on('error', (err) => {
  // Silent fallback to in-memory store
});

let isPgConnected = false;
let isRedisConnected = false;

export async function initDb() {
  if (!PG_URI) console.log('[db] DATABASE_URL not configured. Using in-memory store.');
  if (!REDIS_URI) console.log('[db] REDIS_URL not configured. Using in-memory store.');

  try {
    if (!PG_URI) throw new Error('DATABASE_URL is not configured');
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
    if (!REDIS_URI) throw new Error('REDIS_URL is not configured');
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
