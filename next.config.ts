import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async headers() {
    const csp = [
      "default-src 'self'",
      "base-uri 'self'",
      "frame-ancestors 'none'",
      "object-src 'none'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.clerk.com https://*.clerk.accounts.dev https://browser.sentry-cdn.com",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      "connect-src 'self' https://*.clerk.com https://*.clerk.accounts.dev https://*.sentry.io",
      "frame-src https://*.clerk.com https://*.clerk.accounts.dev",
      "worker-src 'self' blob:"
    ].join("; ");

    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" }
        ]
      }
    ];
  }
};

export default withSentryConfig(nextConfig, {
  // Suppress Sentry CLI output during build (keeps CI logs clean).
  silent: !process.env.CI,

  // Upload source maps to Sentry on every build when the auth token is present.
  // Set SENTRY_AUTH_TOKEN in Vercel environment variables.
  authToken: process.env.SENTRY_AUTH_TOKEN,

  // Disable source map upload when no auth token is configured (e.g. local dev).
  sourcemaps: {
    disable: !process.env.SENTRY_AUTH_TOKEN
  },

  // Automatically tree-shake Sentry logger statements in production.
  disableLogger: true
});
