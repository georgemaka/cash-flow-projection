"use client";

import { SnapshotList } from "@/components/SnapshotList";

export default function HomePage() {
  return (
    <main className="dashboard-shell">
      <div className="dashboard-header">
        <p className="eyebrow">Sukut Properties</p>
        <h1>Cash Flow Projection</h1>
        <p className="subhead">
          Select a snapshot to view or edit monthly cash flow projections and actuals.
        </p>
      </div>

      <section className="snapshot-section">
        <div className="panel-head">
          <h2>Snapshots</h2>
        </div>
        <SnapshotList />
      </section>
    </main>
  );
}
