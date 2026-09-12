/**
 * In-memory sliding window rate limiter for public API routes.
 * Tracks requests by client IP with automatic garbage collection of expired buckets.
 */

interface RateLimitRecord {
  timestamps: number[];
}

const cache = new Map<string, RateLimitRecord>();

// Periodically clean up stale entries (older than 10 minutes) to prevent memory leaks
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [key, record] of cache.entries()) {
      record.timestamps = record.timestamps.filter((ts) => now - ts < 600_000);
      if (record.timestamps.length === 0) {
        cache.delete(key);
      }
    }
  }, 300_000);
}

export interface RateLimitOptions {
  /** Maximum number of requests allowed within the window */
  limit: number;
  /** Window duration in seconds */
  windowSeconds: number;
}

export function checkRateLimit(
  identifier: string,
  options: RateLimitOptions
): { allowed: boolean; remaining: number; reset: number } {
  const now = Date.now();
  const windowMs = options.windowSeconds * 1000;
  const cutoff = now - windowMs;

  const record = cache.get(identifier) || { timestamps: [] };
  // Filter out timestamps outside the sliding window
  record.timestamps = record.timestamps.filter((ts) => ts > cutoff);

  if (record.timestamps.length >= options.limit) {
    const oldestTimestamp = record.timestamps[0] ?? now;
    const reset = Math.ceil((oldestTimestamp + windowMs - now) / 1000);
    return {
      allowed: false,
      remaining: 0,
      reset: Math.max(1, reset),
    };
  }

  record.timestamps.push(now);
  cache.set(identifier, record);

  return {
    allowed: true,
    remaining: options.limit - record.timestamps.length,
    reset: options.windowSeconds,
  };
}

export function getClientIp(headers: Headers): string {
  return (
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headers.get("x-real-ip") ||
    "unknown"
  );
}
