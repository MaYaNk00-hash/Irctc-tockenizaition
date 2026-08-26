import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { pool, redis } from '../db';
import { BotDetectionService, BehavioralSignals } from './botDetection';

const JWT_SECRET = process.env.JWT_SECRET || 'tatkal_secret_key_2026';

export interface JoinRequest {
  userId: number;
  trainId: string;
  seatClass: string;
  travelDate: string;
  sessionId: string;
  fingerprint: string;
  signals?: BehavioralSignals;
  powNonce?: string;
  captchaAnswer?: number;
}

export interface WaitingRoomStatus {
  ticketId: string;
  status: 'QUEUED' | 'ADMITTED' | 'EXPIRED';
  position: number;
  totalInQueue: number;
  batchNumber?: number;
  admissionToken?: string;
  estimatedWaitSeconds: number;
}

// In-memory waiting room state fallback if Redis is unavailable
interface InMemTicket {
  ticketId: string;
  userId: number;
  trainKey: string;
  joinedAt: number;
  softBlocked: boolean;
  status: 'QUEUED' | 'ADMITTED' | 'EXPIRED';
  admissionToken?: string;
  batchNumber?: number;
}

const memoryPool: Map<string, InMemTicket[]> = new Map();
const memorySecondaryFifo: Map<string, InMemTicket[]> = new Map();
const memoryAdmittedTokens: Map<string, { userId: number; trainKey: string; expiresAt: number }> = new Map();
let isWindowFrozen = false;
let batchCounter = 0;

// Configuration settings (can be updated dynamically from admin dashboard)
export let waitingRoomConfig = {
  batchSize: 10,
  batchIntervalMs: 3000,
  admissionTtlSeconds: 90,
  windowOpened: true, // true by default for demo
};

export class WaitingRoomService {
  public static getTrainKey(trainId: string, seatClass: string, travelDate: string): string {
    return `${trainId}:${seatClass}:${travelDate}`;
  }

  /**
   * Join Waiting Room
   */
  public static async join(req: JoinRequest, userIp: string): Promise<{
    ticketId: string;
    jwtTicket: string;
    riskScore: number;
    friction: string;
    powChallenge?: any;
    captchaChallenge?: any;
  }> {
    // 1. Bot Detection Evaluation
    const risk = await BotDetectionService.evaluateSession(
      req.sessionId,
      userIp,
      req.userId,
      req.fingerprint,
      req.signals
    );

    // If friction is required, check if client provided solution
    if (risk.friction === 'MEDIUM_POW' && !req.powNonce) {
      return {
        ticketId: '',
        jwtTicket: '',
        riskScore: risk.score,
        friction: risk.friction,
        powChallenge: risk.powChallenge
      };
    }

    if (risk.friction === 'HIGH_CAPTCHA' && req.captchaAnswer === undefined) {
      return {
        ticketId: '',
        jwtTicket: '',
        riskScore: risk.score,
        friction: risk.friction,
        captchaChallenge: risk.captchaChallenge
      };
    }

    const trainKey = this.getTrainKey(req.trainId, req.seatClass, req.travelDate);
    const ticketId = crypto.randomUUID();
    const joinedAt = Date.now();
    const isSoftBlocked = risk.friction === 'VERY_HIGH_SOFT_BLOCK';

    // Issue short-lived JWT ticket
    const jwtTicket = jwt.sign(
      { ticketId, userId: req.userId, trainKey, joinedAt, softBlocked: isSoftBlocked },
      JWT_SECRET,
      { expiresIn: '15m' }
    );

    // Add to Redis sorted set or in-memory fallback
    const redisKey = `waiting_room:${trainKey}`;
    try {
      if (isWindowFrozen) {
        // Late arrivals go to secondary FIFO queue
        await redis.rpush(`waiting_room_secondary:${trainKey}`, JSON.stringify({ ticketId, userId: req.userId, joinedAt, softBlocked: isSoftBlocked }));
      } else {
        // Primary pool sorted set scored by arrival timestamp (softblocked pushed +10,000,000 ms into future)
        const score = isSoftBlocked ? joinedAt + 10000000 : joinedAt;
        await redis.zadd(redisKey, score, ticketId);
        await redis.hset(`ticket_meta:${ticketId}`, {
          userId: req.userId,
          trainKey,
          joinedAt,
          status: 'QUEUED'
        });
      }

      // Persist in DB for audit
      await pool.query(
        `INSERT INTO waiting_room_tickets (ticket_id, user_id, train_id, seat_class, travel_date, joined_at, status)
         VALUES ($1, $2, $3, $4, $5, to_timestamp($6 / 1000.0), 'QUEUED')`,
        [ticketId, req.userId, req.trainId, req.seatClass, req.travelDate, joinedAt]
      );
    } catch {
      // In-memory fallback
      if (!memoryPool.has(trainKey)) memoryPool.set(trainKey, []);
      if (!memorySecondaryFifo.has(trainKey)) memorySecondaryFifo.set(trainKey, []);

      const ticketObj: InMemTicket = {
        ticketId,
        userId: req.userId,
        trainKey,
        joinedAt,
        softBlocked: isSoftBlocked,
        status: 'QUEUED'
      };

      if (isWindowFrozen) {
        memorySecondaryFifo.get(trainKey)!.push(ticketObj);
      } else {
        memoryPool.get(trainKey)!.push(ticketObj);
      }
    }

    return {
      ticketId,
      jwtTicket,
      riskScore: risk.score,
      friction: risk.friction
    };
  }

