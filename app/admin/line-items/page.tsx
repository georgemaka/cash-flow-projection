"use client";

import { useCallback, useEffect, useState } from "react";
import { LineItemManager } from "@/components/line-items";
import { SkeletonCard } from "@/components/ui/Skeleton";
import "@/components/line-items/line-items.css";

interface Group {
  id: string;
  name: string;
  groupType: string;
  sortOrder: number;
  isActive: boolean;
}

const GROUP_TYPE_OPTIONS = [
  { value: "sector", label: "Sector" },
  { value: "non_operating", label: "Non-Operating" },
  { value: "custom", label: "Custom" },
];

export default function LineItemsAdminPage() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create group form
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupType, setNewGroupType] = useState("sector");
  const [creating, setCreating] = useState(false);

  // Edit group state
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editGroupName, setEditGroupName] = useState("");
  const [editGroupType, setEditGroupType] = useState("");

  // Show archived
  const [showArchived, setShowArchived] = useState(false);

  const fetchGroups = useCallback(async () => {
    try {
      const url = showArchived ? "/api/groups?includeInactive=true" : "/api/groups";
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch groups");
      const data = await res.json();
      const groupList: Group[] = (data.data ?? data).sort(
        (a: Group, b: Group) => a.sortOrder - b.sortOrder
      );
      setGroups(groupList);
      if (groupList.length > 0 && !selectedGroupId) {
        const firstActive = groupList.find((g) => g.isActive);
        if (firstActive) setSelectedGroupId(firstActive.id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [showArchived]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);

  const handleCreateGroup = useCallback(async () => {
    if (!newGroupName.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const maxSort = groups.reduce((max, g) => Math.max(max, g.sortOrder), 0);
      const res = await fetch("/api/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newGroupName.trim(),
          groupType: newGroupType,
          sortOrder: maxSort + 1,
          createdBy: undefined,
        }),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error ?? "Failed to create group");
      }
      setNewGroupName("");
      setNewGroupType("sector");
      setShowCreateForm(false);
      await fetchGroups();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setCreating(false);
    }
  }, [newGroupName, newGroupType, groups, fetchGroups]);

  const handleEditGroup = useCallback(
    async (groupId: string) => {
      if (!editGroupName.trim()) return;
      setError(null);
      try {
        const res = await fetch(`/api/groups/${groupId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: editGroupName.trim(),
            groupType: editGroupType,
            updatedBy: undefined,
          }),
        });
        if (!res.ok) {
          const body = await res.json();
          throw new Error(body.error ?? "Failed to update group");
        }
        setEditingGroupId(null);
        await fetchGroups();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      }
    },
    [editGroupName, editGroupType, fetchGroups]
  );

  const handleArchiveGroup = useCallback(
    async (groupId: string) => {
      setError(null);
      try {
        const res = await fetch(`/api/groups/${groupId}`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ archivedBy: undefined }),
        });
        if (!res.ok) {
          const body = await res.json();
          throw new Error(body.error ?? "Failed to archive group");
        }
        if (selectedGroupId === groupId) setSelectedGroupId(null);
        await fetchGroups();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      }
    },
    [selectedGroupId, fetchGroups]
  );

  const handleMoveGroup = useCallback(
    async (groupId: string, direction: "up" | "down") => {
      const active = groups.filter((g) => g.isActive);
      const idx = active.findIndex((g) => g.id === groupId);
      if (idx < 0) return;
      const swapIdx = direction === "up" ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= active.length) return;

      setError(null);
      try {
        await Promise.all([
          fetch(`/api/groups/${active[idx].id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sortOrder: active[swapIdx].sortOrder, updatedBy: undefined }),
          }),
          fetch(`/api/groups/${active[swapIdx].id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sortOrder: active[idx].sortOrder, updatedBy: undefined }),
          }),
        ]);
        await fetchGroups();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      }
    },
    [groups, fetchGroups]
  );

  const startEditGroup = (g: Group) => {
    setEditingGroupId(g.id);
    setEditGroupName(g.name);
    setEditGroupType(g.groupType);
  };

  const selectedGroup = groups.find((g) => g.id === selectedGroupId);
  const activeGroups = groups.filter((g) => g.isActive);
  const archivedGroups = groups.filter((g) => !g.isActive);

  return (
    <div className="dashboard-shell">
      <div className="dashboard-header">
        <p className="eyebrow">Admin</p>
        <h1>Groups &amp; Line Items</h1>
        <p className="subhead">
          Manage groups (sectors), line items, projection strategies, and ordering.
        </p>
      </div>

      {error && (
        <div className="error-banner">
          <p>{error}</p>
          <button className="ghost-btn" onClick={() => setError(null)} type="button">
            Dismiss
          </button>
        </div>
      )}

      {loading && (
        <div className="grid-layout">
          <div className="card panel">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
          <div className="card panel">
            <SkeletonCard />
          </div>
        </div>
      )}

      {!loading && (
        <div className="grid-layout">
          {/* Group sidebar */}
          <div className="card panel">
            <div className="panel-head">
              <h2>Groups</h2>
              <button
                className="ghost-btn"
                onClick={() => setShowCreateForm(!showCreateForm)}
                type="button"
              >
                {showCreateForm ? "Cancel" : "+ New Group"}
              </button>
            </div>

            {showCreateForm && (
              <div className="admin-group-form">
                <input
                  type="text"
                  placeholder="Group name..."
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCreateGroup()}
                  autoFocus
                />
                <select value={newGroupType} onChange={(e) => setNewGroupType(e.target.value)}>
                  {GROUP_TYPE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
                <button onClick={handleCreateGroup} disabled={creating || !newGroupName.trim()} type="button">
                  {creating ? "Creating..." : "Create"}
                </button>
              </div>
            )}

            <div className="admin-sidebar">
              {activeGroups.map((g, idx) => (
                <div key={g.id} className="admin-group-item-wrapper">
                  {editingGroupId === g.id ? (
                    <div className="admin-group-edit-form">
                      <input
                        type="text"
                        value={editGroupName}
                        onChange={(e) => setEditGroupName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleEditGroup(g.id);
                          if (e.key === "Escape") setEditingGroupId(null);
                        }}
                        autoFocus
                      />
                      <select value={editGroupType} onChange={(e) => setEditGroupType(e.target.value)}>
                        {GROUP_TYPE_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                      <div className="admin-group-edit-actions">
                        <button onClick={() => handleEditGroup(g.id)} disabled={!editGroupName.trim()} type="button">Save</button>
                        <button className="ghost-btn" onClick={() => setEditingGroupId(null)} type="button">Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <div className="admin-group-item">
                      <button
                        className={`admin-sidebar-item${g.id === selectedGroupId ? " admin-sidebar-item-active" : ""}`}
                        onClick={() => setSelectedGroupId(g.id)}
                        type="button"
                      >
                        <span>{g.name}</span>
                        <span className="admin-sidebar-type">{g.groupType.replace("_", " ")}</span>
                      </button>
                      <div className="admin-group-actions">
                        <button className="admin-icon-btn" onClick={() => handleMoveGroup(g.id, "up")} disabled={idx === 0} type="button" title="Move up" aria-label="Move up">&#9650;</button>
                        <button className="admin-icon-btn" onClick={() => handleMoveGroup(g.id, "down")} disabled={idx === activeGroups.length - 1} type="button" title="Move down" aria-label="Move down">&#9660;</button>
                        <button className="admin-icon-btn" onClick={() => startEditGroup(g)} type="button" title="Edit" aria-label="Edit group">&#9998;</button>
                        <button
                          className="admin-icon-btn admin-icon-btn-danger"
                          onClick={() => { if (confirm(`Archive "${g.name}"? This hides it from the grid.`)) handleArchiveGroup(g.id); }}
                          type="button"
                          title="Archive"
                          aria-label="Archive group"
                        >&#128465;</button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
              {activeGroups.length === 0 && (
                <p className="li-empty">No active groups. Create one above.</p>
              )}
            </div>

            {(archivedGroups.length > 0 || showArchived) && (
              <div className="admin-archived-section">
                <button className="ghost-btn admin-archived-toggle" onClick={() => setShowArchived(!showArchived)} type="button">
                  {showArchived ? `Hide archived (${archivedGroups.length})` : `Show archived (${archivedGroups.length})`}
                </button>
                {showArchived && archivedGroups.map((g) => (
                  <div key={g.id} className="admin-sidebar-item admin-sidebar-item-archived">
                    <span>{g.name}</span>
                    <span className="admin-sidebar-type">archived</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Line item manager */}
          <div className="card panel">
            {selectedGroup ? (
              <LineItemManager groupId={selectedGroup.id} groupName={selectedGroup.name} allGroups={activeGroups} />
            ) : (
              <div className="cf-empty-state">
                <p>Select a group to manage its line items.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
