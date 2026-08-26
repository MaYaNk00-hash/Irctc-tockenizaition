import crypto from 'crypto';
import { pool, redis } from '../db';
import { SeatLockService } from './seatLock';
import { AuditService } from './auditService';

export interface BookingJob {
  jobId: string;
  userId: number;
  trainId: string;
  seatClass: string;
  travelDate: string;
  passengerNames: string[];
  admissionToken: string;
  timestamp: number;
}

export interface JobResult {
  jobId: string;
  status: 'RESERVED' | 'SEATS_EXHAUSTED' | 'FAILED';
  tokenId?: string;
  expiresAt?: string;
  reason?: string;
}

const PARTITION_COUNT = 4; // 4 stream partitions for parallel processing across trains

// In-memory queue fallback for demo mode when Redis Streams is offline
const memoryStreams: Map<number, BookingJob[]> = new Map();
for (let i = 0; i < PARTITION_COUNT; i++) {
  memoryStreams.set(i, []);
}

export class PartitionedSchedulerService {
  /**
   * Deterministic Hash to assign train:class:date to a partition (0 to PARTITION_COUNT - 1)
   */
  public static getPartition(trainId: string, seatClass: string, travelDate: string): number {
    const key = `${trainId}:${seatClass}:${travelDate}`;
    let hash = 0;
    for (let i = 0; i < key.length; i++) {
      hash = (hash << 5) - hash + key.charCodeAt(i);
      hash |= 0; // Convert to 32bit integer
    }
    return Math.abs(hash) % PARTITION_COUNT;
  }

  /**
   * Enqueue booking job into partition stream
   */
  public static async pushJob(job: BookingJob): Promise<JobResult> {
    const partition = this.getPartition(job.trainId, job.seatClass, job.travelDate);
    const streamKey = `stream:booking:p${partition}`;

    try {
      // Add to Redis Stream
      await redis.xadd(
        streamKey,
        '*',
        'jobId', job.jobId,
        'userId', job.userId.toString(),
        'trainId', job.trainId,
        'seatClass', job.seatClass,
        'travelDate', job.travelDate,
        'passengers', JSON.stringify(job.passengerNames),
        'admissionToken', job.admissionToken
      );

      // Directly process sequentially per partition
      return await this.processJob(job);
    } catch {
      // In-memory stream fallback
      const list = memoryStreams.get(partition)!;
      list.push(job);
      return await this.processJob(job);
    }
  }

  /**
   * Process job strictly sequentially within partition:
   * 1. Postgres SELECT ... FOR UPDATE on seat_inventory row
   * 2. Decrement available_seats if seats >= requested
   * 3. Issue seat_token (RESERVED, 5-min TTL)
   * 4. Hand off to Seat Lock Service or Reject SEATS_EXHAUSTED
   */
  public static async processJob(job: BookingJob): Promise<JobResult> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 1. SELECT FOR UPDATE on inventory row
      const invRes = await client.query(
        `SELECT id, available_seats, total_seats FROM seat_inventory
         WHERE train_id = $1 AND seat_class = $2 AND travel_date = $3
         FOR UPDATE`,
        [job.trainId, job.seatClass, job.travelDate]
      );

      if (invRes.rows.length === 0) {
        await client.query('ROLLBACK');
        return {
          jobId: job.jobId,
          status: 'FAILED',
          reason: `No seat inventory found for train ${job.trainId} ${job.seatClass} on ${job.travelDate}`
        };
      }

      const invRow = invRes.rows[0];
      const requestedSeats = Math.max(job.passengerNames.length, 1);

      if (invRow.available_seats < requestedSeats) {
        await client.query('ROLLBACK');
        return {
          jobId: job.jobId,
          status: 'SEATS_EXHAUSTED',
          reason: `Requested ${requestedSeats} seats, but only ${invRow.available_seats} available`
        };
      }

      // 2. Decrement available seats atomically in Postgres
      const newAvailable = invRow.available_seats - requestedSeats;
      await client.query(
        `UPDATE seat_inventory SET available_seats = $1, version = version + 1 WHERE id = $2`,
        [newAvailable, invRow.id]
      );

      // 3. Create Seat Lock & Token
      const tokenId = crypto.randomUUID();
      const ttlMinutes = 5;
      const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);

      await client.query(
        `INSERT INTO seat_tokens (token_id, user_id, inventory_id, status, expires_at)
         VALUES ($1, $2, $3, 'RESERVED', $4)`,
        [tokenId, job.userId, invRow.id, expiresAt]
      );

      // Insert allocated seats into token_seats
      for (let i = 0; i < job.passengerNames.length; i++) {
        const coach = job.seatClass === '1A' ? 'H1' : job.seatClass === '2A' ? 'A1' : job.seatClass === '3A' ? 'B2' : 'S4';
        const seatNum = `${coach}-${Math.floor(Math.random() * 60) + 1}`;
        await client.query(
          `INSERT INTO token_seats (token_id, passenger_name, seat_number)
           VALUES ($1, $2, $3)`,
          [tokenId, job.passengerNames[i], seatNum]
        );
      }

      await client.query('COMMIT');

      // 4. Register fast Redis lock & log audit
      await SeatLockService.registerLock(tokenId, job.userId, invRow.id, expiresAt);
      await AuditService.logStatus(tokenId, 'ADMITTED', 'RESERVED', `Seats locked successfully for ${requestedSeats} passenger(s)`);

      return {
        jobId: job.jobId,
        status: 'RESERVED',
        tokenId,
        expiresAt: expiresAt.toISOString()
      };

    } catch (err: any) {
      await client.query('ROLLBACK');
      console.error('[Scheduler] Error processing booking job:', err.message);

      // Fallback in-memory inventory decrement for demo mode if DB is unavailable
      return SeatLockService.fallbackReserveSeat(job);
    } finally {
      client.release();
    }
  }
}
