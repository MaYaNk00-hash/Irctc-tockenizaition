import { Pool } from 'pg';
import Redis from 'ioredis';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

// Support both the app's documented names and the names used by Vercel
// Postgres/Redis integrations when they inject connection settings.
const PG_URI = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.POSTGRES_URL_NON_POOLING;
const REDIS_URI = process.env.REDIS_URL || process.env.KV_URL;
const usePgSsl = process.env.DB_SSL === 'true' || /supabase\.co|supabase\.com/i.test(PG_URI || '');
const useIpv4 = process.env.DB_IPV4 === 'true';
const poolMax = Number.parseInt(process.env.DB_POOL_MAX || '20', 10);
const poolIdleTimeout = Number.parseInt(process.env.DB_POOL_IDLE_TIMEOUT_MS || '30000', 10);
const poolConnectionTimeout = Number.parseInt(process.env.DB_POOL_CONNECTION_TIMEOUT_MS || '2000', 10);

const unavailablePool = {
  connect: async () => { throw new Error('DATABASE_URL is not configured'); },
  query: async () => { throw new Error('DATABASE_URL is not configured'); }
};

export const pool = (PG_URI ? new Pool({
  connectionString: PG_URI,
  ...(usePgSsl ? { ssl: { rejectUnauthorized: false } } : {}),
  ...(useIpv4 ? { family: 4 } : {}),
  max: Number.isFinite(poolMax) && poolMax > 0 ? poolMax : 20,
  idleTimeoutMillis: Number.isFinite(poolIdleTimeout) && poolIdleTimeout > 0 ? poolIdleTimeout : 30000,
  connectionTimeoutMillis: Number.isFinite(poolConnectionTimeout) && poolConnectionTimeout > 0 ? poolConnectionTimeout : 2000,
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
    const schemaPath = [
      path.join(__dirname, 'schema.sql'),
      path.join(__dirname, '../../src/db/schema.sql'),
      path.join(process.cwd(), 'src/db/schema.sql')
    ].find(candidate => fs.existsSync(candidate));
    if (schemaPath) {
      await client.query(fs.readFileSync(schemaPath, 'utf8'));
    } else {
      // Hosted functions may omit source assets. The production database is
      // migrated separately, so a missing local schema file is not a failed
      // database connection.
      console.log('[db] Schema file not bundled; using the existing database schema.');
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

export const dbReady = initDb();

export function isDbLive() {
  return { pg: isPgConnected, redis: isRedisConnected };
}
