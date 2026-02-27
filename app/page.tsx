"use client";

import { useEffect, useState } from "react";
import { SnapshotList } from "@/components/SnapshotList";
import { Skeleton } from "@/components/ui/Skeleton";

interface SnapshotSummary {
  total: number;
  drafts: number;
  locked: number;
  latestName: string | null;
}

export default function HomePage() {
  const [stats, setStats] = useState<SnapshotSummary | null>(null);

  useEffect(() => {
    async function fetchStats() {
      try {
        const res = await fetch("/api/snapshots");
        if (!res.ok) return;
        const json = await res.json();
        const list = json.data ?? json;
        setStats({
          total: list.length,
          drafts: list.filter((s: { status: string }) => s.status === "draft").length,
          locked: list.filter((s: { status: string }) => s.status === "locked").length,
          latestName: list[0]?.name ?? null,
        });
      } catch {
        // Stats are non-critical — fail silently
      }
    }
    fetchStats();
  }, []);

  return (
    <main className="dashboard-shell">
      <div className="dashboard-header">
        <p className="eyebrow">Dashboard</p>
        <h1>Cash Flow Projection</h1>
        <p className="subhead">
          Select a snapshot to view or edit monthly cash flow projections and actuals.
        </p>
      </div>

      {/* Summary stat cards */}
      <div className="stat-cards">
        {stats ? (
          <>
            <div className="stat-card">
              <div className="stat-card-label">Total Snapshots</div>
              <div className="stat-card-value">{stats.total}</div>
            </div>
            <div className="stat-card">
              <div className="stat-card-label">Active Drafts</div>
              <div className="stat-card-value">{stats.drafts}</div>
              <div className="stat-card-sub">Editable</div>
            </div>
            <div className="stat-card">
              <div className="stat-card-label">Locked</div>
              <div className="stat-card-value">{stats.locked}</div>
              <div className="stat-card-sub">Read-only</div>
            </div>
            {stats.latestName && (
              <div className="stat-card">
                <div className="stat-card-label">Latest Snapshot</div>
                <div className="stat-card-value" style={{ fontSize: "1.1rem" }}>
                  {stats.latestName}
                </div>
              </div>
            )}
          </>
        ) : (
          <>
            <div className="skeleton-card">
              <Skeleton width="50%" height="0.7rem" />
              <Skeleton width="30%" height="1.5rem" />
            </div>
            <div className="skeleton-card">
              <Skeleton width="50%" height="0.7rem" />
              <Skeleton width="30%" height="1.5rem" />
            </div>
            <div className="skeleton-card">
              <Skeleton width="50%" height="0.7rem" />
              <Skeleton width="30%" height="1.5rem" />
            </div>
          </>
        )}
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
