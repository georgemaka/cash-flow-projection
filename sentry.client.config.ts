import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ?? "development",

  // Capture 100% of transactions in dev, lower in prod via env var.
  tracesSampleRate: Number(process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE ?? 0.1),

  // Replay is disabled by default; enable via env var if desired.
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0,

  // Only initialise when a DSN is present.
  enabled: Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN)
});
