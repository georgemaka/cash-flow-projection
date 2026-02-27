"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

type ErrorPageProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <main className="cf-error-shell">
      <section className="cf-error-card" role="alert">
        <p className="cf-error-eyebrow">500</p>
        <h1 className="cf-error-title">Something went wrong</h1>
        <p className="cf-error-copy">
          We could not complete this request. Retry the action or refresh the page.
        </p>
        <div className="cf-error-actions">
          <button className="cf-error-button" onClick={reset} type="button">
            Retry
          </button>
        </div>
      </section>
    </main>
  );
}
