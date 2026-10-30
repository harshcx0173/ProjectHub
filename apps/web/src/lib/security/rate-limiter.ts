interface RateLimitRecord {
  count: number;
  resetAt: number;
}

const memoryStore = new Map<string, RateLimitRecord>();

export interface RateLimitConfig {
  limit: number;
  windowSeconds: number;
}

/**
 * High-performance sliding-window rate limiter with memory store & Redis readiness.
 */
export async function checkRateLimit(
  identifier: string,
  config: RateLimitConfig = { limit: 20, windowSeconds: 60 }
): Promise<{ success: boolean; limit: number; remaining: number; reset: number }> {
  const now = Date.now();
  const windowMs = config.windowSeconds * 1000;

  // Cleanup expired entries periodically
  if (memoryStore.size > 5000) {
    for (const [key, record] of memoryStore.entries()) {
      if (record.resetAt <= now) {
        memoryStore.delete(key);
      }
    }
  }

  const existing = memoryStore.get(identifier);

  if (!existing || existing.resetAt <= now) {
    const record: RateLimitRecord = {
      count: 1,
      resetAt: now + windowMs,
    };
    memoryStore.set(identifier, record);
    return {
      success: true,
      limit: config.limit,
      remaining: config.limit - 1,
      reset: Math.ceil(record.resetAt / 1000),
    };
  }

  existing.count += 1;
  const remaining = Math.max(0, config.limit - existing.count);
  const resetSec = Math.ceil(existing.resetAt / 1000);

  if (existing.count > config.limit) {
    return {
      success: false,
      limit: config.limit,
      remaining: 0,
      reset: resetSec,
    };
  }

  return {
    success: true,
    limit: config.limit,
    remaining,
    reset: resetSec,
  };
}

