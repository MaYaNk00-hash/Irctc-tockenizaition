import crypto from 'crypto';
import { pool, redis } from '../db';
import { AuditService } from './auditService';
import { BookingJob, JobResult } from './scheduler';

export interface SeatTokenRecord {
  tokenId: string;
  userId: number;
  inventoryId: number;
  status: 'RESERVED' | 'PAYMENT_PROCESSING' | 'CONFIRMED' | 'EXPIRED' | 'PAYMENT_FAILED' | 'REFUND_INITIATED' | 'REFUND_COMPLETED';
  expiresAt: Date;
  pnr?: string;
  inventoryKey?: string;
  seatCount?: number;
  trainId?: string;
  seatClass?: string;
  travelDate?: string;
  passengerNames?: string[];
  seatNumbers?: string[];
}

// In-memory token store fallback
const memoryTokens: Map<string, SeatTokenRecord> = new Map();
const memoryInventorySeats: Map<string, number> = new Map(); // key -> available count
const memorySeatLocks: Map<string, Map<string, string>> = new Map(); // inventory key -> seat -> token

const coachForClass = (seatClass: string) => seatClass === '1A' ? 'H1' : seatClass === '2A' ? 'A1' : seatClass === '3A' ? 'B2' : seatClass === 'CC' || seatClass === 'EC' ? 'C1' : 'S4';
const inventoryKeyFor = (trainId: string, seatClass: string, travelDate: string) => `${trainId}:${seatClass}:${travelDate}`;

export class SeatLockService {
  public static async releaseLockDistributed(tokenId: string, status: 'EXPIRED' | 'PAYMENT_FAILED' = 'EXPIRED'): Promise<boolean> {
    let record = memoryTokens.get(tokenId);
    if (!record && redis.status === 'ready') {
      try {
        const raw = await redis.get(`seat_token:${tokenId}`);
        if (raw) record = JSON.parse(raw) as SeatTokenRecord;
      } catch { /* use the local fallback below */ }
    }
    if (!record) return false;
    if (record.inventoryKey && record.seatNumbers?.length && redis.status === 'ready') {
      await redis.hdel(`seat_locks:${record.inventoryKey}`, ...record.seatNumbers);
      await redis.del(`seat_lock:${tokenId}`, `seat_token:${tokenId}`);
    }
    memoryTokens.set(tokenId, record);
    return this.releaseLock(tokenId, status);
  }

  public static releaseLock(tokenId: string, status: 'EXPIRED' | 'PAYMENT_FAILED' = 'EXPIRED'): boolean {
    const record = memoryTokens.get(tokenId);
    if (!record || record.status === 'CONFIRMED' || record.status === 'REFUND_COMPLETED') return false;
    const fromStatus = record.status;
    record.status = status;
    if (record.inventoryKey) {
      const locks = memorySeatLocks.get(record.inventoryKey);
      record.seatNumbers?.forEach(seat => locks?.delete(seat));
      if (redis.status === 'ready' && record.seatNumbers?.length) {
        redis.hdel(`seat_locks:${record.inventoryKey}`, ...record.seatNumbers).catch(() => undefined);
        redis.del(`seat_lock:${tokenId}`, `seat_token:${tokenId}`).catch(() => undefined);
      }
      const available = memoryInventorySeats.get(record.inventoryKey) || 0;
      memoryInventorySeats.set(record.inventoryKey, available + (record.seatCount || 1));
    }
    AuditService.logStatus(tokenId, fromStatus, status, status === 'EXPIRED' ? 'Seat lock expired and the selected seat was released.' : 'Payment failed and the selected seat was released.');
    return true;
  }
  public static getSeatMap(trainId: string, seatClass: string, travelDate: string) {
    const key = inventoryKeyFor(trainId, seatClass, travelDate);
    const locks = memorySeatLocks.get(key) || new Map<string, string>();
    const coach = coachForClass(seatClass);
    const seats = Array.from({ length: 40 }, (_, index) => {
      const number = `${coach}-${String(index + 1).padStart(2, '0')}`;
      const tokenId = locks.get(number);
      const token = tokenId ? memoryTokens.get(tokenId) : undefined;
      const occupied = index === 6 || index === 19 || index === 31;
      return { number, state: occupied ? 'OCCUPIED' : token && token.status === 'RESERVED' ? 'LOCKED' : 'AVAILABLE' };
    });
    return { coach, seats, available: seats.filter(seat => seat.state === 'AVAILABLE').length };
  }

