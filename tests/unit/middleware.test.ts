import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  isDevAuthBypassEnabled: vi.fn(),
  next: vi.fn(() => ({ type: "next-response" })),
  createRouteMatcher: vi.fn(),
  routeMatcher: vi.fn(),
  clerkRunner: vi.fn(() => ({ type: "clerk-response" })),
  protect: vi.fn(),
  getClientIp: vi.fn(() => "127.0.0.1"),
  rateCheck: vi.fn(() => ({
    allowed: true,
    limit: 60,
    remaining: 59,
    resetAt: Date.now() + 60_000,
    retryAfterSeconds: 60
  })),
  capturedHandler: null as null | ((auth: { protect: () => Promise<void> }, req: unknown) => Promise<void>)
}));

vi.mock("@/lib/auth/dev-bypass", () => ({
  isDevAuthBypassEnabled: mocks.isDevAuthBypassEnabled
}));

vi.mock("@/lib/security/rate-limiter", () => ({
  apiRateLimiter: {
    check: mocks.rateCheck
  },
  getClientIp: mocks.getClientIp
}));

vi.mock("next/server", () => ({
  NextResponse: {
    next: mocks.next,
    json: vi.fn((body, init) => ({ type: "json-response", body, init }))
  }
}));

vi.mock("@clerk/nextjs/server", () => ({
  createRouteMatcher: mocks.createRouteMatcher,
  clerkMiddleware: (handler: (auth: { protect: () => Promise<void> }, req: unknown) => Promise<void>) => {
    mocks.capturedHandler = handler;
    return mocks.clerkRunner;
  }
}));

async function loadMiddleware() {
  const mod = await import("@/middleware");
  return mod.default;
}

describe("middleware", () => {
  const req = { nextUrl: { pathname: "/dashboard" } } as unknown;
  const apiReq = { nextUrl: { pathname: "/api/values" }, headers: new Headers() } as unknown;
  const event = {} as never;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    mocks.capturedHandler = null;
    mocks.isDevAuthBypassEnabled.mockReturnValue(false);
    mocks.routeMatcher.mockReturnValue(false);
    mocks.createRouteMatcher.mockReturnValue(mocks.routeMatcher);
    mocks.rateCheck.mockReturnValue({
      allowed: true,
      limit: 60,
      remaining: 59,
      resetAt: Date.now() + 60_000,
      retryAfterSeconds: 60
    });
  });

  it("initializes route matcher with public auth routes", async () => {
    await loadMiddleware();
    expect(mocks.createRouteMatcher).toHaveBeenCalledWith(["/sign-in(.*)", "/sign-up(.*)"]);
  });

  it("returns NextResponse.next() when dev auth bypass is enabled", async () => {
    const middleware = await loadMiddleware();
    mocks.isDevAuthBypassEnabled.mockReturnValue(true);

    const response = middleware(req as never, event);

    expect(mocks.next).toHaveBeenCalledTimes(1);
    expect(mocks.clerkRunner).not.toHaveBeenCalled();
    expect(response).toEqual({ type: "next-response" });
  });

  it("delegates to Clerk middleware when bypass is disabled", async () => {
    const middleware = await loadMiddleware();
    const response = middleware(req as never, event);

    expect(mocks.clerkRunner).toHaveBeenCalledWith(req, event);
    expect(mocks.next).not.toHaveBeenCalled();
    expect(response).toEqual({ type: "clerk-response" });
  });

  it("returns 429 json response when API rate limit is exceeded", async () => {
    const middleware = await loadMiddleware();
    mocks.rateCheck.mockReturnValueOnce({
      allowed: false,
      limit: 60,
      remaining: 0,
      resetAt: Date.now() + 60_000,
      retryAfterSeconds: 60
    });

    const response = middleware(apiReq as never, event);
    expect(response).toEqual({
      type: "json-response",
      body: { error: "Too many requests" },
      init: expect.objectContaining({ status: 429 })
    });
    expect(mocks.clerkRunner).not.toHaveBeenCalled();
  });

  it("protects non-public routes in the Clerk auth handler", async () => {
    await loadMiddleware();

    expect(mocks.capturedHandler).toBeTypeOf("function");
    await mocks.capturedHandler!({ protect: mocks.protect }, req);

    expect(mocks.routeMatcher).toHaveBeenCalledWith(req);
    expect(mocks.protect).toHaveBeenCalledTimes(1);
  });

  it("does not call protect() for public routes", async () => {
    await loadMiddleware();
    mocks.routeMatcher.mockReturnValueOnce(true);

    await mocks.capturedHandler!({ protect: mocks.protect }, { nextUrl: { pathname: "/sign-in" } });

    expect(mocks.protect).not.toHaveBeenCalled();
  });
});
