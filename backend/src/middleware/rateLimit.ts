import { NextFunction, Request, Response } from 'express';
import { redis } from '../db';

const localBuckets = new Map<string, { count: number; expiresAt: number }>();

function allowLocalRequest(key: string, limit: number, windowSeconds: number) {
  const now = Date.now();
  const current = localBuckets.get(key);
  if (!current || current.expiresAt <= now) {
    localBuckets.set(key, { count: 1, expiresAt: now + windowSeconds * 1000 });
    if (localBuckets.size > 10000) {
      for (const [bucketKey, bucket] of localBuckets) {
        if (bucket.expiresAt <= now) localBuckets.delete(bucketKey);
      }
    }
    return true;
  }
  if (current.count >= limit) return false;
  current.count += 1;
  return true;
}

export function distributedRateLimit(prefix: string, limit: number, windowSeconds: number) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
    const bucket = Math.floor(Date.now() / (windowSeconds * 1000));
    const key = `rate-limit:${prefix}:${clientIp}:${bucket}`;

    try {
      if (redis.status !== 'ready') throw new Error('Redis is unavailable');
      const count = await redis.incr(key);
      if (count === 1) await redis.expire(key, windowSeconds + 1);
      if (count > limit) {
        res.setHeader('Retry-After', String(windowSeconds));
        return res.status(429).json({ success: false, error: 'Too many requests. Please try again later.' });
      }
      return next();
    } catch {
      if (process.env.NODE_ENV !== 'production') {
        if (!allowLocalRequest(key, limit, windowSeconds)) {
          res.setHeader('Retry-After', String(windowSeconds));
          return res.status(429).json({ success: false, error: 'Too many requests. Please try again later.' });
        }
        return next();
      }
      return res.status(503).json({ success: false, error: 'Request protection is temporarily unavailable. Please retry shortly.' });
    }
  };
}
