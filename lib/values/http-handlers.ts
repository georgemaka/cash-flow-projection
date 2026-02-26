import type { ListValuesInput, UpsertValueInput } from "./types";

type HandlerResult = {
  status: number;
  body: { data?: unknown; error?: string };
};

type ValueServiceLike = {
  list: (input: ListValuesInput) => Promise<unknown>;
  upsert: (input: UpsertValueInput) => Promise<unknown>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getRequiredString(payload: Record<string, unknown>, field: string): string | null {
  const value = payload[field];
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function getOptionalString(payload: Record<string, unknown>, field: string): string | null {
  const value = payload[field];
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") return null;
  return value;
}

function isYearMonth(value: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

export async function listValues(
  service: ValueServiceLike,
  snapshotId: string | null,
  groupId?: string
): Promise<HandlerResult> {
  if (!snapshotId || snapshotId.trim().length === 0) {
    return { status: 400, body: { error: "snapshotId is required" } };
  }

  try {
    const data = await service.list({ snapshotId, groupId });
    return { status: 200, body: { data } };
  } catch {
    return { status: 500, body: { error: "Failed to list values" } };
  }
}

export async function upsertValue(service: ValueServiceLike, payload: unknown): Promise<HandlerResult> {
  if (!isRecord(payload)) {
    return { status: 400, body: { error: "Invalid request body" } };
  }

  const lineItemId = getRequiredString(payload, "lineItemId");
  const snapshotId = getRequiredString(payload, "snapshotId");
  const period = getRequiredString(payload, "period");
  const updatedBy = getOptionalString(payload, "updatedBy");
  const projectedAmount = getOptionalString(payload, "projectedAmount");
  const actualAmount = getOptionalString(payload, "actualAmount");
  const note = getOptionalString(payload, "note");
  const reason = getOptionalString(payload, "reason") ?? undefined;

  if (!lineItemId || !snapshotId || !period) {
    return { status: 400, body: { error: "lineItemId, snapshotId, and period are required" } };
  }

  if (!isYearMonth(period)) {
    return { status: 400, body: { error: "period must be in YYYY-MM format" } };
  }

  try {
    const data = await service.upsert({
      lineItemId,
      snapshotId,
      period,
      projectedAmount,
      actualAmount,
      note,
      updatedBy,
      reason
    });

    return { status: 200, body: { data } };
  } catch (error) {
    if (error instanceof Error && error.message.includes("period must be in YYYY-MM format")) {
      return { status: 400, body: { error: error.message } };
    }

    return { status: 500, body: { error: "Failed to upsert value" } };
  }
}