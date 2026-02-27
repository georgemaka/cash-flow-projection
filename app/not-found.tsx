import Link from "next/link";

export default function NotFoundPage() {
  return (
    <main className="cf-error-shell">
      <section className="cf-error-card">
        <p className="cf-error-eyebrow">404</p>
        <h1 className="cf-error-title">Page not found</h1>
        <p className="cf-error-copy">
          The page you requested does not exist or may have moved.
        </p>
        <div className="cf-error-actions">
          <Link className="cf-error-link cf-error-link-primary" href="/">
            Go home
          </Link>
        </div>
      </section>
    </main>
  );
}
