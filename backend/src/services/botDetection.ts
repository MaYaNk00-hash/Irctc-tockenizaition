import crypto from 'crypto';
import { pool, redis } from '../db';

export interface BehavioralSignals {
  timeToFirstInteractionMs: number; // e.g. < 100ms is suspicious
  keystrokeVarianceMs: number;       // e.g. < 5ms is automated bot typing
  mouseEntropy: number;              // 0.0 (straight line/none) to 1.0 (natural curve)
  navigatedFromSearch: boolean;      // direct link to join = higher risk
  screenResolution?: string;
  userAgent?: string;
  timezoneOffset?: number;
}

export interface RiskEvaluationResult {
  score: number;
  friction: 'NONE' | 'MEDIUM_POW' | 'HIGH_CAPTCHA' | 'VERY_HIGH_SOFT_BLOCK';
  powChallenge?: { challenge: string; targetZeros: number };
  captchaChallenge?: { id: string; question: string; answer: number };
  signals: Record<string, any>;
  rateLimited: boolean;
}

// In-memory fallback risk store for demo mode when DB is unavailable
const memoryRiskScores: Array<{
  id: number;
  session_id: string;
  device_fingerprint: string;
  score: number;
  signals: any;
  friction_applied: string;
  created_at: Date;
}> = [];

let memoryRiskId = 1;

// Hashcash verification helper
export function verifyProofOfWork(challenge: string, nonce: string, targetZeros: number = 3): boolean {
  const hash = crypto.createHash('sha256').update(challenge + nonce).digest('hex');
  return hash.startsWith('0'.repeat(targetZeros));
}

export class BotDetectionService {
  /**
   * Evaluate request context and return risk score + required friction level
   */
  public static async evaluateSession(
    sessionId: string,
    ip: string,
    userId: number,
    fingerprint: string,
    signals?: BehavioralSignals
  ): Promise<RiskEvaluationResult> {
    let score = 0;
    const signalDetails: Record<string, any> = {};

    // 1. Rate Limiting Check (sliding window count per fingerprint & IP)
    const ipCount = await this.incrementWindowCounter(`rate:ip:${ip}`, 10);
    const fpCount = await this.incrementWindowCounter(`rate:fp:${fingerprint}`, 10);

    let rateLimited = false;
    if (ipCount > 15 || fpCount > 5) {
      score += 40;
      signalDetails.rateLimitExceeded = true;
      signalDetails.ipRequestsIn10s = ipCount;
      signalDetails.fpRequestsIn10s = fpCount;
      rateLimited = true;
    } else {
      signalDetails.rateLimitExceeded = false;
    }

    // 2. Behavioral Signals Check
    if (!signals) {
      score += 30; // Missing behavioral telemetry
      signalDetails.missingSignals = true;
    } else {
      // Time to first interaction (< 150ms is almost certainly automated script)
      if (signals.timeToFirstInteractionMs < 150) {
        score += 25;
        signalDetails.instantInteraction = true;
      }

      // Keystroke variance (< 10ms variance = paste/bot fill)
      if (signals.keystrokeVarianceMs < 10) {
        score += 20;
        signalDetails.roboticTyping = true;
      }

      // Mouse entropy (0 entropy = straight line jump or bot click)
      if (signals.mouseEntropy < 0.15) {
        score += 20;
        signalDetails.lowMouseEntropy = true;
      }

      // Navigation path check
      if (!signals.navigatedFromSearch) {
        score += 15;
        signalDetails.directBookingJump = true;
      }
    }

    // 3. Fingerprint Quality Check
    if (!fingerprint || fingerprint === 'unknown' || fingerprint.length < 8) {
      score += 20;
      signalDetails.weakFingerprint = true;
    }

    // Cap score at 100
    score = Math.min(Math.max(score, 0), 100);

    // Determine Friction Level
    let friction: RiskEvaluationResult['friction'] = 'NONE';
    let powChallenge;
    let captchaChallenge;

    if (score >= 80) {
      friction = 'VERY_HIGH_SOFT_BLOCK';
    } else if (score >= 60) {
      friction = 'HIGH_CAPTCHA';
      const a = Math.floor(Math.random() * 20) + 5;
      const b = Math.floor(Math.random() * 20) + 5;
      captchaChallenge = {
        id: crypto.randomUUID(),
        question: `IRCTC Verification: What is ${a} + ${b}?`,
        answer: a + b
      };
    } else if (score >= 30) {
      friction = 'MEDIUM_POW';
      powChallenge = {
        challenge: crypto.randomBytes(12).toString('hex'),
        targetZeros: 3
      };
    }

    // Save risk record asynchronously
    await this.recordRiskScore(sessionId, fingerprint, score, signalDetails, friction);

    return {
      score,
      friction,
      powChallenge,
      captchaChallenge,
      signals: signalDetails,
      rateLimited
    };
  }

  private static async incrementWindowCounter(key: string, ttlSeconds: number): Promise<number> {
    if (redis.status !== 'ready') {
      return 1;
    }
    try {
      const count = await redis.incr(key);
      if (count === 1) {
        await redis.expire(key, ttlSeconds);
      }
      return count;
    } catch {
      // In-memory fallback if Redis is not running
      return 1;
    }
  }

  public static async recordRiskScore(
    sessionId: string,
    fingerprint: string,
    score: number,
    signals: any,
    friction: string
  ) {
    try {
      await pool.query(
        `INSERT INTO risk_scores (session_id, device_fingerprint, score, signals, friction_applied)
         VALUES ($1, $2, $3, $4, $5)`,
        [sessionId, fingerprint, score, JSON.stringify(signals), friction]
      );
    } catch {
      memoryRiskScores.unshift({
        id: memoryRiskId++,
        session_id: sessionId,
        device_fingerprint: fingerprint,
        score,
        signals,
        friction_applied: friction,
        created_at: new Date()
      });
      if (memoryRiskScores.length > 200) memoryRiskScores.pop();
    }
  }

  public static async getRecentRiskScores(limit: number = 50) {
    try {
      const res = await pool.query(
        `SELECT id, session_id, device_fingerprint, score, signals, friction_applied, created_at
         FROM risk_scores ORDER BY created_at DESC LIMIT $1`,
        [limit]
      );
      return res.rows;
    } catch {
      return memoryRiskScores.slice(0, limit);
    }
  }
}
