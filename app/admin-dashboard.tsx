"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";

type GroupType = "sector" | "non_operating" | "custom";
type ProjectionMethod =
  | "manual"
  | "annual_spread"
  | "prior_year_pct"
  | "prior_year_flat"
  | "custom_formula";

interface GroupRecord {
  id: string;
  name: string;
  groupType: GroupType;
  sortOrder: number;
  isActive: boolean;
}

interface LineItemRecord {
  id: string;
  groupId: string;
  label: string;
  projectionMethod: ProjectionMethod;
  projectionParams?: Record<string, unknown> | null;
  sortOrder: number;
  isActive: boolean;
}

type SnapshotStatus = "draft" | "locked";

interface SnapshotRecord {
  id: string;
  name: string;
  asOfMonth: string;
  status: SnapshotStatus;
  lockedAt: string | null;
}

interface ValueRecord {
  id: string;
  lineItemId: string;
  snapshotId: string;
  period: string;
  projectedAmount: string | null;
  actualAmount: string | null;
  note: string | null;
}

const ACTOR_ID = "system-agent";

const groupTypeOptions: Array<{ label: string; value: GroupType }> = [
  { label: "Sector", value: "sector" },
  { label: "Non-Operating", value: "non_operating" },
  { label: "Custom", value: "custom" }
];

const projectionMethodOptions: Array<{ label: string; value: ProjectionMethod }> = [
  { label: "Manual", value: "manual" },
  { label: "Annual Spread", value: "annual_spread" },
  { label: "Prior Year %", value: "prior_year_pct" },
  { label: "Prior Year Flat", value: "prior_year_flat" },
  { label: "Custom Formula", value: "custom_formula" }
];

interface ApiResponse<T> {
  data?: T;
  error?: string;
}

async function apiJson<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const response = await fetch(input, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {})
    }
  });

  const json = (await response.json()) as ApiResponse<T>;
  if (!response.ok || !json.data) {
    throw new Error(json.error ?? "Request failed");
  }

  return json.data;
}

