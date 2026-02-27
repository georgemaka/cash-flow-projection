import { describe, expect, it } from "vitest";
import { createInMemoryRateLimiter, getClientIp } from "@/lib/security/rate-limiter";

describe("createInMemoryRateLimiter", () => {
  it("allows requests up to the configured limit", () => {
    const limiter = createInMemoryRateLimiter({ limit: 3, windowMs: 60_000 });
    const now = Date.now();

    expect(limiter.check("ip-1", now).allowed).toBe(true);
    expect(limiter.check("ip-1", now + 1).allowed).toBe(true);
    expect(limiter.check("ip-1", now + 2).allowed).toBe(true);
  });

  it("blocks requests beyond the configured limit", () => {
    const limiter = createInMemoryRateLimiter({ limit: 2, windowMs: 60_000 });
    const now = Date.now();

    limiter.check("ip-1", now);
    limiter.check("ip-1", now + 1);

    const blocked = limiter.check("ip-1", now + 2);
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("resets the window after expiration", () => {
    const limiter = createInMemoryRateLimiter({ limit: 1, windowMs: 1000 });
    const now = Date.now();

    limiter.check("ip-1", now);
    const blocked = limiter.check("ip-1", now + 10);
    const allowedAfterWindow = limiter.check("ip-1", now + 1100);

    expect(blocked.allowed).toBe(false);
    expect(allowedAfterWindow.allowed).toBe(true);
  });
});

describe("getClientIp", () => {
  it("uses the first x-forwarded-for entry when present", () => {
    const headers = new Headers({
      "x-forwarded-for": "203.0.113.1, 10.0.0.1"
    });
    expect(getClientIp(headers)).toBe("203.0.113.1");
  });

  it("falls back to x-real-ip", () => {
    const headers = new Headers({
      "x-real-ip": "198.51.100.9"
    });
    expect(getClientIp(headers)).toBe("198.51.100.9");
  });

  it("returns unknown when no IP headers are present", () => {
    expect(getClientIp(new Headers())).toBe("unknown");
  });
});
