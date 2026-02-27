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
  const [compareMode, setCompareMode] = useState(false);
  const [compareA, setCompareA] = useState<string | null>(null);

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
  if (error)
    return (
      <div className="error-banner">
        <p>{error}</p>
      </div>
    );
  if (snapshots.length === 0) {
    return (
      <div className="cf-empty-state">
        <p>No snapshots yet. Create your first snapshot to get started.</p>
      </div>
    );
  }

  const handleSnapshotClick = (id: string) => {
    if (!compareMode) {
      router.push(`/snapshots/${id}`);
      return;
    }
    if (!compareA) {
      setCompareA(id);
    } else if (compareA !== id) {
      router.push(`/snapshots/compare?a=${compareA}&b=${id}`);
      setCompareMode(false);
      setCompareA(null);
    }
  };

  return (
    <div className="list-stack">
      <div className="snapshot-list-toolbar">
        <button
          className={`ghost-btn${compareMode ? " snapshot-compare-active" : ""}`}
          onClick={() => {
            setCompareMode((m) => !m);
            setCompareA(null);
          }}
          type="button"
        >
          {compareMode
            ? compareA
              ? "Pick second snapshot…"
              : "Pick first snapshot…"
            : "Compare two snapshots"}
        </button>
        {compareMode && (
          <button
            className="ghost-btn"
            onClick={() => {
              setCompareMode(false);
              setCompareA(null);
            }}
            type="button"
          >
            Cancel
          </button>
        )}
      </div>
      {snapshots.map((s) => {
        const asOf = formatAsOfMonth(s.asOfMonth);
        const isSelectedA = compareA === s.id;
        return (
          <button
            key={s.id}
            className={`snapshot-row${isSelectedA ? " snapshot-row-selected" : ""}`}
            onClick={() => handleSnapshotClick(s.id)}
            type="button"
          >
            <span className={`snapshot-chip ${s.status}`}>{s.status}</span>
            <span className="snapshot-name">{s.name}</span>
            <span className="snapshot-month">{asOf}</span>
            <span className="snapshot-month">{new Date(s.createdAt).toLocaleDateString()}</span>
            <span className="ghost-btn">
              {compareMode ? (isSelectedA ? "Selected A" : "Select") : "Open"}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function formatAsOfMonth(raw: string): string {
  const d = new Date(raw);
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec"
  ];
  return `${months[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}
