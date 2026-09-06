import Redis from 'ioredis';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { pool, redis } from '../db';
import { WaitingRoomService, waitingRoomConfig } from '../services/waitingRoom';
import { SeatLockService } from '../services/seatLock';

const integrationTest = process.env.RUN_INTEGRATION === '1' ? test : test.skip;
const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';

describe('distributed Redis invariants', () => {
  let workerA: Redis;
  let workerB: Redis;
  let redisAvailable = false;

  beforeAll(async () => {
    if (process.env.RUN_INTEGRATION !== '1') return;
    workerA = new Redis(redisUrl, { lazyConnect: true, maxRetriesPerRequest: 1, connectTimeout: 500, retryStrategy: () => null });
    workerB = new Redis(redisUrl, { lazyConnect: true, maxRetriesPerRequest: 1, connectTimeout: 500, retryStrategy: () => null });
    try {
      await workerA.connect();
      await workerB.connect();
      if (redis.status !== 'ready') await redis.connect();
      redisAvailable = true;
    } catch {
      redisAvailable = false;
      workerA.disconnect();
      workerB.disconnect();
    }
  });

  afterAll(async () => {
    if (workerA?.status === 'ready') await workerA.quit().catch(() => undefined);
    else workerA?.disconnect();
    if (workerB?.status === 'ready') await workerB.quit().catch(() => undefined);
    else workerB?.disconnect();
    if (redis.status === 'ready') await redis.quit().catch(() => undefined);
  });

  integrationTest('two workers admit each queued ticket once', async () => {
    if (!redisAvailable) throw new Error('Redis is unavailable; start Redis or omit RUN_INTEGRATION=1.');
    const trainKey = `integration:queue:${Date.now()}`;
    const ticketIds = ['ticket-a', 'ticket-b', 'ticket-c'];
    for (const [index, ticketId] of ticketIds.entries()) {
      await workerA.zadd(`waiting_room:${trainKey}`, Date.now() + index, ticketId);
      await workerA.hset(`ticket_meta:${ticketId}`, { userId: index + 1, trainKey, status: 'QUEUED' });
    }
    const previousBatchSize = waitingRoomConfig.batchSize;
    waitingRoomConfig.batchSize = ticketIds.length;
    try {
      await Promise.all([
        WaitingRoomService.processNextBatch(trainKey),
        WaitingRoomService.processNextBatch(trainKey)
      ]);
      const statuses = await Promise.all(ticketIds.map(ticketId => workerB.hget(`ticket_meta:${ticketId}`, 'status')));
      expect(statuses).toEqual(['ADMITTED', 'ADMITTED', 'ADMITTED']);
      expect(await workerB.zcard(`waiting_room:${trainKey}`)).toBe(0);
    } finally {
      waitingRoomConfig.batchSize = previousBatchSize;
      await workerA.del(`waiting_room:${trainKey}`, ...ticketIds.map(ticketId => `ticket_meta:${ticketId}`));
    }
  });

  integrationTest('two workers cannot claim the same selected seat', async () => {
    if (!redisAvailable) throw new Error('Redis is unavailable; start Redis or omit RUN_INTEGRATION=1.');
    const jobBase = {
      trainId: `integration-${Date.now()}`, seatClass: '3A', travelDate: '2026-09-04',
      passengerNames: ['Passenger'], admissionToken: 'integration', timestamp: Date.now(), selectedSeats: ['B2-01']
    };
    const [first, second] = await Promise.all([
      SeatLockService.reserveSelectedSeatsDistributed({ ...jobBase, jobId: 'worker-a', userId: 1001 }),
      SeatLockService.reserveSelectedSeatsDistributed({ ...jobBase, jobId: 'worker-b', userId: 1002 })
    ]);
    expect([first.status, second.status].sort()).toEqual(['RESERVED', 'SEATS_EXHAUSTED']);

    const map = await SeatLockService.getSeatMapAsync(jobBase.trainId, jobBase.seatClass, jobBase.travelDate);
    expect(map.seats.find(seat => seat.number === 'B2-01')?.state).toBe('LOCKED');
    if (first.tokenId) await workerA.del(`seat_lock:${first.tokenId}`, `seat_token:${first.tokenId}`);
    await workerA.del(`seat_locks:${jobBase.trainId}:${jobBase.seatClass}:${jobBase.travelDate}`);
  });
});

const postgresIntegrationTest = process.env.RUN_INTEGRATION === '1' && process.env.DATABASE_URL ? test : test.skip;

describe('distributed Postgres invariants', () => {
  let postgresAvailable = false;

  beforeAll(async () => {
    try {
      const client = await pool.connect();
      await client.query(fs.readFileSync(path.join(__dirname, '../db/schema.sql'), 'utf8'));
      client.release();
      postgresAvailable = true;
    } catch {
      postgresAvailable = false;
    }
  });

  postgresIntegrationTest('concurrent expiry workers reclaim inventory once', async () => {
    if (!postgresAvailable) throw new Error('Postgres is unavailable; start Postgres or omit RUN_INTEGRATION=1.');
    const client = await pool.connect();
    const trainId = `integration-${Date.now()}`;
    let tokenId = '';
    try {
      const inventory = await client.query(
        `INSERT INTO seat_inventory (train_id, seat_class, travel_date, total_seats, available_seats)
         VALUES ($1, '3A', '2026-09-04', 40, 39) RETURNING id`,
        [trainId]
      );
      tokenId = crypto.randomUUID();
      await client.query(
        `INSERT INTO seat_tokens (token_id, user_id, inventory_id, status, expires_at)
         VALUES ($1, 1, $2, 'RESERVED', NOW() - INTERVAL '1 minute')`,
        [tokenId, inventory.rows[0].id]
      );
      await client.query(`INSERT INTO token_seats (token_id, passenger_name, seat_number) VALUES ($1, 'Integration', 'B2-01')`, [tokenId]);
      await Promise.all([SeatLockService.reconcileExpiredTokens(), SeatLockService.reconcileExpiredTokens()]);
      const result = await client.query(`SELECT available_seats FROM seat_inventory WHERE id = $1`, [inventory.rows[0].id]);
      const token = await client.query(`SELECT status FROM seat_tokens WHERE token_id = $1`, [tokenId]);
      expect(result.rows[0].available_seats).toBe(40);
      expect(token.rows[0].status).toBe('EXPIRED');
    } finally {
      if (tokenId) await client.query(`DELETE FROM seat_tokens WHERE token_id = $1`, [tokenId]);
      await client.query(`DELETE FROM seat_inventory WHERE train_id = $1`, [trainId]);
      client.release();
    }
  });
});