export function AdminDashboard() {
  const [groups, setGroups] = useState<GroupRecord[]>([]);
  const [lineItems, setLineItems] = useState<LineItemRecord[]>([]);
  const [snapshots, setSnapshots] = useState<SnapshotRecord[]>([]);
  const [values, setValues] = useState<ValueRecord[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string>("");
  const [selectedSnapshotId, setSelectedSnapshotId] = useState<string>("");
  const [selectedPeriod, setSelectedPeriod] = useState<string>("");
  const [includeInactive, setIncludeInactive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupType, setNewGroupType] = useState<GroupType>("sector");
  const [newGroupSortOrder, setNewGroupSortOrder] = useState(0);

  const [newLineItemLabel, setNewLineItemLabel] = useState("");
  const [newLineItemMethod, setNewLineItemMethod] = useState<ProjectionMethod>("manual");
  const [newLineItemAnnualTotal, setNewLineItemAnnualTotal] = useState("");
  const [newLineItemPctChange, setNewLineItemPctChange] = useState("");
  const [newLineItemFormula, setNewLineItemFormula] = useState("");
  const [newLineItemSortOrder, setNewLineItemSortOrder] = useState(0);
  const [lineItemQuery, setLineItemQuery] = useState("");
  const [lineItemMethodFilter, setLineItemMethodFilter] = useState<ProjectionMethod | "all">("all");
  const [newSnapshotName, setNewSnapshotName] = useState("");
  const [newSnapshotMonth, setNewSnapshotMonth] = useState("");
  const [copySnapshotName, setCopySnapshotName] = useState("");
  const [copySnapshotMonth, setCopySnapshotMonth] = useState("");

  const [editingGroups, setEditingGroups] = useState<Record<string, GroupRecord>>({});
  const [editingLineItems, setEditingLineItems] = useState<Record<string, LineItemRecord>>({});
  const [lineItemAnnualTotals, setLineItemAnnualTotals] = useState<Record<string, string>>({});
  const [lineItemPctChanges, setLineItemPctChanges] = useState<Record<string, string>>({});
  const [lineItemFormulas, setLineItemFormulas] = useState<Record<string, string>>({});
  const [valueDrafts, setValueDrafts] = useState<
    Record<string, { projectedAmount: string; actualAmount: string; note: string }>
  >({});
  const [valueSavedAt, setValueSavedAt] = useState<Record<string, string>>({});
  const valueInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const selectedGroup = useMemo(
    () => groups.find((group) => group.id === selectedGroupId) ?? null,
    [groups, selectedGroupId]
  );

  const visibleLineItems = useMemo(
    () =>
      lineItems.filter((lineItem) => {
        if (lineItem.groupId !== selectedGroupId) return false;
        if (lineItemMethodFilter !== "all" && lineItem.projectionMethod !== lineItemMethodFilter) {
          return false;
        }
        if (!lineItemQuery.trim()) return true;
        return lineItem.label.toLowerCase().includes(lineItemQuery.trim().toLowerCase());
      }),
    [lineItems, selectedGroupId, lineItemMethodFilter, lineItemQuery]
  );

  const selectedSnapshot = useMemo(
    () => snapshots.find((snapshot) => snapshot.id === selectedSnapshotId) ?? null,
    [snapshots, selectedSnapshotId]
  );

  const periodOptions = useMemo(() => {
    if (!selectedSnapshot) return [];
    const year = Number(selectedSnapshot.asOfMonth.slice(0, 4));
    if (Number.isNaN(year)) return [];

    return Array.from({ length: 12 }, (_, index) => {
      const month = String(index + 1).padStart(2, "0");
      return `${year}-${month}`;
    });
  }, [selectedSnapshot]);

  const isSnapshotLocked = selectedSnapshot?.status === "locked";

  async function loadData(groupIdOverride?: string) {
    setLoading(true);
    setError(null);

    try {
      const loadedSnapshots = await apiJson<SnapshotRecord[]>("/api/snapshots");
      setSnapshots(loadedSnapshots);
      setSelectedSnapshotId((currentId) =>
        loadedSnapshots.some((snapshot) => snapshot.id === currentId)
          ? currentId
          : (loadedSnapshots[0]?.id ?? "")
      );

      const loadedGroups = await apiJson<GroupRecord[]>(
        `/api/groups?includeInactive=${includeInactive ? "true" : "false"}`
      );
      setGroups(loadedGroups);

      const nextSelectedId = groupIdOverride ?? selectedGroupId;
      const finalSelectedId = loadedGroups.some((g) => g.id === nextSelectedId)
        ? nextSelectedId
        : (loadedGroups[0]?.id ?? "");
      setSelectedGroupId(finalSelectedId);

      if (finalSelectedId) {
        const loadedLineItems = await apiJson<LineItemRecord[]>(
          `/api/line-items?groupId=${encodeURIComponent(finalSelectedId)}&includeInactive=${
            includeInactive ? "true" : "false"
          }`
        );
        setLineItems(loadedLineItems);
      } else {
        setLineItems([]);
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [includeInactive]);

  useEffect(() => {
    if (!periodOptions.length) {
      setSelectedPeriod("");
      return;
    }

    setSelectedPeriod((current) => (periodOptions.includes(current) ? current : periodOptions[0]));
  }, [periodOptions]);

  useEffect(() => {
    if (!selectedSnapshotId || !selectedGroupId) {
      setValues([]);
      return;
    }

    void refreshValues(selectedSnapshotId, selectedGroupId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSnapshotId, selectedGroupId]);

  async function refreshLineItems(groupId: string) {
    if (!groupId) {
      setLineItems([]);
      return;
    }

    const loadedLineItems = await apiJson<LineItemRecord[]>(
      `/api/line-items?groupId=${encodeURIComponent(groupId)}&includeInactive=${
        includeInactive ? "true" : "false"
      }`
    );
    setLineItems(loadedLineItems);
  }

  async function refreshValues(snapshotId: string, groupId: string) {
    if (!snapshotId || !groupId) {
      setValues([]);
      return;
    }

    const loadedValues = await apiJson<ValueRecord[]>(
      `/api/values?snapshotId=${encodeURIComponent(snapshotId)}&groupId=${encodeURIComponent(groupId)}`
    );
    setValues(loadedValues);
  }

  function getProjectionParam(
    projectionParams: Record<string, unknown> | null | undefined,
    key: string
  ): string {
    const value = projectionParams?.[key];
    if (value === null || value === undefined) return "";
    return String(value);
  }

  function buildProjectionParams(
    method: ProjectionMethod,
    values: { annualTotal?: string; pctChange?: string; formula?: string }
  ): Record<string, unknown> | null {
    if (method === "annual_spread") {
      return values.annualTotal?.trim() ? { annualTotal: values.annualTotal.trim() } : null;
    }

    if (method === "prior_year_pct") {
      if (!values.pctChange || !values.pctChange.trim()) return null;
      const parsed = Number(values.pctChange);
      return Number.isNaN(parsed) ? null : { pctChange: parsed };
    }

    if (method === "custom_formula") {
      return values.formula?.trim() ? { formula: values.formula.trim() } : null;
    }

    return null;
  }

  function hasRequiredProjectionParams(
    method: ProjectionMethod,
    values: { annualTotal?: string; pctChange?: string; formula?: string }
  ): boolean {
    if (method === "annual_spread") {
      return Boolean(values.annualTotal && values.annualTotal.trim());
    }

    if (method === "prior_year_pct") {
      if (!values.pctChange || !values.pctChange.trim()) return false;
      return !Number.isNaN(Number(values.pctChange));
    }

    if (method === "custom_formula") {
      return Boolean(values.formula && values.formula.trim());
    }

    return true;
  }

  function isYearMonth(value: string): boolean {
    return /^\d{4}-(0[1-9]|1[0-2])$/.test(value.trim());
  }

  function parseAmount(value: string): number | null {
    if (!value.trim()) return null;
    const parsed = Number(value);
    return Number.isNaN(parsed) ? null : parsed;
  }

  function calculateVariance(projectedRaw: string, actualRaw: string) {
    const projected = parseAmount(projectedRaw);
    const actual = parseAmount(actualRaw);
    if (projected === null || actual === null) return null;

    const delta = actual - projected;
    const pctDelta = projected === 0 ? null : (delta / projected) * 100;
    const isMaterial = Math.abs(delta) >= Math.max(1000, Math.abs(projected) * 0.05);
    return { delta, pctDelta, isMaterial };
  }

  function valueDraftKey(lineItemId: string, period: string): string {
    return `${lineItemId}::${period}`;
  }

  function previousPeriod(period: string): string | null {
    if (!isYearMonth(period)) return null;
    const year = Number(period.slice(0, 4));
    const month = Number(period.slice(5, 7));
    const prevYear = month === 1 ? year - 1 : year;
    const prevMonth = month === 1 ? 12 : month - 1;
    return `${prevYear}-${String(prevMonth).padStart(2, "0")}`;
  }

  function normalizeAmountInput(value: string): string {
    if (!value.trim()) return "";
    const parsed = Number(value);
    if (Number.isNaN(parsed)) return value;
    return parsed.toFixed(2);
  }

  function getPersistedValue(lineItemId: string, period: string): ValueRecord | undefined {
    return values.find((value) => value.lineItemId === lineItemId && value.period.slice(0, 7) === period);
  }

  function getDraftValue(lineItemId: string, period: string) {
    const key = valueDraftKey(lineItemId, period);
    const existingDraft = valueDrafts[key];
    if (existingDraft) return existingDraft;

    const persisted = getPersistedValue(lineItemId, period);
    return {
      projectedAmount: persisted?.projectedAmount ?? "",
      actualAmount: persisted?.actualAmount ?? "",
      note: persisted?.note ?? ""
    };
  }

  function setDraftField(
    lineItemId: string,
    period: string,
    field: "projectedAmount" | "actualAmount" | "note",
    value: string
  ) {
    const key = valueDraftKey(lineItemId, period);
    const baseline = getDraftValue(lineItemId, period);
    setValueDrafts((current) => ({
      ...current,
      [key]: {
        ...baseline,
        [field]: value
      }
    }));
  }

  function isDraftDirty(lineItemId: string, period: string): boolean {
    const key = valueDraftKey(lineItemId, period);
    const draft = valueDrafts[key];
    if (!draft) return false;

    const persisted = getPersistedValue(lineItemId, period);
    const projectedBase = persisted?.projectedAmount ?? "";
    const actualBase = persisted?.actualAmount ?? "";
    const noteBase = persisted?.note ?? "";

    return (
      draft.projectedAmount !== projectedBase ||
      draft.actualAmount !== actualBase ||
      draft.note !== noteBase
    );
  }

  function setSavedTimestamp(lineItemId: string, period: string) {
    const key = valueDraftKey(lineItemId, period);
    setValueSavedAt((current) => ({
      ...current,
      [key]: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
    }));
  }

  function inputRefKey(lineItemId: string, period: string, field: "projected" | "actual" | "note") {
    return `${lineItemId}::${period}::${field}`;
  }

  function focusValueInput(
    lineItemId: string | undefined,
    period: string,
    field: "projected" | "actual" | "note"
  ) {
    if (!lineItemId) return;
    const key = inputRefKey(lineItemId, period, field);
    valueInputRefs.current[key]?.focus();
  }

  function handleValueKeyDown(
    event: KeyboardEvent<HTMLInputElement>,
    lineItemId: string,
    field: "projected" | "actual" | "note"
  ) {
    const rowIndex = visibleLineItems.findIndex((item) => item.id === lineItemId);
    if (rowIndex < 0 || !selectedPeriod) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      focusValueInput(visibleLineItems[rowIndex + 1]?.id, selectedPeriod, field);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      focusValueInput(visibleLineItems[rowIndex - 1]?.id, selectedPeriod, field);
      return;
    }

    if (event.key !== "Enter") return;
    event.preventDefault();

    if (field === "projected") {
      focusValueInput(lineItemId, selectedPeriod, "actual");
      return;
    }

    if (field === "actual") {
      focusValueInput(lineItemId, selectedPeriod, "note");
      return;
    }

    focusValueInput(visibleLineItems[rowIndex + 1]?.id, selectedPeriod, "projected");
  }

  async function handleCreateGroup() {
    if (!newGroupName.trim()) return;

    setBusy(true);
    setError(null);

    try {
      const created = await apiJson<GroupRecord>("/api/groups", {
        method: "POST",
        body: JSON.stringify({
          name: newGroupName.trim(),
          groupType: newGroupType,
          sortOrder: newGroupSortOrder,
          createdBy: ACTOR_ID
        })
      });

      setNewGroupName("");
      await loadData(created.id);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Failed to create group");
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveGroup(groupId: string) {
    const draft = editingGroups[groupId];
    if (!draft) return;

    setBusy(true);
    setError(null);

    try {
      await apiJson<GroupRecord>(`/api/groups/${groupId}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: draft.name,
          groupType: draft.groupType,
          sortOrder: draft.sortOrder,
          updatedBy: ACTOR_ID,
          reason: "Admin edit"
        })
      });

      setEditingGroups((current) => {
        const next = { ...current };
        delete next[groupId];
        return next;
      });
      await loadData(groupId);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to update group");
    } finally {
      setBusy(false);
    }
  }

  async function handleArchiveGroup(groupId: string) {
    setBusy(true);
    setError(null);

    try {
      await apiJson<GroupRecord>(`/api/groups/${groupId}`, {
        method: "DELETE",
        body: JSON.stringify({
          archivedBy: ACTOR_ID,
          reason: "Admin archive"
        })
      });

      await loadData();
    } catch (archiveError) {
      setError(archiveError instanceof Error ? archiveError.message : "Failed to archive group");
    } finally {
      setBusy(false);
    }
  }

  async function handleCreateLineItem() {
    if (!selectedGroupId || !newLineItemLabel.trim()) return;
    if (
      !hasRequiredProjectionParams(newLineItemMethod, {
        annualTotal: newLineItemAnnualTotal,
        pctChange: newLineItemPctChange,
        formula: newLineItemFormula
      })
    ) {
      setError("Projection parameters are required for the selected method");
      return;
    }

    setBusy(true);
    setError(null);

    try {
      await apiJson<LineItemRecord>("/api/line-items", {
        method: "POST",
        body: JSON.stringify({
          groupId: selectedGroupId,
          label: newLineItemLabel.trim(),
          projectionMethod: newLineItemMethod,
          projectionParams: buildProjectionParams(newLineItemMethod, {
            annualTotal: newLineItemAnnualTotal,
            pctChange: newLineItemPctChange,
            formula: newLineItemFormula
          }),
          sortOrder: newLineItemSortOrder,
          createdBy: ACTOR_ID
        })
      });

      setNewLineItemLabel("");
      setNewLineItemAnnualTotal("");
      setNewLineItemPctChange("");
      setNewLineItemFormula("");
      await refreshLineItems(selectedGroupId);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Failed to create line item");
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveLineItem(lineItemId: string) {
    const draft = editingLineItems[lineItemId];
    if (!draft) return;
    const annualTotal =
      lineItemAnnualTotals[lineItemId] ?? getProjectionParam(draft.projectionParams, "annualTotal");
    const pctChange =
      lineItemPctChanges[lineItemId] ?? getProjectionParam(draft.projectionParams, "pctChange");
    const formula =
      lineItemFormulas[lineItemId] ?? getProjectionParam(draft.projectionParams, "formula");

    if (
      !hasRequiredProjectionParams(draft.projectionMethod, {
        annualTotal,
        pctChange,
        formula
      })
    ) {
      setError("Projection parameters are required for the selected method");
      return;
    }

    setBusy(true);
    setError(null);

    try {
      await apiJson<LineItemRecord>(`/api/line-items/${lineItemId}`, {
        method: "PATCH",
        body: JSON.stringify({
          groupId: draft.groupId,
          label: draft.label,
          projectionMethod: draft.projectionMethod,
          projectionParams: buildProjectionParams(draft.projectionMethod, {
            annualTotal,
            pctChange,
            formula
          }),
          sortOrder: draft.sortOrder,
          updatedBy: ACTOR_ID,
          reason: "Admin edit"
        })
      });

      setEditingLineItems((current) => {
        const next = { ...current };
        delete next[lineItemId];
        return next;
      });
      setLineItemAnnualTotals((current) => {
        const next = { ...current };
        delete next[lineItemId];
        return next;
      });
      setLineItemPctChanges((current) => {
        const next = { ...current };
        delete next[lineItemId];
        return next;
      });
      setLineItemFormulas((current) => {
        const next = { ...current };
        delete next[lineItemId];
        return next;
      });

      await refreshLineItems(selectedGroupId);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to update line item");
    } finally {
      setBusy(false);
    }
  }

  async function handleArchiveLineItem(lineItemId: string) {
    setBusy(true);
    setError(null);

    try {
      await apiJson<LineItemRecord>(`/api/line-items/${lineItemId}`, {
        method: "DELETE",
        body: JSON.stringify({
          archivedBy: ACTOR_ID,
          reason: "Admin archive"
        })
      });

      await refreshLineItems(selectedGroupId);
    } catch (archiveError) {
      setError(
        archiveError instanceof Error ? archiveError.message : "Failed to archive line item"
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleCreateSnapshot() {
    if (!newSnapshotName.trim() || !newSnapshotMonth.trim()) return;
    if (!isYearMonth(newSnapshotMonth)) {
      setError("Snapshot month must be in YYYY-MM format");
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const created = await apiJson<SnapshotRecord>("/api/snapshots", {
        method: "POST",
        body: JSON.stringify({
          name: newSnapshotName.trim(),
          asOfMonth: newSnapshotMonth,
          createdBy: ACTOR_ID
        })
      });
      setNewSnapshotName("");
      setNewSnapshotMonth("");
      await loadData();
      setSelectedSnapshotId(created.id);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Failed to create snapshot");
    } finally {
      setBusy(false);
    }
  }

  async function handleLockSnapshot(snapshotId: string) {
    setBusy(true);
    setError(null);

    try {
      await apiJson<SnapshotRecord>("/api/snapshots/lock", {
        method: "POST",
        body: JSON.stringify({
          snapshotId,
          lockedBy: ACTOR_ID,
          reason: "Month-end close"
        })
      });
      await loadData();
      setSelectedSnapshotId(snapshotId);
    } catch (lockError) {
      setError(lockError instanceof Error ? lockError.message : "Failed to lock snapshot");
    } finally {
      setBusy(false);
    }
  }

  async function handleUnlockSnapshot(snapshotId: string) {
    setBusy(true);
    setError(null);

    try {
      await apiJson<SnapshotRecord>("/api/snapshots/unlock", {
        method: "POST",
        body: JSON.stringify({
          snapshotId,
          unlockedBy: ACTOR_ID,
          reason: "Reopen for corrections"
        })
      });
      await loadData();
      setSelectedSnapshotId(snapshotId);
    } catch (unlockError) {
      setError(unlockError instanceof Error ? unlockError.message : "Failed to unlock snapshot");
    } finally {
      setBusy(false);
    }
  }

  async function handleCopySnapshot() {
    if (!selectedSnapshotId || !copySnapshotName.trim() || !copySnapshotMonth.trim()) return;
    if (!isYearMonth(copySnapshotMonth)) {
      setError("Copy month must be in YYYY-MM format");
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const copied = await apiJson<SnapshotRecord>("/api/snapshots/copy", {
        method: "POST",
        body: JSON.stringify({
          sourceSnapshotId: selectedSnapshotId,
          name: copySnapshotName.trim(),
          asOfMonth: copySnapshotMonth,
          createdBy: ACTOR_ID
        })
      });
      setCopySnapshotName("");
      setCopySnapshotMonth("");
      await loadData();
      setSelectedSnapshotId(copied.id);
    } catch (copyError) {
      setError(copyError instanceof Error ? copyError.message : "Failed to copy snapshot");
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveValue(lineItemId: string) {
    if (!selectedSnapshotId || !selectedPeriod) return;
    if (isSnapshotLocked) {
      setError("Locked snapshots cannot be edited");
      return;
    }

    setBusy(true);
    setError(null);

    const key = valueDraftKey(lineItemId, selectedPeriod);
    const draft = getDraftValue(lineItemId, selectedPeriod);

    try {
      await apiJson<ValueRecord>("/api/values/upsert", {
        method: "POST",
        body: JSON.stringify({
          lineItemId,
          snapshotId: selectedSnapshotId,
          period: selectedPeriod,
          projectedAmount: draft.projectedAmount.trim() ? draft.projectedAmount.trim() : null,
          actualAmount: draft.actualAmount.trim() ? draft.actualAmount.trim() : null,
          note: draft.note.trim() ? draft.note.trim() : null,
          updatedBy: ACTOR_ID,
          reason: "Monthly value edit"
        })
      });

      setValueDrafts((current) => {
        const next = { ...current };
        delete next[key];
        return next;
      });
      setSavedTimestamp(lineItemId, selectedPeriod);

      await refreshValues(selectedSnapshotId, selectedGroupId);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save value");
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveAllVisibleValues() {
    if (!selectedSnapshotId || !selectedPeriod || isSnapshotLocked) return;

    setBusy(true);
    setError(null);

    try {
      const savedKeys: string[] = [];
      const savedRows: string[] = [];
      await Promise.all(
        visibleLineItems.map(async (lineItem) => {
          const key = valueDraftKey(lineItem.id, selectedPeriod);
          const draft = getDraftValue(lineItem.id, selectedPeriod);

          await apiJson<ValueRecord>("/api/values/upsert", {
            method: "POST",
            body: JSON.stringify({
              lineItemId: lineItem.id,
              snapshotId: selectedSnapshotId,
              period: selectedPeriod,
              projectedAmount: draft.projectedAmount.trim() ? draft.projectedAmount.trim() : null,
              actualAmount: draft.actualAmount.trim() ? draft.actualAmount.trim() : null,
              note: draft.note.trim() ? draft.note.trim() : null,
              updatedBy: ACTOR_ID,
              reason: "Bulk monthly value edit"
            })
          });
          savedKeys.push(key);
          savedRows.push(lineItem.id);
        })
      );

      if (savedKeys.length > 0) {
        setValueDrafts((current) => {
          const next = { ...current };
          for (const key of savedKeys) {
            delete next[key];
          }
          return next;
        });
      }
      for (const lineItemId of savedRows) {
        setSavedTimestamp(lineItemId, selectedPeriod);
      }

      await refreshValues(selectedSnapshotId, selectedGroupId);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save all visible values");
    } finally {
      setBusy(false);
    }
  }

  function handleCopyProjectedToActual() {
    if (!selectedPeriod || isSnapshotLocked) return;

    for (const lineItem of visibleLineItems) {
      const currentDraft = getDraftValue(lineItem.id, selectedPeriod);
      setDraftField(lineItem.id, selectedPeriod, "actualAmount", currentDraft.projectedAmount);
    }
  }

  function handleCopyPriorMonthProjected() {
    if (!selectedPeriod || isSnapshotLocked) return;
    const prior = previousPeriod(selectedPeriod);
    if (!prior) return;

    for (const lineItem of visibleLineItems) {
      const sourceDraft = getDraftValue(lineItem.id, prior);
      const sourcePersisted = getPersistedValue(lineItem.id, prior);
      const projected = sourceDraft.projectedAmount || sourcePersisted?.projectedAmount || "";
      setDraftField(lineItem.id, selectedPeriod, "projectedAmount", projected);
    }
  }

  return (
    <main className="dashboard-shell">
      <header className="dashboard-header">
        <p className="eyebrow">Sukut Properties</p>
        <h1>Cash Flow Admin Control Center</h1>
        <p className="subhead">
          Manage sectors, non-operating sections, and projection line items with audit-safe edits.
        </p>
      </header>

      <section className="toolbar card">
        <label className="switch-row">
          <input
            type="checkbox"
            checked={includeInactive}
            onChange={(event) => setIncludeInactive(event.target.checked)}
          />
          <span>Include archived records</span>
        </label>
        <button className="ghost-btn" disabled={loading || busy} onClick={() => void loadData()}>
          Refresh
        </button>
      </section>

      {error ? <p className="error-banner">{error}</p> : null}

      <section className="grid-layout">
        <article className="card panel">
          <div className="panel-head">
            <h2>Groups</h2>
            <p>{groups.length} loaded</p>
          </div>

          <div className="create-form">
            <input
              value={newGroupName}
              onChange={(event) => setNewGroupName(event.target.value)}
              placeholder="New group name"
            />
            <select
              value={newGroupType}
              onChange={(event) => setNewGroupType(event.target.value as GroupType)}
            >
              {groupTypeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <input
              type="number"
              value={newGroupSortOrder}
              onChange={(event) => setNewGroupSortOrder(Number(event.target.value) || 0)}
              placeholder="Sort"
            />
            <button
              disabled={busy || !newGroupName.trim()}
              onClick={() => void handleCreateGroup()}
            >
              Add Group
            </button>
          </div>

          <div className="list-stack">
            {loading ? <p>Loading groups...</p> : null}
            {!loading && groups.length === 0 ? <p>No groups found.</p> : null}
            {groups.map((group) => {
              const draft = editingGroups[group.id] ?? group;
              const isSelected = group.id === selectedGroupId;
              return (
                <div key={group.id} className={`row-card ${isSelected ? "selected" : ""}`}>
                  <button className="link-btn" onClick={() => void loadData(group.id)}>
                    Open
                  </button>
                  <input
                    value={draft.name}
                    onChange={(event) =>
                      setEditingGroups((current) => ({
                        ...current,
                        [group.id]: { ...draft, name: event.target.value }
                      }))
                    }
                  />
                  <select
                    value={draft.groupType}
                    onChange={(event) =>
                      setEditingGroups((current) => ({
                        ...current,
                        [group.id]: { ...draft, groupType: event.target.value as GroupType }
                      }))
                    }
                  >
                    {groupTypeOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    value={draft.sortOrder}
                    onChange={(event) =>
                      setEditingGroups((current) => ({
                        ...current,
                        [group.id]: { ...draft, sortOrder: Number(event.target.value) || 0 }
                      }))
                    }
                  />
                  <button disabled={busy} onClick={() => void handleSaveGroup(group.id)}>
                    Save
                  </button>
                  <button
                    className="danger"
                    disabled={busy}
                    onClick={() => void handleArchiveGroup(group.id)}
                  >
                    Archive
                  </button>
                </div>
              );
            })}
          </div>
        </article>

        <article className="card panel">
          <div className="panel-head">
            <h2>Line Items</h2>
            <p>{selectedGroup ? `Group: ${selectedGroup.name}` : "Select a group"}</p>
          </div>

          <div className="line-item-controls">
            <input
              value={lineItemQuery}
              onChange={(event) => setLineItemQuery(event.target.value)}
              placeholder="Search line items"
              disabled={!selectedGroupId}
            />
            <select
              value={lineItemMethodFilter}
              onChange={(event) =>
                setLineItemMethodFilter(event.target.value as ProjectionMethod | "all")
              }
              disabled={!selectedGroupId}
            >
              <option value="all">All methods</option>
              {projectionMethodOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="create-form">
            <input
              value={newLineItemLabel}
              onChange={(event) => setNewLineItemLabel(event.target.value)}
              placeholder="New line item label"
              disabled={!selectedGroupId}
            />
            <select
              value={newLineItemMethod}
              onChange={(event) => setNewLineItemMethod(event.target.value as ProjectionMethod)}
              disabled={!selectedGroupId}
            >
              {projectionMethodOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {newLineItemMethod === "annual_spread" ? (
              <input
                value={newLineItemAnnualTotal}
                onChange={(event) => setNewLineItemAnnualTotal(event.target.value)}
                placeholder="Annual total"
                disabled={!selectedGroupId}
              />
            ) : null}
            {newLineItemMethod === "prior_year_pct" ? (
              <input
                value={newLineItemPctChange}
                onChange={(event) => setNewLineItemPctChange(event.target.value)}
                placeholder="Pct change (e.g. 5)"
                disabled={!selectedGroupId}
              />
            ) : null}
            {newLineItemMethod === "custom_formula" ? (
              <input
                value={newLineItemFormula}
                onChange={(event) => setNewLineItemFormula(event.target.value)}
                placeholder="Formula"
                disabled={!selectedGroupId}
              />
            ) : null}
            <input
              type="number"
              value={newLineItemSortOrder}
              onChange={(event) => setNewLineItemSortOrder(Number(event.target.value) || 0)}
              placeholder="Sort"
              disabled={!selectedGroupId}
            />
            <button
              disabled={
                busy ||
                !selectedGroupId ||
                !newLineItemLabel.trim() ||
                !hasRequiredProjectionParams(newLineItemMethod, {
                  annualTotal: newLineItemAnnualTotal,
                  pctChange: newLineItemPctChange,
                  formula: newLineItemFormula
                })
              }
              onClick={() => void handleCreateLineItem()}
            >
              Add Line Item
            </button>
          </div>

          <div className="list-stack">
            {selectedGroupId && visibleLineItems.length === 0 ? (
              <p>No line items for this group.</p>
            ) : null}
            {!selectedGroupId ? <p>Select a group to manage line items.</p> : null}
            {visibleLineItems.map((lineItem) => {
              const draft = editingLineItems[lineItem.id] ?? lineItem;
              return (
                <div key={lineItem.id} className="row-card">
                  <input
                    value={draft.label}
                    onChange={(event) =>
                      setEditingLineItems((current) => ({
                        ...current,
                        [lineItem.id]: { ...draft, label: event.target.value }
                      }))
                    }
                  />
                  <select
                    value={draft.projectionMethod}
                    onChange={(event) =>
                      setEditingLineItems((current) => ({
                        ...current,
                        [lineItem.id]: {
                          ...draft,
                          projectionMethod: event.target.value as ProjectionMethod
                        }
                      }))
                    }
                  >
                    {projectionMethodOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  {draft.projectionMethod === "annual_spread" ? (
                    <input
                      value={
                        lineItemAnnualTotals[lineItem.id] ??
                        getProjectionParam(draft.projectionParams, "annualTotal")
                      }
                      onChange={(event) =>
                        setLineItemAnnualTotals((current) => ({
                          ...current,
                          [lineItem.id]: event.target.value
                        }))
                      }
                      placeholder="Annual total"
                    />
                  ) : null}
                  {draft.projectionMethod === "prior_year_pct" ? (
                    <input
                      value={
                        lineItemPctChanges[lineItem.id] ??
                        getProjectionParam(draft.projectionParams, "pctChange")
                      }
                      onChange={(event) =>
                        setLineItemPctChanges((current) => ({
                          ...current,
                          [lineItem.id]: event.target.value
                        }))
                      }
                      placeholder="Pct change"
                    />
                  ) : null}
                  {draft.projectionMethod === "custom_formula" ? (
                    <input
                      value={
                        lineItemFormulas[lineItem.id] ??
                        getProjectionParam(draft.projectionParams, "formula")
                      }
                      onChange={(event) =>
                        setLineItemFormulas((current) => ({
                          ...current,
                          [lineItem.id]: event.target.value
                        }))
                      }
                      placeholder="Formula"
                    />
                  ) : null}
                  <input
                    type="number"
                    value={draft.sortOrder}
                    onChange={(event) =>
                      setEditingLineItems((current) => ({
                        ...current,
                        [lineItem.id]: { ...draft, sortOrder: Number(event.target.value) || 0 }
                      }))
                    }
                  />
                  <button disabled={busy} onClick={() => void handleSaveLineItem(lineItem.id)}>
                    Save
                  </button>
                  <button
                    className="danger"
                    disabled={busy}
                    onClick={() => void handleArchiveLineItem(lineItem.id)}
                  >
                    Archive
                  </button>
                  <p className="row-meta">
                    {draft.projectionMethod === "annual_spread"
                      ? `Annual total: ${
                          lineItemAnnualTotals[lineItem.id] ??
                          getProjectionParam(draft.projectionParams, "annualTotal") ??
                          "n/a"
                        }`
                      : null}
                    {draft.projectionMethod === "prior_year_pct"
                      ? `Pct change: ${
                          lineItemPctChanges[lineItem.id] ??
                          getProjectionParam(draft.projectionParams, "pctChange") ??
                          "n/a"
                        }`
                      : null}
                    {draft.projectionMethod === "custom_formula"
                      ? `Formula: ${
                          lineItemFormulas[lineItem.id] ??
                          getProjectionParam(draft.projectionParams, "formula") ??
                          "n/a"
                        }`
                      : null}
                  </p>
                </div>
              );
            })}
          </div>
        </article>
      </section>

      <section className="snapshot-section card panel">
        <div className="panel-head">
          <h2>Snapshots</h2>
          <p>{snapshots.length} total</p>
        </div>

        <div className="create-form snapshot-form">
          <input
            value={newSnapshotName}
            onChange={(event) => setNewSnapshotName(event.target.value)}
            placeholder="Snapshot name"
          />
          <input
            value={newSnapshotMonth}
            onChange={(event) => setNewSnapshotMonth(event.target.value)}
            placeholder="YYYY-MM"
          />
          <button
            disabled={busy || !newSnapshotName.trim() || !newSnapshotMonth.trim()}
            onClick={() => void handleCreateSnapshot()}
          >
            Create Snapshot
          </button>
        </div>

        <div className="create-form snapshot-form">
          <input
            value={copySnapshotName}
            onChange={(event) => setCopySnapshotName(event.target.value)}
            placeholder="Copied snapshot name"
            disabled={!selectedSnapshotId}
          />
          <input
            value={copySnapshotMonth}
            onChange={(event) => setCopySnapshotMonth(event.target.value)}
            placeholder="YYYY-MM"
            disabled={!selectedSnapshotId}
          />
          <button
            disabled={
              busy || !selectedSnapshotId || !copySnapshotName.trim() || !copySnapshotMonth.trim()
            }
            onClick={() => void handleCopySnapshot()}
          >
            Copy From Selected
          </button>
        </div>

        <div className="list-stack">
          {snapshots.length === 0 ? <p>No snapshots available.</p> : null}
          {snapshots.map((snapshot) => {
            const isSelected = selectedSnapshotId === snapshot.id;
            const isLocked = snapshot.status === "locked";
            return (
              <div key={snapshot.id} className={`snapshot-row ${isSelected ? "selected" : ""}`}>
                <button className="link-btn" onClick={() => setSelectedSnapshotId(snapshot.id)}>
                  Select
                </button>
                <span className="snapshot-name">{snapshot.name}</span>
                <span className={`snapshot-chip ${isLocked ? "locked" : "draft"}`}>
                  {snapshot.status}
                </span>
                <span className="snapshot-month">{snapshot.asOfMonth.slice(0, 7)}</span>
                {isLocked ? (
                  <button disabled={busy} onClick={() => void handleUnlockSnapshot(snapshot.id)}>
                    Unlock
                  </button>
                ) : (
                  <button disabled={busy} onClick={() => void handleLockSnapshot(snapshot.id)}>
                    Lock
                  </button>
                )}
              </div>
            );
          })}
        </div>
        {selectedSnapshot ? (
          <p className="snapshot-selected-note">
            Selected snapshot: <strong>{selectedSnapshot.name}</strong> ({selectedSnapshot.status})
          </p>
        ) : null}
      </section>

      <section className="value-entry-section card panel">
        <div className="panel-head">
          <h2>Monthly Entry</h2>
          <p>
            {selectedSnapshot ? `Snapshot: ${selectedSnapshot.name}` : "Select snapshot"} /
            {selectedGroup ? ` Group: ${selectedGroup.name}` : " Select group"}
          </p>
        </div>

        <div className="value-entry-controls">
          <select
            value={selectedPeriod}
            onChange={(event) => setSelectedPeriod(event.target.value)}
            disabled={!periodOptions.length}
          >
            {periodOptions.map((period) => (
              <option key={period} value={period}>
                {period}
              </option>
            ))}
          </select>
          <span className={`snapshot-chip ${isSnapshotLocked ? "locked" : "draft"}`}>
            {isSnapshotLocked ? "Locked (read-only)" : "Draft (editable)"}
          </span>
          <button
            disabled={
              busy || !selectedPeriod || !selectedSnapshotId || !selectedGroupId || isSnapshotLocked
            }
            onClick={() => void handleSaveAllVisibleValues()}
          >
            Save All Visible
          </button>
          <button
            disabled={!selectedPeriod || !selectedSnapshotId || !selectedGroupId || isSnapshotLocked}
            onClick={handleCopyProjectedToActual}
          >
            Copy Projected -&gt; Actual
          </button>
          <button
            disabled={!selectedPeriod || !selectedSnapshotId || !selectedGroupId || isSnapshotLocked}
            onClick={handleCopyPriorMonthProjected}
          >
            Copy Prior Month -&gt; Projected
          </button>
        </div>

        <div className="list-stack">
              {!selectedSnapshotId || !selectedGroupId ? (
            <p>Select both a snapshot and group to edit monthly values.</p>
          ) : null}
          {selectedSnapshotId && selectedGroupId && visibleLineItems.length === 0 ? (
            <p>No line items available for this filter.</p>
          ) : null}
          {selectedSnapshotId && selectedGroupId
            ? visibleLineItems.map((lineItem) => {
                const draft = getDraftValue(lineItem.id, selectedPeriod);
                const variance = calculateVariance(draft.projectedAmount, draft.actualAmount);
                const dirty = isDraftDirty(lineItem.id, selectedPeriod);
                const saveTime = valueSavedAt[valueDraftKey(lineItem.id, selectedPeriod)];
                return (
                  <div key={lineItem.id} className={`value-row ${dirty ? "dirty" : ""}`}>
                    <p className="value-label">{lineItem.label}</p>
                    <input
                      ref={(node) => {
                        valueInputRefs.current[inputRefKey(lineItem.id, selectedPeriod, "projected")] =
                          node;
                      }}
                      value={draft.projectedAmount}
                      onChange={(event) =>
                        setDraftField(lineItem.id, selectedPeriod, "projectedAmount", event.target.value)
                      }
                      onBlur={(event) =>
                        setDraftField(
                          lineItem.id,
                          selectedPeriod,
                          "projectedAmount",
                          normalizeAmountInput(event.target.value)
                        )
                      }
                      onKeyDown={(event) => handleValueKeyDown(event, lineItem.id, "projected")}
                      placeholder="Projected"
                      disabled={!selectedPeriod || isSnapshotLocked}
                    />
                    <input
                      ref={(node) => {
                        valueInputRefs.current[inputRefKey(lineItem.id, selectedPeriod, "actual")] = node;
                      }}
                      value={draft.actualAmount}
                      onChange={(event) =>
                        setDraftField(lineItem.id, selectedPeriod, "actualAmount", event.target.value)
                      }
                      onBlur={(event) =>
                        setDraftField(
                          lineItem.id,
                          selectedPeriod,
                          "actualAmount",
                          normalizeAmountInput(event.target.value)
                        )
                      }
                      onKeyDown={(event) => handleValueKeyDown(event, lineItem.id, "actual")}
                      placeholder="Actual"
                      disabled={!selectedPeriod || isSnapshotLocked}
                    />
                    <input
                      ref={(node) => {
                        valueInputRefs.current[inputRefKey(lineItem.id, selectedPeriod, "note")] = node;
                      }}
                      value={draft.note}
                      onChange={(event) =>
                        setDraftField(lineItem.id, selectedPeriod, "note", event.target.value)
                      }
                      onKeyDown={(event) => handleValueKeyDown(event, lineItem.id, "note")}
                      placeholder="Note (optional)"
                      disabled={!selectedPeriod || isSnapshotLocked}
                    />
                    <button
                      disabled={busy || !selectedPeriod || isSnapshotLocked}
                      onClick={() => void handleSaveValue(lineItem.id)}
                    >
                      Save Month
                    </button>
                    <p className={`dirty-chip ${dirty ? "dirty-yes" : "dirty-no"}`}>
                      {dirty ? "Unsaved changes" : "Saved"}
                    </p>
                    {saveTime ? <p className="save-time-chip">Last saved: {saveTime}</p> : null}
                    <p
                      className={`variance-chip ${
                        variance?.isMaterial ? "variance-material" : "variance-normal"
                      }`}
                    >
                      {variance
                        ? `Variance: ${variance.delta.toFixed(2)}${
                            variance.pctDelta !== null ? ` (${variance.pctDelta.toFixed(1)}%)` : ""
                          }`
                        : "Variance: n/a"}
                    </p>
                  </div>
                );
              })
            : null}
        </div>
      </section>
    </main>
  );
}
