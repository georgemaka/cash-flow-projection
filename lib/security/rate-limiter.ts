type RateLimitResult = {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
  retryAfterSeconds: number;
};

type InMemoryRateLimiter = {
  check: (key: string, now?: number) => RateLimitResult;
};

type RateLimiterOptions = {
  limit: number;
  windowMs: number;
};

type Bucket = {
  count: number;
  resetAt: number;
};

function createResult(allowed: boolean, bucket: Bucket, limit: number, now: number): RateLimitResult {
  return {
    allowed,
    limit,
    remaining: Math.max(0, limit - bucket.count),
    resetAt: bucket.resetAt,
    retryAfterSeconds: Math.max(0, Math.ceil((bucket.resetAt - now) / 1000))
  };
}

export function createInMemoryRateLimiter(options: RateLimiterOptions): InMemoryRateLimiter {
  const { limit, windowMs } = options;
  const buckets = new Map<string, Bucket>();

  return {
    check(key: string, now = Date.now()): RateLimitResult {
      const current = buckets.get(key);

      if (!current || now >= current.resetAt) {
        const next: Bucket = { count: 1, resetAt: now + windowMs };
        buckets.set(key, next);
        return createResult(true, next, limit, now);
      }

      if (current.count >= limit) {
        return createResult(false, current, limit, now);
      }

      current.count += 1;
      return createResult(true, current, limit, now);
    }
  };
}

export function getClientIp(headers: Headers): string {
  const forwardedFor = headers.get("x-forwarded-for");
  if (forwardedFor) {
    const first = forwardedFor.split(",")[0]?.trim();
    if (first) return first;
  }

  const realIp = headers.get("x-real-ip");
  if (realIp) return realIp;

  return "unknown";
}

export const apiRateLimiter = createInMemoryRateLimiter({
  limit: 60,
  windowMs: 60_000
});
