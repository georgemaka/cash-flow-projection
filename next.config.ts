import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  reactStrictMode: true
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
