"use client";

import * as Sentry from "@sentry/nextjs";
import Link from "next/link";
import { useEffect } from "react";

type GlobalErrorPageProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function GlobalErrorPage({ error, reset }: GlobalErrorPageProps) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <main className="cf-error-shell">
          <section className="cf-error-card" role="alert">
            <p className="cf-error-eyebrow">Critical error</p>
            <h1 className="cf-error-title">Application failed to load</h1>
            <p className="cf-error-copy">
              We captured this error. Retry loading the app, or go back to the dashboard.
            </p>
            <div className="cf-error-actions">
              <button className="cf-error-button" onClick={reset} type="button">
                Retry
              </button>
              <Link className="cf-error-link" href="/">
                Go home
              </Link>
            </div>
          </section>
        </main>
      </body>
    </html>
  );
}