  public static async getSeatMapAsync(trainId: string, seatClass: string, travelDate: string) {
    if (redis.status !== 'ready') return this.getSeatMap(trainId, seatClass, travelDate);
    const key = inventoryKeyFor(trainId, seatClass, travelDate);
    try {
      const locks = await redis.hgetall(`seat_locks:${key}`);
      const lockEntries = Object.entries(locks);
      const activeEntries = await Promise.all(lockEntries.map(async ([seat, tokenId]) => {
        return (await redis.exists(`seat_lock:${tokenId}`)) === 1 ? [seat, tokenId] as const : null;
      }));
      for (let index = 0; index < activeEntries.length; index++) {
        if (!activeEntries[index]) await redis.hdel(`seat_locks:${key}`, lockEntries[index][0]);
      }
      const activeLocks = Object.fromEntries(activeEntries.filter((entry): entry is readonly [string, string] => Boolean(entry)));
      const coach = coachForClass(seatClass);
      const seats = Array.from({ length: 40 }, (_, index) => {
        const number = `${coach}-${String(index + 1).padStart(2, '0')}`;
        const occupied = index === 6 || index === 19 || index === 31;
        return { number, state: occupied ? 'OCCUPIED' : activeLocks[number] ? 'LOCKED' : 'AVAILABLE' };
      });
      return { coach, seats, available: seats.filter(seat => seat.state === 'AVAILABLE').length };
    } catch {
      return this.getSeatMap(trainId, seatClass, travelDate);
    }
  }

  public static async reserveSelectedSeatsDistributed(job: BookingJob): Promise<JobResult> {
    if (redis.status !== 'ready') return this.reserveSelectedSeats(job);
    const key = inventoryKeyFor(job.trainId, job.seatClass, job.travelDate);
    const requested = Math.max(job.passengerNames.length, 1);
    const selectedSeats = job.selectedSeats || [];
    if (selectedSeats.length !== requested || new Set(selectedSeats).size !== selectedSeats.length) {
      return { jobId: job.jobId, status: 'FAILED', reason: 'Select one unique available seat for each passenger.' };
    }

    const coach = coachForClass(job.seatClass);
    const validSeats = new Set(Array.from({ length: 40 }, (_, index) => `${coach}-${String(index + 1).padStart(2, '0')}`));
    const occupiedSeats = new Set([`${coach}-07`, `${coach}-20`, `${coach}-32`]);
    if (selectedSeats.some(seat => !validSeats.has(seat) || occupiedSeats.has(seat))) {
      return { jobId: job.jobId, status: 'SEATS_EXHAUSTED', reason: 'One or more selected seats are occupied or invalid.' };
    }

    const tokenId = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 2 * 60 * 1000);
    const result = await redis.eval(
      `for i = 1, #ARGV - 2 do
         if redis.call('HEXISTS', KEYS[1], ARGV[i]) == 1 then return 0 end
       end
       for i = 1, #ARGV - 2 do redis.call('HSET', KEYS[1], ARGV[i], ARGV[#ARGV - 1]) end
       redis.call('SETEX', KEYS[2], ARGV[#ARGV], ARGV[#ARGV - 1])
       return 1`,
      2,
      `seat_locks:${key}`,
      `seat_lock:${tokenId}`,
      ...selectedSeats,
      tokenId,
      Math.max(1, Math.floor((expiresAt.getTime() - Date.now()) / 1000)).toString()
    );
    if (result !== 1) return { jobId: job.jobId, status: 'SEATS_EXHAUSTED', reason: 'One or more selected seats are no longer available.' };

    const record: SeatTokenRecord = {
      tokenId, userId: job.userId, inventoryId: 1, status: 'RESERVED', expiresAt,
      inventoryKey: key, seatCount: selectedSeats.length, trainId: job.trainId,
      seatClass: job.seatClass, travelDate: job.travelDate, passengerNames: job.passengerNames, seatNumbers: selectedSeats
    };

