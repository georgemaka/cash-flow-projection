"use client";

import * as Sentry from "@sentry/nextjs";
import Link from "next/link";
import type { ErrorInfo, ReactNode } from "react";
import { Component } from "react";

type AppErrorBoundaryProps = {
  children: ReactNode;
};

type AppErrorBoundaryState = {
  hasError: boolean;
};

export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = {
    hasError: false
  };

  static getDerivedStateFromError(): AppErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    Sentry.captureException(error, {
      extra: {
        componentStack: errorInfo.componentStack
      }
    });
  }

  private handleRetry = (): void => {
    this.setState({ hasError: false });
  };

  render(): ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <main className="cf-error-shell">
        <section className="cf-error-card" role="alert">
          <p className="cf-error-eyebrow">Unexpected error</p>
          <h1 className="cf-error-title">Something went wrong</h1>
          <p className="cf-error-copy">
            We hit a rendering error while loading this page. Try again, or return to the dashboard.
          </p>
          <div className="cf-error-actions">
            <button className="cf-error-button" onClick={this.handleRetry} type="button">
              Try again
            </button>
            <Link className="cf-error-link" href="/">
              Go home
            </Link>
          </div>
        </section>
      </main>
    );
  }
}
