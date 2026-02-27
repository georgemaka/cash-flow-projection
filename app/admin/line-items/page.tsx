"use client";

import { useEffect, useState } from "react";
import { LineItemManager } from "@/components/line-items";
import { SkeletonCard } from "@/components/ui/Skeleton";
import "@/components/line-items/line-items.css";

interface Group {
  id: string;
  name: string;
  groupType: string;
  sortOrder: number;
}

export default function LineItemsAdminPage() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchGroups() {
      try {
        const res = await fetch("/api/groups");
        if (!res.ok) throw new Error("Failed to fetch groups");
        const data = await res.json();
        const groupList = data.data ?? data;
        setGroups(groupList);
        if (groupList.length > 0 && !selectedGroupId) {
          setSelectedGroupId(groupList[0].id);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    }
    fetchGroups();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const selectedGroup = groups.find((g) => g.id === selectedGroupId);

  return (
    <div className="dashboard-shell">
      <div className="dashboard-header">
        <p className="eyebrow">Admin</p>
        <h1>Line Items</h1>
        <p className="subhead">
          Manage line items and configure projection strategies for each group.
        </p>
      </div>

      {error && (
        <div className="error-banner">
          <p>{error}</p>
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

      {!loading && groups.length > 0 && (
        <div className="grid-layout">
          {/* Group sidebar */}
          <div className="card panel">
            <div className="panel-head">
              <h2>Groups</h2>
              <p>{groups.length} total</p>
            </div>
            <div className="admin-sidebar">
              {groups.map((g) => (
                <button
                  key={g.id}
                  className={`admin-sidebar-item${g.id === selectedGroupId ? " admin-sidebar-item-active" : ""}`}
                  onClick={() => setSelectedGroupId(g.id)}
                  type="button"
                >
                  <span>{g.name}</span>
                  <span className="admin-sidebar-type">
                    {g.groupType.replace("_", " ")}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Line item manager */}
          <div className="card panel">
            {selectedGroup ? (
              <LineItemManager groupId={selectedGroup.id} groupName={selectedGroup.name} />
            ) : (
              <div className="cf-empty-state">
                <p>Select a group to manage its line items.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {!loading && groups.length === 0 && (
        <div className="cf-empty-state">
          <div className="cf-empty-icon">&#128193;</div>
          <p>No groups yet. Create groups first before adding line items.</p>
        </div>
      )}
    </div>
  );
}
