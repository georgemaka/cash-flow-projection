"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { CompareData } from "@/components/snapshot-compare/types";
import { SnapshotCompareView } from "@/components/snapshot-compare/SnapshotCompareView";
import "@/components/snapshot-compare/snapshot-compare.css";

interface SnapshotOption {
  id: string;
  name: string;
  status: "draft" | "locked";
  asOfMonth: string;
}

/** Inner component — uses useSearchParams, must be inside a Suspense boundary. */
function ComparePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [snapshots, setSnapshots] = useState<SnapshotOption[]>([]);
  const [snapshotsLoading, setSnapshotsLoading] = useState(true);

  const [selectedA, setSelectedA] = useState<string>(searchParams.get("a") ?? "");
  const [selectedB, setSelectedB] = useState<string>(searchParams.get("b") ?? "");

  const [compareData, setCompareData] = useState<CompareData | null>(null);
  const [comparing, setComparing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load snapshot list
  useEffect(() => {
    fetch("/api/snapshots")
      .then((r) => r.json())
      .then((body) => {
        const list = Array.isArray(body) ? body : (body.data ?? []);
        setSnapshots(list);
      })
      .catch(() => {})
      .finally(() => setSnapshotsLoading(false));
  }, []);

  const runCompare = useCallback(
    async (a: string, b: string) => {
      if (!a || !b || a === b) return;
      setComparing(true);
      setError(null);
      setCompareData(null);
      try {
        const res = await fetch(
          `/api/snapshots/compare?a=${encodeURIComponent(a)}&b=${encodeURIComponent(b)}`
        );
        const body = await res.json();
        if (!res.ok) throw new Error(body.error ?? "Compare failed");
        setCompareData(body.data as CompareData);
        // Reflect selection in URL without full navigation
        const params = new URLSearchParams({ a, b });
        router.replace(`/snapshots/compare?${params.toString()}`, { scroll: false });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to compare snapshots");
      } finally {
        setComparing(false);
      }
    },
    [router]
  );

  // Auto-run if both IDs come from URL
  useEffect(() => {
    const a = searchParams.get("a") ?? "";
    const b = searchParams.get("b") ?? "";
    if (a && b && a !== b) {
      runCompare(a, b);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally run once on mount

  const canCompare = selectedA && selectedB && selectedA !== selectedB;

  return (
    <>
      {/* Snapshot selector */}
      <div className="cmp-selector-panel">
        <div className="cmp-selector-row">
          <label className="cmp-selector-label">
            <span className="cmp-legend-dot cmp-legend-a">A</span>
            Snapshot A
          </label>
          <select
            className="cmp-select"
            value={selectedA}
            onChange={(e) => setSelectedA(e.target.value)}
            disabled={snapshotsLoading}
          >
            <option value="">— select —</option>
            {snapshots.map((s) => (
              <option key={s.id} value={s.id} disabled={s.id === selectedB}>
                {s.name}
                {s.status === "locked" ? " (locked)" : ""}
              </option>
            ))}
          </select>

          <label className="cmp-selector-label">
            <span className="cmp-legend-dot cmp-legend-b">B</span>
            Snapshot B
          </label>
          <select
            className="cmp-select"
            value={selectedB}
            onChange={(e) => setSelectedB(e.target.value)}
            disabled={snapshotsLoading}
          >
            <option value="">— select —</option>
            {snapshots.map((s) => (
              <option key={s.id} value={s.id} disabled={s.id === selectedA}>
                {s.name}
                {s.status === "locked" ? " (locked)" : ""}
              </option>
            ))}
          </select>

          <button
            onClick={() => runCompare(selectedA, selectedB)}
            disabled={!canCompare || comparing}
            type="button"
          >
            {comparing ? "Comparing\u2026" : "Compare"}
          </button>
        </div>
        {selectedA === selectedB && selectedA !== "" && (
          <p className="cmp-selector-warn">Select two different snapshots.</p>
        )}
      </div>

      {error && (
        <div className="error-banner">
          <p>{error}</p>
        </div>
      )}

      {comparing && (
        <div className="cf-loading">
          <p>Loading comparison\u2026</p>
        </div>
      )}

      {compareData && <SnapshotCompareView data={compareData} />}

      {!comparing && !compareData && !error && (
        <div className="cf-empty-state">
          <p>Select two snapshots above and click Compare.</p>
        </div>
      )}
    </>
  );
}

export default function SnapshotComparePage() {
  const router = useRouter();

  return (
    <div className="dashboard-shell">
      <div className="dashboard-header">
        <button className="ghost-btn" onClick={() => router.push("/")} type="button">
          &larr; Back
        </button>
        <p className="eyebrow">Snapshots</p>
        <h1>Compare</h1>
        <p className="subhead">Side-by-side delta view — B minus A</p>
      </div>
      {/* Suspense required by Next.js 15 when useSearchParams is used in a child */}
      <Suspense
        fallback={
          <div className="cf-loading">
            <p>Loading\u2026</p>
          </div>
        }
      >
        <ComparePageContent />
      </Suspense>
    </div>
  );
}
