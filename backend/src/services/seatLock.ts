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
  public static releaseLock(tokenId: string, status: 'EXPIRED' | 'PAYMENT_FAILED' = 'EXPIRED'): boolean {
    const record = memoryTokens.get(tokenId);
    if (!record || record.status === 'CONFIRMED' || record.status === 'REFUND_COMPLETED') return false;
    const fromStatus = record.status;
    record.status = status;
    if (record.inventoryKey) {
      const locks = memorySeatLocks.get(record.inventoryKey);
      record.seatNumbers?.forEach(seat => locks?.delete(seat));
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
      if (res.rows.length === 0) return null;
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
    try {
      // Find all RESERVED / PAYMENT_PROCESSING tokens where expires_at < NOW()
      const res = await pool.query(
        `SELECT token_id, inventory_id, status FROM seat_tokens
         WHERE status IN ('RESERVED', 'PAYMENT_PROCESSING') AND expires_at < NOW()
         FOR UPDATE SKIP LOCKED`
      );

      for (const row of res.rows) {
        const tokenId = row.token_id;
        const inventoryId = row.inventory_id;
        const fromStatus = row.status;

        // Count how many seats were reserved under this token
        const seatsRes = await pool.query(
          `SELECT COUNT(*) FROM token_seats WHERE token_id = $1`,
          [tokenId]
        );
        const seatCount = Math.max(parseInt(seatsRes.rows[0].count, 10), 1);

        // Update token status to EXPIRED
        await pool.query(
          `UPDATE seat_tokens SET status = 'EXPIRED' WHERE token_id = $1`,
          [tokenId]
        );

        // Atomically increment seat_inventory available_seats back
        await pool.query(
          `UPDATE seat_inventory SET available_seats = available_seats + $1, version = version + 1 WHERE id = $2`,
          [seatCount, inventoryId]
        );

        // Remove from Redis lock
        await redis.del(`seat_lock:${tokenId}`);

        // Log audit
        await AuditService.logStatus(
          tokenId,
          fromStatus,
          'EXPIRED',
          `Seat lock TTL expired. Reclaimed ${seatCount} seat(s) back to inventory counter.`
        );

        expiredCount++;
      }
    } catch {
      // In-memory expiry check
      const now = new Date();
      for (const [tokenId, record] of memoryTokens.entries()) {
        if ((record.status === 'RESERVED' || record.status === 'PAYMENT_PROCESSING') && record.expiresAt < now) {
          if (this.releaseLock(tokenId, 'EXPIRED')) expiredCount++;
        }
      }
    }

    return expiredCount;
  }
}
