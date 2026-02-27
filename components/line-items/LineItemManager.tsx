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

interface GroupOption {
  id: string;
  name: string;
}

interface LineItemManagerProps {
  groupId: string;
  groupName: string;
  /** All active groups, used for "Move to..." dropdown. */
  allGroups?: GroupOption[];
}

/**
 * Line item CRUD management panel for a specific group.
 * Supports creating, renaming, reordering, moving between groups,
 * editing projection config, and archiving line items.
 */
export function LineItemManager({ groupId, groupName, allGroups }: LineItemManagerProps) {
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
      const list: LineItem[] = (data.data ?? []).sort(
        (a: LineItem, b: LineItem) => a.sortOrder - b.sortOrder
      );
      setItems(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  useEffect(() => {
    setLoading(true);
    fetchItems();
  }, [fetchItems]);

  const handleCreate = useCallback(async () => {
    if (!newLabel.trim()) return;
    setCreating(true);
    setError(null);

    try {
      const maxSort = items.reduce((max, i) => Math.max(max, i.sortOrder), 0);
      const res = await fetch("/api/line-items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          groupId,
          label: newLabel.trim(),
          projectionMethod: newConfig.method,
          projectionParams: newConfig.params,
          sortOrder: maxSort + 1,
          createdBy: undefined
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
  }, [groupId, newLabel, newConfig, items, fetchItems]);

  const handleArchive = useCallback(
    async (itemId: string) => {
      setError(null);
      try {
        const res = await fetch(`/api/line-items/${itemId}`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ archivedBy: undefined })
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
            updatedBy: undefined
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

  const handleRename = useCallback(
    async (itemId: string, newName: string) => {
      if (!newName.trim()) return;
      setError(null);
      try {
        const res = await fetch(`/api/line-items/${itemId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ label: newName.trim(), updatedBy: undefined })
        });
        if (!res.ok) {
          const body = await res.json();
          throw new Error(body.error ?? "Failed to rename");
        }
        await fetchItems();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      }
    },
    [fetchItems]
  );

  const handleMove = useCallback(
    async (itemId: string, direction: "up" | "down") => {
      const idx = items.findIndex((i) => i.id === itemId);
      if (idx < 0) return;
      const swapIdx = direction === "up" ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= items.length) return;

      setError(null);
      try {
        await Promise.all([
          fetch(`/api/line-items/${items[idx].id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sortOrder: items[swapIdx].sortOrder, updatedBy: undefined })
          }),
          fetch(`/api/line-items/${items[swapIdx].id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sortOrder: items[idx].sortOrder, updatedBy: undefined })
          }),
        ]);
        await fetchItems();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      }
    },
    [items, fetchItems]
  );

  const handleMoveToGroup = useCallback(
    async (itemId: string, targetGroupId: string) => {
      setError(null);
      try {
        const res = await fetch(`/api/line-items/${itemId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ groupId: targetGroupId, updatedBy: undefined })
        });
        if (!res.ok) {
          const body = await res.json();
          throw new Error(body.error ?? "Failed to move");
        }
        await fetchItems();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      }
    },
    [fetchItems]
  );

  if (loading) return <p>Loading line items...</p>;

  const otherGroups = (allGroups ?? []).filter((g) => g.id !== groupId);

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
        <ProjectionStrategyPicker value={newConfig} onChange={setNewConfig} disabled={creating} />
      </div>

      {/* Item list */}
      <div className="list-stack">
        {items.map((item, idx) => (
          <LineItemCard
            key={item.id}
            item={item}
            index={idx}
            total={items.length}
            editing={editingId === item.id}
            otherGroups={otherGroups}
            onEdit={() => setEditingId(editingId === item.id ? null : item.id)}
            onArchive={() => handleArchive(item.id)}
            onUpdateProjection={(config) => handleUpdateProjection(item.id, config)}
            onRename={(name) => handleRename(item.id, name)}
            onMove={(dir) => handleMove(item.id, dir)}
            onMoveToGroup={(gId) => handleMoveToGroup(item.id, gId)}
          />
        ))}
        {items.length === 0 && <p className="li-empty">No line items yet. Add one above.</p>}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Line Item Card
// ---------------------------------------------------------------------------

interface LineItemCardProps {
  item: LineItem;
  index: number;
  total: number;
  editing: boolean;
  otherGroups: GroupOption[];
  onEdit: () => void;
  onArchive: () => void;
  onUpdateProjection: (config: ProjectionConfig) => void;
  onRename: (name: string) => void;
  onMove: (direction: "up" | "down") => void;
  onMoveToGroup: (groupId: string) => void;
}

function LineItemCard({
  item,
  index,
  total,
  editing,
  otherGroups,
  onEdit,
  onArchive,
  onUpdateProjection,
  onRename,
  onMove,
  onMoveToGroup
}: LineItemCardProps) {
  const [editConfig, setEditConfig] = useState<ProjectionConfig>({
    method: item.projectionMethod,
    params: item.projectionParams ?? {}
  });
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(item.label);

  const methodLabel = {
    manual: "Manual",
    annual_spread: "Annual Spread",
    prior_year_pct: "Prior Year +/- %",
    prior_year_flat: "Prior Year Flat",
    custom_formula: "Custom Formula"
  }[item.projectionMethod];

  const handleRenameSubmit = () => {
    if (renameValue.trim() && renameValue.trim() !== item.label) {
      onRename(renameValue.trim());
    }
    setRenaming(false);
  };

  return (
    <div className={`row-card${editing ? " selected" : ""}`}>
      <div className="li-card-top">
        {renaming ? (
          <input
            className="li-rename-input"
            type="text"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onBlur={handleRenameSubmit}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleRenameSubmit();
              if (e.key === "Escape") { setRenaming(false); setRenameValue(item.label); }
            }}
            autoFocus
          />
        ) : (
          <span
            className="li-card-label li-card-label-editable"
            onDoubleClick={() => setRenaming(true)}
            title="Double-click to rename"
          >
            {item.label}
          </span>
        )}
        <span className="li-card-method">{methodLabel}</span>
      </div>

      <div className="li-card-actions">
        <button className="admin-icon-btn" onClick={() => onMove("up")} disabled={index === 0} type="button" title="Move up" aria-label="Move up">&#9650;</button>
        <button className="admin-icon-btn" onClick={() => onMove("down")} disabled={index === total - 1} type="button" title="Move down" aria-label="Move down">&#9660;</button>
        {otherGroups.length > 0 && (
          <select
            className="li-move-select"
            value=""
            onChange={(e) => {
              if (e.target.value) onMoveToGroup(e.target.value);
            }}
            title="Move to another group"
          >
            <option value="">Move to...</option>
            {otherGroups.map((g) => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
        )}
        <button className="ghost-btn" onClick={onEdit} type="button">
          {editing ? "Close" : "Edit"}
        </button>
        <button
          className="danger"
          onClick={() => { if (confirm(`Archive "${item.label}"?`)) onArchive(); }}
          type="button"
        >
          Archive
        </button>
      </div>

      {editing && (
        <div className="li-card-edit">
          <ProjectionStrategyPicker value={editConfig} onChange={setEditConfig} />
          <button onClick={() => onUpdateProjection(editConfig)} type="button">
            Save Projection
          </button>
        </div>
      )}
    </div>
  );
}