  /**
   * Get Live Queue Status
   */
  public static async getStatus(ticketId: string, trainKey: string): Promise<WaitingRoomStatus> {
    try {
      const meta = await redis.hgetall(`ticket_meta:${ticketId}`);
      if (meta && meta.status === 'ADMITTED') {
        return {
          ticketId,
          status: 'ADMITTED',
          position: 0,
          totalInQueue: 0,
          batchNumber: parseInt(meta.batchNumber || '1', 10),
          admissionToken: meta.admissionToken,
          estimatedWaitSeconds: 0
        };
      }

      const redisKey = `waiting_room:${trainKey}`;
      const rank = await redis.zrank(redisKey, ticketId);
      const total = await redis.zcard(redisKey);

      if (rank !== null && rank >= 0) {
        const estBatches = Math.ceil((rank + 1) / waitingRoomConfig.batchSize);
        const estWaitSec = Math.ceil((estBatches * waitingRoomConfig.batchIntervalMs) / 1000);
        return {
          ticketId,
          status: 'QUEUED',
          position: rank + 1,
          totalInQueue: total,
          estimatedWaitSeconds: estWaitSec
        };
      }
    } catch {
      // In-memory check
      const poolList = memoryPool.get(trainKey) || [];
      const idx = poolList.findIndex(t => t.ticketId === ticketId);
      if (idx >= 0) {
        const item = poolList[idx];
        if (item.status === 'ADMITTED') {
          return {
            ticketId,
            status: 'ADMITTED',
            position: 0,
            totalInQueue: poolList.length,
            batchNumber: item.batchNumber,
            admissionToken: item.admissionToken,
            estimatedWaitSeconds: 0
          };
        }
        return {
          ticketId,
          status: 'QUEUED',
          position: idx + 1,
          totalInQueue: poolList.length,
          estimatedWaitSeconds: Math.ceil(((idx + 1) / waitingRoomConfig.batchSize) * 3)
        };
      }
    }

    return {
      ticketId,
      status: 'QUEUED',
      position: 1,
      totalInQueue: 1,
      estimatedWaitSeconds: 3
    };
  }

  /**
   * Freeze & Batch Release Engine (Seeded Fisher-Yates Shuffle)
   */
  public static async processNextBatch(trainKey: string): Promise<number> {
    batchCounter++;
    const currentBatch = batchCounter;
    let admittedCount = 0;

    try {
      const redisKey = `waiting_room:${trainKey}`;
      // Fetch up to batchSize tickets from sorted set
      const tickets = await redis.zrange(redisKey, 0, waitingRoomConfig.batchSize - 1);
      if (tickets.length === 0) {
        // Process secondary queue if primary is empty
        const secondary = await redis.lpop(`waiting_room_secondary:${trainKey}`, waitingRoomConfig.batchSize);
        if (secondary && secondary.length > 0) {
          for (const itemStr of secondary) {
            const item = JSON.parse(itemStr);
            await this.admitUser(item.ticketId, item.userId, trainKey, currentBatch);
            admittedCount++;
          }
        }
        return admittedCount;
      }

      // Seeded Fisher-Yates shuffle on current batch pool
      const shuffled = [...tickets];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }

      for (const ticketId of shuffled) {
        const meta = await redis.hgetall(`ticket_meta:${ticketId}`);
        const userId = parseInt(meta.userId || '1', 10);
        await this.admitUser(ticketId, userId, trainKey, currentBatch);
        await redis.zrem(redisKey, ticketId);
        admittedCount++;
      }
    } catch {
      // In-memory fallback shuffle & batch release
      const poolList = memoryPool.get(trainKey) || [];
      const batchItems = poolList.splice(0, waitingRoomConfig.batchSize);

      for (const item of batchItems) {
        item.status = 'ADMITTED';
        item.batchNumber = currentBatch;
        item.admissionToken = crypto.randomUUID();
        memoryAdmittedTokens.set(item.admissionToken, {
          userId: item.userId,
          trainKey,
          expiresAt: Date.now() + waitingRoomConfig.admissionTtlSeconds * 1000
        });
        admittedCount++;
      }
    }

    return admittedCount;
  }

  private static async admitUser(ticketId: string, userId: number, trainKey: string, batchNumber: number) {
    const admissionToken = crypto.randomUUID();
    const expiresAt = Date.now() + waitingRoomConfig.admissionTtlSeconds * 1000;

    try {
      await redis.hset(`ticket_meta:${ticketId}`, {
        status: 'ADMITTED',
        batchNumber,
        admissionToken
      });
      await redis.setex(`admission_token:${admissionToken}`, waitingRoomConfig.admissionTtlSeconds, JSON.stringify({ userId, trainKey }));
      await pool.query(
        `UPDATE waiting_room_tickets SET status = 'ADMITTED', batch_number = $1 WHERE ticket_id = $2`,
        [batchNumber, ticketId]
      );
    } catch {
      memoryAdmittedTokens.set(admissionToken, { userId, trainKey, expiresAt });
    }
  }

  public static async validateAdmissionToken(admissionToken: string): Promise<boolean> {
    if (redis.status === 'ready') {
      try {
        const exists = await redis.exists(`admission_token:${admissionToken}`);
        if (exists) return true;
      } catch {
        // Fallback below
      }
    }
    const item = memoryAdmittedTokens.get(admissionToken);
    if (item && item.expiresAt > Date.now()) return true;
    return false;
  }
}
