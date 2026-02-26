"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ProjectionStrategyPicker,
  type ProjectionConfig,
  type ProjectionMethod
} from "./ProjectionStrategyPicker";

interface LineItem {
  id: string;
  groupId: string;
  label: string;
  projectionMethod: ProjectionMethod;
  projectionParams: Record<string, unknown> | null;
  sortOrder: number;
  isActive: boolean;
}

interface LineItemManagerProps {
  groupId: string;
  groupName: string;
}

/**
 * Line item CRUD management panel for a specific group.
 * Supports creating, editing projection config, and archiving line items.
 */
export function LineItemManager({ groupId, groupName }: LineItemManagerProps) {
  const [items, setItems] = useState<LineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Create form state
  const [newLabel, setNewLabel] = useState("");
  const [newConfig, setNewConfig] = useState<ProjectionConfig>({
    method: "manual",
    params: {}
  });
  const [creating, setCreating] = useState(false);

  const fetchItems = useCallback(async () => {
    try {
      const res = await fetch(`/api/line-items?groupId=${groupId}`);
      if (!res.ok) throw new Error("Failed to fetch line items");
      const data = await res.json();
      setItems(data.data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const handleCreate = useCallback(async () => {
    if (!newLabel.trim()) return;
    setCreating(true);
    setError(null);

    try {
      const res = await fetch("/api/line-items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          groupId,
          label: newLabel.trim(),
          projectionMethod: newConfig.method,
          projectionParams: newConfig.params,
          createdBy: null
        })
      });

      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error ?? "Failed to create line item");
      }

      setNewLabel("");
      setNewConfig({ method: "manual", params: {} });
      await fetchItems();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setCreating(false);
    }
  }, [groupId, newLabel, newConfig, fetchItems]);

  const handleArchive = useCallback(
    async (itemId: string) => {
      setError(null);
      try {
        const res = await fetch(`/api/line-items/${itemId}`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ archivedBy: null })
        });

        if (!res.ok) {
          const body = await res.json();
          throw new Error(body.error ?? "Failed to archive");
        }

        await fetchItems();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      }
    },
    [fetchItems]
  );

  const handleUpdateProjection = useCallback(
    async (itemId: string, config: ProjectionConfig) => {
      setError(null);
      try {
        const res = await fetch(`/api/line-items/${itemId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectionMethod: config.method,
            projectionParams: config.params,
            updatedBy: null
          })
        });

        if (!res.ok) {
          const body = await res.json();
          throw new Error(body.error ?? "Failed to update");
        }

        setEditingId(null);
        await fetchItems();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      }
    },
    [fetchItems]
  );

  if (loading) return <p>Loading line items...</p>;

  return (
    <div className="li-manager">
      <div className="li-manager-header">
        <h3>{groupName}</h3>
        <span className="li-manager-count">{items.length} items</span>
      </div>

      {error && (
        <div className="error-banner">
          <p>{error}</p>
        </div>
      )}

      {/* Create form */}
      <div className="li-create-form">
        <div className="li-create-row">
          <input
            type="text"
            placeholder="New line item label..."
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
          />
          <button onClick={handleCreate} disabled={creating || !newLabel.trim()} type="button">
            {creating ? "Adding..." : "Add"}
          </button>
        </div>
        <ProjectionStrategyPicker
          value={newConfig}
          onChange={setNewConfig}
          disabled={creating}
        />
      </div>

      {/* Item list */}
      <div className="list-stack">
        {items.map((item) => (
          <LineItemCard
            key={item.id}
            item={item}
            editing={editingId === item.id}
            onEdit={() => setEditingId(editingId === item.id ? null : item.id)}
            onArchive={() => handleArchive(item.id)}
            onUpdateProjection={(config) => handleUpdateProjection(item.id, config)}
          />
        ))}
        {items.length === 0 && (
          <p className="li-empty">No line items yet. Add one above.</p>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Line Item Card
// ---------------------------------------------------------------------------

interface LineItemCardProps {
  item: LineItem;
  editing: boolean;
  onEdit: () => void;
  onArchive: () => void;
  onUpdateProjection: (config: ProjectionConfig) => void;
}

function LineItemCard({ item, editing, onEdit, onArchive, onUpdateProjection }: LineItemCardProps) {
  const [editConfig, setEditConfig] = useState<ProjectionConfig>({
    method: item.projectionMethod,
    params: item.projectionParams ?? {}
  });

  const methodLabel = {
    manual: "Manual",
    annual_spread: "Annual Spread",
    prior_year_pct: "Prior Year +/- %",
    prior_year_flat: "Prior Year Flat",
    custom_formula: "Custom Formula"
  }[item.projectionMethod];

  return (
    <div className={`row-card${editing ? " selected" : ""}`}>
      <span className="li-card-label">{item.label}</span>
      <span className="li-card-method">{methodLabel}</span>
      <button className="ghost-btn" onClick={onEdit} type="button">
        {editing ? "Close" : "Edit"}
      </button>
      <button className="danger" onClick={onArchive} type="button">
        Archive
      </button>
      {editing && (
        <div className="li-card-edit">
          <ProjectionStrategyPicker
            value={editConfig}
            onChange={setEditConfig}
          />
          <button
            onClick={() => onUpdateProjection(editConfig)}
            type="button"
          >
            Save Projection
          </button>
        </div>
      )}
    </div>
  );
}