    let client: any = null;
    try {
      client = await pool.connect();
      await client.query('BEGIN');
      const inventory = await client.query(
        `INSERT INTO seat_inventory (train_id, seat_class, travel_date, total_seats, available_seats)
         VALUES ($1, $2, $3, 40, 37)
         ON CONFLICT (train_id, seat_class, travel_date) DO UPDATE SET available_seats = seat_inventory.available_seats
         RETURNING id`,
        [job.trainId, job.seatClass, job.travelDate]
      );
      const inventoryId = inventory.rows[0]?.id || (await client.query(
        `SELECT id FROM seat_inventory WHERE train_id = $1 AND seat_class = $2 AND travel_date = $3 FOR UPDATE`,
        [job.trainId, job.seatClass, job.travelDate]
      )).rows[0]?.id;
      if (!inventoryId) throw new Error('Seat inventory row could not be created.');
      record.inventoryId = Number(inventoryId);
      await client.query(
        `INSERT INTO seat_tokens (token_id, user_id, inventory_id, status, expires_at)
         VALUES ($1, $2, $3, 'RESERVED', $4)`,
        [tokenId, job.userId, record.inventoryId, expiresAt]
      );
      for (let index = 0; index < selectedSeats.length; index++) {
        await client.query(
          `INSERT INTO token_seats (token_id, passenger_name, seat_number) VALUES ($1, $2, $3)`,
          [tokenId, job.passengerNames[index], selectedSeats[index]]
        );
      }
      await client.query('COMMIT');
    } catch (error) {
      if (client) try { await client.query('ROLLBACK'); } catch { /* preserve the original failure */ }
      await redis.hdel(`seat_locks:${key}`, ...selectedSeats);
      await redis.del(`seat_lock:${tokenId}`, `seat_token:${tokenId}`);
      return { jobId: job.jobId, status: 'FAILED', reason: error instanceof Error ? error.message : 'Seat reservation persistence failed.' };
    } finally {
      if (client) client.release();
    }

