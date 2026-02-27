import type { BulkField, BulkOperation } from "./bulk-service";

type HandlerResult = {
  status: number;
  body: Record<string, unknown>;
};

type BulkServiceLike = {
  preview: (
    snapshotId: string,
    groupId: string | null,
    field: BulkField,
    operation: BulkOperation,
    operand: number
  ) => Promise<unknown>;
  apply: (
    snapshotId: string,
    groupId: string | null,
    field: BulkField,
    operation: BulkOperation,
    operand: number,
    reason: string,
    updatedBy: string | null
  ) => Promise<unknown>;
  restore: (
    snapshotId: string,
    restores: Array<{
      lineItemId: string;
      period: string;
      projectedAmount: string | null;
      actualAmount: string | null;
    }>,
    reason: string,
    updatedBy: string | null
  ) => Promise<unknown>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getString(payload: Record<string, unknown>, field: string): string | null {
  const v = payload[field];
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length > 0 ? t : null;
}

function isValidField(v: string): v is BulkField {
  return v === "projected" || v === "actual";
}

function isValidOperation(v: string): v is BulkOperation {
  return v === "multiply" || v === "add";
}

export async function handleBulkUpdate(
  service: BulkServiceLike,
  payload: unknown
): Promise<HandlerResult> {
  if (!isRecord(payload)) {
    return { status: 400, body: { error: "Invalid request body" } };
  }

  const snapshotId = getString(payload, "snapshotId");
  if (!snapshotId) {
    return { status: 400, body: { error: "snapshotId is required" } };
  }

  const fieldStr = getString(payload, "field");
  if (!fieldStr || !isValidField(fieldStr)) {
    return { status: 400, body: { error: "field must be 'projected' or 'actual'" } };
  }

  const operationStr = getString(payload, "operation");
  if (!operationStr || !isValidOperation(operationStr)) {
    return { status: 400, body: { error: "operation must be 'multiply' or 'add'" } };
  }

  const operand = Number(payload["operand"]);
  if (!isFinite(operand)) {
    return { status: 400, body: { error: "operand must be a finite number" } };
  }

  const groupId = getString(payload, "groupId");
  const isPreview = payload["preview"] === true;
  const reason = getString(payload, "reason");
  const updatedBy = getString(payload, "updatedBy");

  if (!isPreview && !reason) {
    return { status: 400, body: { error: "reason is required when not in preview mode" } };
  }

  try {
    if (isPreview) {
      const data = await service.preview(snapshotId, groupId, fieldStr, operationStr, operand);
      return { status: 200, body: { data } };
    }
    const data = await service.apply(
      snapshotId,
      groupId,
      fieldStr,
      operationStr,
      operand,
      reason!,
      updatedBy
    );
    return { status: 200, body: { data } };
  } catch {
    return { status: 500, body: { error: "Bulk update failed" } };
  }
}

export async function handleBulkRestore(
  service: BulkServiceLike,
  payload: unknown
): Promise<HandlerResult> {
  if (!isRecord(payload)) {
    return { status: 400, body: { error: "Invalid request body" } };
  }

  const snapshotId = getString(payload, "snapshotId");
  if (!snapshotId) {
    return { status: 400, body: { error: "snapshotId is required" } };
  }

  const reason = getString(payload, "reason");
  if (!reason) {
    return { status: 400, body: { error: "reason is required" } };
  }

  const updatedBy = getString(payload, "updatedBy");

  const restoresRaw = payload["restores"];
  if (!Array.isArray(restoresRaw) || restoresRaw.length === 0) {
    return { status: 400, body: { error: "restores array is required and must not be empty" } };
  }

  const restores = restoresRaw
    .filter(isRecord)
    .map((r) => ({
      lineItemId: r["lineItemId"] as string,
      period: r["period"] as string,
      projectedAmount:
        r["projectedAmount"] !== undefined ? (r["projectedAmount"] as string | null) : null,
      actualAmount: r["actualAmount"] !== undefined ? (r["actualAmount"] as string | null) : null
    }))
    .filter((r) => typeof r.lineItemId === "string" && typeof r.period === "string");

  if (restores.length === 0) {
    return { status: 400, body: { error: "No valid restore entries found" } };
  }

  try {
    const data = await service.restore(snapshotId, restores, reason, updatedBy);
    return { status: 200, body: { data } };
  } catch {
    return { status: 500, body: { error: "Bulk restore failed" } };
  }
}
