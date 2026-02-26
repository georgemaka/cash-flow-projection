"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface Snapshot {
  id: string;
  name: string;
  asOfMonth: string;
  status: "draft" | "locked";
  createdAt: string;
  creator?: { name: string; email: string } | null;
  locker?: { name: string; email: string } | null;
}

export function SnapshotList() {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    async function fetchSnapshots() {
      try {
        const res = await fetch("/api/snapshots");
        if (!res.ok) throw new Error("Failed to fetch snapshots");
        const data = await res.json();
        setSnapshots(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    }
    fetchSnapshots();
  }, []);

  if (loading) return <p>Loading snapshots...</p>;
  if (error) return <div className="error-banner"><p>{error}</p></div>;
  if (snapshots.length === 0) {
    return (
      <div className="cf-empty-state">
        <p>No snapshots yet. Create your first snapshot to get started.</p>
      </div>
    );
  }

  return (
    <div className="list-stack">
      {snapshots.map((s) => {
        const asOf = formatAsOfMonth(s.asOfMonth);
        return (
          <button
            key={s.id}
            className="snapshot-row"
            onClick={() => router.push(`/snapshots/${s.id}`)}
            type="button"
          >
            <span className={`snapshot-chip ${s.status}`}>{s.status}</span>
            <span className="snapshot-name">{s.name}</span>
            <span className="snapshot-month">{asOf}</span>
            <span className="snapshot-month">
              {new Date(s.createdAt).toLocaleDateString()}
            </span>
            <span className="ghost-btn">Open</span>
          </button>
        );
      })}
    </div>
  );
}

function formatAsOfMonth(raw: string): string {
  const d = new Date(raw);
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
  ];
  return `${months[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}
