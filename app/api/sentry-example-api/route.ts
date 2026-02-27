import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";

/**
 * GET /api/sentry-example-api
 *
 * Health-check route that confirms Sentry ingestion is working.
 * Sends a test event and returns a 200 with the event ID.
 *
 * Usage: curl https://cashflow.sukutproperties.com/api/sentry-example-api
 */
export async function GET() {
  const eventId = Sentry.captureMessage("Sentry health-check ping", "info");
  return NextResponse.json({ ok: true, sentryEventId: eventId });
}
