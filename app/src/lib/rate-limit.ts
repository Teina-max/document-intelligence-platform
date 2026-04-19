/**
 * Simple in-memory rate limiter for API routes.
 * Uses a sliding window per IP address.
 *
 * Usage:
 *   const limiter = createRateLimiter({ windowMs: 60_000, max: 10 });
 *   const { limited } = limiter.check(ip);
 *   if (limited) return NextResponse.json({ error: "Too many requests" }, { status: 429 });
 */

interface RateLimiterOptions {
  /** Window duration in ms */
  windowMs: number;
  /** Max requests per window */
  max: number;
}

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

export function createRateLimiter({ windowMs, max }: RateLimiterOptions) {
  const store = new Map<string, RateLimitEntry>();

  // Cleanup stale entries every 60s to prevent memory leak
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store) {
      if (entry.resetAt < now) store.delete(key);
    }
  }, 60_000).unref();

  return {
    check(ip: string): { limited: boolean; remaining: number } {
      const now = Date.now();
      const entry = store.get(ip);

      if (!entry || entry.resetAt < now) {
        store.set(ip, { count: 1, resetAt: now + windowMs });
        return { limited: false, remaining: max - 1 };
      }

      entry.count++;
      if (entry.count > max) {
        return { limited: true, remaining: 0 };
      }

      return { limited: false, remaining: max - entry.count };
    },
  };
}
