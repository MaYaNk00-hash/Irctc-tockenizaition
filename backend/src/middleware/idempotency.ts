import { Request, Response, NextFunction } from 'express';
import { redis } from '../db';

const memoryIdempotencyStore: Map<string, { status: number; body: any }> = new Map();
const inFlight: Map<string, Promise<{ status: number; body: any }>> = new Map();

export async function idempotencyMiddleware(req: Request, res: Response, next: NextFunction) {
  const key = req.header('Idempotency-Key');

  // If no idempotency key provided, proceed normally
  if (!key) {
    return next();
  }

  const cacheKey = `idempotency:${key}`;

  const pending = inFlight.get(key);
  if (pending) {
    const result = await pending;
    return res.status(result.status).json(result.body);
  }

  try {
    const cached = await redis.get(cacheKey);
    if (cached) {
      const parsed = JSON.parse(cached);
      return res.status(parsed.status).json(parsed.body);
    }
  } catch {
    const cached = memoryIdempotencyStore.get(key);
    if (cached) {
      return res.status(cached.status).json(cached.body);
    }
  }

  let resolveInFlight!: (value: { status: number; body: any }) => void;
  inFlight.set(key, new Promise(resolve => { resolveInFlight = resolve; }));

  // Intercept res.json to cache response before returning to client
  const originalJson = res.json.bind(res);
  res.json = (body: any) => {
    memoryIdempotencyStore.set(key, { status: res.statusCode, body });
    resolveInFlight({ status: res.statusCode, body });
    inFlight.delete(key);
    if (redis.status === 'ready') {
      redis.setex(cacheKey, 3600, JSON.stringify({ status: res.statusCode, body })).catch(() => {
        // Fallback already saved in memoryIdempotencyStore
      });
    }
    return originalJson(body);
  };

  next();
}