    memoryTokens.set(tokenId, record);
    await redis.setex(`seat_token:${tokenId}`, Math.max(1, Math.floor((expiresAt.getTime() - Date.now()) / 1000)), JSON.stringify(record));
    await AuditService.logStatus(tokenId, 'ADMITTED', 'SEAT_LOCKED', `Temporarily reserved ${selectedSeats.join(', ')} for ${requested} passenger(s).`);
    return { jobId: job.jobId, status: 'RESERVED', tokenId, expiresAt: expiresAt.toISOString() };
  }

  public static reserveSelectedSeats(job: BookingJob): JobResult {
    const key = inventoryKeyFor(job.trainId, job.seatClass, job.travelDate);
    const requested = Math.max(job.passengerNames.length, 1);
    const selectedSeats = job.selectedSeats || [];
    if (selectedSeats.length !== requested) return { jobId: job.jobId, status: 'FAILED', reason: 'Select one available seat for each passenger.' };
    const map = this.getSeatMap(job.trainId, job.seatClass, job.travelDate);
    const available = new Set(map.seats.filter(seat => seat.state === 'AVAILABLE').map(seat => seat.number));
    if (new Set(selectedSeats).size !== selectedSeats.length || selectedSeats.some(seat => !available.has(seat))) {
      return { jobId: job.jobId, status: 'SEATS_EXHAUSTED', reason: 'One or more selected seats are no longer available.' };
    }
    const tokenId = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 2 * 60 * 1000);
    const locks = memorySeatLocks.get(key) || new Map<string, string>();
    selectedSeats.forEach(seat => locks.set(seat, tokenId));
    memorySeatLocks.set(key, locks);
    memoryInventorySeats.set(key, map.available - selectedSeats.length);
    memoryTokens.set(tokenId, { tokenId, userId: job.userId, inventoryId: 1, status: 'RESERVED', expiresAt, inventoryKey: key, seatCount: selectedSeats.length, trainId: job.trainId, seatClass: job.seatClass, travelDate: job.travelDate, passengerNames: job.passengerNames, seatNumbers: selectedSeats });
    AuditService.logStatus(tokenId, 'ADMITTED', 'SEAT_LOCKED', `Temporarily reserved ${selectedSeats.join(', ')} for ${requested} passenger(s).`);
    return { jobId: job.jobId, status: 'RESERVED', tokenId, expiresAt: expiresAt.toISOString() };
  }
  /**
   * Register fast TTL lock in Redis + Postgres
   */
  public static async registerLock(
    tokenId: string,
    userId: number,
    inventoryId: number,
    expiresAt: Date
  ): Promise<void> {
    const ttlSeconds = Math.max(1, Math.floor((expiresAt.getTime() - Date.now()) / 1000));
    memoryTokens.set(tokenId, {
      tokenId,
      userId,
      inventoryId,
      status: 'RESERVED',
      expiresAt
    });
    if (redis.status === 'ready') {
      try {
        await redis.setex(`seat_lock:${tokenId}`, ttlSeconds, JSON.stringify({ userId, inventoryId, status: 'RESERVED' }));
      } catch {
        // Fallback already saved in memoryTokens
      }
    }
  }

  /**
   * Check if token is valid and unexpired
   */
  public static async getValidToken(tokenId: string): Promise<SeatTokenRecord | null> {
    try {
      const res = await pool.query(
        `SELECT token_id, user_id, inventory_id, status, expires_at, pnr
         FROM seat_tokens WHERE token_id = $1`,
        [tokenId]
      );
      if (res.rows.length === 0) {
        if (redis.status === 'ready') {
          const raw = await redis.get(`seat_token:${tokenId}`);
          if (raw) return JSON.parse(raw) as SeatTokenRecord;
        }
        return null;
      }
      const row = res.rows[0];
      return {
        tokenId: row.token_id,
        userId: parseInt(row.user_id, 10),
        inventoryId: parseInt(row.inventory_id, 10),
        status: row.status,
        expiresAt: new Date(row.expires_at),
        pnr: row.pnr
      };
    } catch {
      if (redis.status === 'ready') {
        try {
          const raw = await redis.get(`seat_token:${tokenId}`);
          if (raw) return JSON.parse(raw) as SeatTokenRecord;
        } catch { /* use local degraded fallback */ }
      }
      const mem = memoryTokens.get(tokenId);
      return mem || null;
    }
  }

  /**
   * In-memory fallback seat reservation when DB is offline
   */
  public static fallbackReserveSeat(job: BookingJob): JobResult {
    const key = `${job.trainId}:${job.seatClass}:${job.travelDate}`;
    const currentSeats = memoryInventorySeats.has(key) ? memoryInventorySeats.get(key)! : 10;

    const requested = Math.max(job.passengerNames.length, 1);
    if (currentSeats < requested) {
      return {
        jobId: job.jobId,
        status: 'SEATS_EXHAUSTED',
        reason: `Requested ${requested} seats, but only ${currentSeats} available`
      };
    }

    memoryInventorySeats.set(key, currentSeats - requested);
    const tokenId = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    const tokenRecord: SeatTokenRecord = {
      tokenId,
      userId: job.userId,
      inventoryId: 1,
      status: 'RESERVED',
      expiresAt,
      inventoryKey: key,
      seatCount: requested,
      trainId: job.trainId,
      seatClass: job.seatClass,
      travelDate: job.travelDate,
      passengerNames: job.passengerNames
    };

    memoryTokens.set(tokenId, tokenRecord);
    AuditService.logStatus(tokenId, 'ADMITTED', 'RESERVED', `Seats locked successfully in fallback mode for ${requested} passenger(s)`);

    return {
      jobId: job.jobId,
      status: 'RESERVED',
      tokenId,
      expiresAt: expiresAt.toISOString()
    };
  }

  /**
   * TTL Expiry Worker Loop: Reconciles Redis & Postgres.
   * Atomically releases seats back to inventory if token expired without payment completion.
   */
  public static async reconcileExpiredTokens(): Promise<number> {
    let expiredCount = 0;
    let client: any = null;
    try {
      client = await pool.connect();
      await client.query('BEGIN');
      const res = await client.query(
        `SELECT token_id, inventory_id, status FROM seat_tokens
         WHERE status IN ('RESERVED', 'PAYMENT_PROCESSING') AND expires_at < NOW()
         FOR UPDATE SKIP LOCKED`
      );

      for (const row of res.rows) {
        const tokenId = row.token_id;
        const inventoryId = row.inventory_id;
        const fromStatus = row.status;

        // Count how many seats were reserved under this token
        const seatsRes = await client.query(
          `SELECT COUNT(*) FROM token_seats WHERE token_id = $1`,
          [tokenId]
        );
        const seatCount = Math.max(parseInt(seatsRes.rows[0].count, 10), 1);

        // Update token status to EXPIRED
        await client.query(
          `UPDATE seat_tokens SET status = 'EXPIRED' WHERE token_id = $1`,
          [tokenId]
        );

        // Atomically increment seat_inventory available_seats back
        await client.query(
          `UPDATE seat_inventory SET available_seats = available_seats + $1, version = version + 1 WHERE id = $2`,
          [seatCount, inventoryId]
        );

        // Remove from Redis lock
        await client.query('COMMIT');
        await redis.del(`seat_lock:${tokenId}`, `seat_token:${tokenId}`);

        await AuditService.logStatus(
          tokenId,
          fromStatus,
          'EXPIRED',
          `Seat lock TTL expired. Reclaimed ${seatCount} seat(s) back to inventory counter.`
        );

        expiredCount++;
        await client.query('BEGIN');
      }
      await client.query('COMMIT');
    } catch {
      if (client) try { await client.query('ROLLBACK'); } catch { /* already unavailable */ }
      // In-memory expiry check
      const now = new Date();
      for (const [tokenId, record] of memoryTokens.entries()) {
        if ((record.status === 'RESERVED' || record.status === 'PAYMENT_PROCESSING') && record.expiresAt < now) {
          if (this.releaseLock(tokenId, 'EXPIRED')) expiredCount++;
        }
      }
    }

    if (client) client.release();

    return expiredCount;
  }
}
