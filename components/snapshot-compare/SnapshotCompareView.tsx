"use client";

import { useEffect, useState } from "react";
import type { CompareData } from "./types";
import { CompareGrid } from "./CompareGrid";
import { CompareMobileView } from "./CompareMobileView";

interface SnapshotCompareViewProps {
  data: CompareData;
}

export function SnapshotCompareView({ data }: SnapshotCompareViewProps) {
  const [mode, setMode] = useState<"projected" | "actual" | "both">("projected");
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  return (
    <div className="cmp-view">
      <div className="cmp-toolbar">
        <div className="cmp-legend">
          <span className="cmp-legend-label">
            <span className="cmp-legend-dot cmp-legend-a">A</span>
            {data.snapshotA.name}
          </span>
          <span className="cmp-legend-vs">vs</span>
          <span className="cmp-legend-label">
            <span className="cmp-legend-dot cmp-legend-b">B</span>
            {data.snapshotB.name}
          </span>
        </div>
        <div className="cmp-mode-btns">
          <button
            className={`ghost-btn${mode === "projected" ? " cmp-mode-active" : ""}`}
            onClick={() => setMode("projected")}
            type="button"
          >
            Projected
          </button>
          <button
            className={`ghost-btn${mode === "actual" ? " cmp-mode-active" : ""}`}
            onClick={() => setMode("actual")}
            type="button"
          >
            Actual
          </button>
          <button
            className={`ghost-btn${mode === "both" ? " cmp-mode-active" : ""}`}
            onClick={() => setMode("both")}
            type="button"
          >
            Both
          </button>
        </div>
      </div>
      <p className="cmp-hint">
        Positive delta (B &minus; A) shown in <span style={{ color: "var(--cmp-pos)" }}>green</span>
        , negative in <span style={{ color: "var(--cmp-neg)" }}>red</span>.
      </p>
      {isMobile ? (
        <CompareMobileView data={data} mode={mode} />
      ) : (
        <CompareGrid data={data} mode={mode} />
      )}
    </div>
  );
}
