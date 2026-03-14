import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextFetchEvent, NextRequest, NextResponse } from "next/server";
import { isDevAuthBypassEnabled } from "./lib/auth/dev-bypass";
import { apiRateLimiter, getClientIp } from "./lib/security/rate-limiter";

const isPublicRoute = createRouteMatcher(["/sign-in(.*)", "/sign-up(.*)"]);

const clerkAuthMiddleware = clerkMiddleware(async (auth, request) => {
  if (!isPublicRoute(request)) {
    await auth.protect();
  }
});

function setRateLimitHeaders(response: NextResponse, remaining: number, resetAt: number): void {
  response.headers.set("X-RateLimit-Limit", "60");
  response.headers.set("X-RateLimit-Remaining", String(remaining));
  response.headers.set("X-RateLimit-Reset", String(Math.floor(resetAt / 1000)));
}

export default function middleware(request: NextRequest, event: NextFetchEvent) {
  const isApiRoute = request.nextUrl.pathname.startsWith("/api/");
  const rateLimit = isApiRoute ? apiRateLimiter.check(getClientIp(request.headers)) : null;

  if (rateLimit && !rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many requests" },
      {
        status: 429,
        headers: {
          "Retry-After": String(rateLimit.retryAfterSeconds),
          "X-RateLimit-Limit": String(rateLimit.limit),
          "X-RateLimit-Remaining": String(rateLimit.remaining),
          "X-RateLimit-Reset": String(Math.floor(rateLimit.resetAt / 1000))
        }
      }
    );
  }

  if (isDevAuthBypassEnabled()) {
    const response = NextResponse.next();
    if (rateLimit) {
      setRateLimitHeaders(response, rateLimit.remaining, rateLimit.resetAt);
    }
    return response;
  }

  const response = clerkAuthMiddleware(request, event);
  if (
    rateLimit &&
    typeof response === "object" &&
    response !== null &&
    "headers" in response &&
    response.headers instanceof Headers
  ) {
    setRateLimitHeaders(response as NextResponse, rateLimit.remaining, rateLimit.resetAt);
  }

  return response;
}

export const config = {
  matcher: [
    // Skip Next.js internals and static files
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)"
  ]
};
