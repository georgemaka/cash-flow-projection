"use client";

import { useState, type FormEvent } from "react";
import { useToast } from "./Toast";

interface BaseProps {
  onClose: () => void;
  onCreated: () => void;
}

interface NewProps extends BaseProps {
  mode: "new";
}

interface CopyProps extends BaseProps {
  mode: "copy";
  sourceId: string;
  sourceName: string;
}

type SnapshotDialogProps = NewProps | CopyProps;

function currentYearMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export function SnapshotDialog(props: SnapshotDialogProps) {
  const { mode, onClose, onCreated } = props;
  const { toast } = useToast();
  const [name, setName] = useState(
    mode === "copy" ? `Copy of ${(props as CopyProps).sourceName}` : ""
  );
  const [asOfMonth, setAsOfMonth] = useState(currentYearMonth);
  const [submitting, setSubmitting] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setFieldError(null);

    try {
      const url = mode === "copy" ? "/api/snapshots/copy" : "/api/snapshots";
      const body =
        mode === "copy"
          ? {
              name,
              asOfMonth,
              createdBy: "admin",
              sourceSnapshotId: (props as CopyProps).sourceId,
            }
          : { name, asOfMonth, createdBy: "admin" };

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Request failed");
      }

      toast(mode === "copy" ? "Snapshot copied" : "Snapshot created", "success");
      onCreated();
      onClose();
    } catch (err) {
      setFieldError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  const title = mode === "copy" ? `Copy "${(props as CopyProps).sourceName}"` : "New Snapshot";
  const submitLabel =
    mode === "copy"
      ? submitting
        ? "Copying…"
        : "Copy Snapshot"
      : submitting
      ? "Creating…"
      : "Create Snapshot";

  return (
    <div
      className="modal-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="snapshot-dialog-title"
    >
      <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 id="snapshot-dialog-title" className="modal-title">
            {title}
          </h2>
          <button
            className="modal-close"
            onClick={onClose}
            type="button"
            aria-label="Close dialog"
          >
            &#x00D7;
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-body">
          <div className="form-field">
            <label htmlFor="sd-name" className="form-label">
              Name
            </label>
            <input
              id="sd-name"
              type="text"
              className="form-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. 2025 Forecast"
              required
              // eslint-disable-next-line jsx-a11y/no-autofocus
              autoFocus
            />
          </div>

          <div className="form-field">
            <label htmlFor="sd-month" className="form-label">
              As-of Month
            </label>
            <input
              id="sd-month"
              type="month"
              className="form-input"
              value={asOfMonth}
              onChange={(e) => setAsOfMonth(e.target.value)}
              required
            />
          </div>

          {fieldError && <p className="form-error">{fieldError}</p>}

          <div className="modal-footer">
            <button type="button" className="ghost-btn" onClick={onClose} disabled={submitting}>
              Cancel
            </button>
            <button type="submit" disabled={submitting}>
              {submitLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
