import type {
  ArchiveLineItemInput,
  CreateLineItemInput,
  ProjectionMethod,
  UpdateLineItemInput
} from "./types";

type HandlerResult = {
  status: number;
  body: { data?: unknown; error?: string };
};

type LineItemServiceLike = {
  list: (input?: { groupId?: string; includeInactive?: boolean }) => Promise<unknown>;
  getById: (lineItemId: string) => Promise<unknown>;
  create: (input: CreateLineItemInput) => Promise<unknown>;
  update: (input: UpdateLineItemInput) => Promise<unknown>;
  archive: (input: ArchiveLineItemInput) => Promise<unknown>;
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
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function getOptionalNumber(payload: Record<string, unknown>, field: string): number | undefined {
  const value = payload[field];
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "number" || Number.isNaN(value)) return undefined;
  return Math.trunc(value);
}

function parseProjectionMethod(value: unknown): ProjectionMethod | null {
  if (
    value === "manual" ||
    value === "annual_spread" ||
    value === "prior_year_pct" ||
    value === "prior_year_flat" ||
    value === "custom_formula"
  ) {
    return value;
  }

  return null;
}

function asErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return "Unexpected error";
}

function isNotFound(error: unknown): boolean {
  const message = asErrorMessage(error).toLowerCase();
  return message.includes("not found") || (message.includes("no") && message.includes("found"));
}

export async function listLineItems(
  service: LineItemServiceLike,
  groupId: string | undefined,
  includeInactive: boolean
): Promise<HandlerResult> {
  try {
    const data = await service.list({ groupId, includeInactive });
    return { status: 200, body: { data } };
  } catch {
    return { status: 500, body: { error: "Failed to list line items" } };
  }
}

export async function getLineItem(
  service: LineItemServiceLike,
  lineItemId: string
): Promise<HandlerResult> {
  if (!lineItemId || lineItemId.trim().length === 0) {
    return { status: 400, body: { error: "lineItemId is required" } };
  }

  try {
    const data = await service.getById(lineItemId);
    return { status: 200, body: { data } };
  } catch (error) {
    if (isNotFound(error)) {
      return { status: 404, body: { error: "Line item not found" } };
    }

    return { status: 500, body: { error: "Failed to fetch line item" } };
  }
}

export async function createLineItem(
  service: LineItemServiceLike,
  payload: unknown
): Promise<HandlerResult> {
  if (!isRecord(payload)) {
    return { status: 400, body: { error: "Invalid request body" } };
  }

  const groupId = getRequiredString(payload, "groupId");
  const label = getRequiredString(payload, "label");
  const projectionMethod =
    payload.projectionMethod === undefined
      ? undefined
      : parseProjectionMethod(payload.projectionMethod);
  const projectionParams = payload.projectionParams;
  const sortOrder = getOptionalNumber(payload, "sortOrder");
  const createdBy = getOptionalString(payload, "createdBy");

  if (!groupId || !label) {
    return { status: 400, body: { error: "groupId and label are required" } };
  }

  if (projectionMethod === null) {
    return { status: 400, body: { error: "Invalid projectionMethod" } };
  }

  try {
    const data = await service.create({
      groupId,
      label,
      projectionMethod,
      projectionParams,
      sortOrder,
      createdBy
    });

    return { status: 201, body: { data } };
  } catch (error) {
    const message = asErrorMessage(error);
    if (message.includes("Invalid projectionMethod")) {
      return { status: 400, body: { error: message } };
    }

    return { status: 500, body: { error: "Failed to create line item" } };
  }
}

export async function updateLineItem(
  service: LineItemServiceLike,
  payload: unknown
): Promise<HandlerResult> {
  if (!isRecord(payload)) {
    return { status: 400, body: { error: "Invalid request body" } };
  }

  const lineItemId = getRequiredString(payload, "lineItemId");
  const groupId = getOptionalString(payload, "groupId") ?? undefined;
  const label = getOptionalString(payload, "label") ?? undefined;
  const projectionMethod =
    payload.projectionMethod === undefined
      ? undefined
      : parseProjectionMethod(payload.projectionMethod);
  const projectionParams = payload.projectionParams;
  const sortOrder = getOptionalNumber(payload, "sortOrder");
  const updatedBy = getOptionalString(payload, "updatedBy");
  const reason = getOptionalString(payload, "reason") ?? undefined;

  if (!lineItemId) {
    return { status: 400, body: { error: "lineItemId is required" } };
  }

  if (projectionMethod === null) {
    return { status: 400, body: { error: "Invalid projectionMethod" } };
  }

  if (
    groupId === undefined &&
    label === undefined &&
    projectionMethod === undefined &&
    payload.projectionParams === undefined &&
    sortOrder === undefined
  ) {
    return { status: 400, body: { error: "No updatable fields provided" } };
  }

  try {
    const data = await service.update({
      lineItemId,
      groupId,
      label,
      projectionMethod,
      projectionParams,
      sortOrder,
      updatedBy,
      reason
    });

    return { status: 200, body: { data } };
  } catch (error) {
    const message = asErrorMessage(error);
    if (isNotFound(error)) {
      return { status: 404, body: { error: "Line item not found" } };
    }

    if (message.includes("Invalid projectionMethod")) {
      return { status: 400, body: { error: message } };
    }

    return { status: 500, body: { error: "Failed to update line item" } };
  }
}

export async function archiveLineItem(
  service: LineItemServiceLike,
  payload: unknown
): Promise<HandlerResult> {
  if (!isRecord(payload)) {
    return { status: 400, body: { error: "Invalid request body" } };
  }

  const lineItemId = getRequiredString(payload, "lineItemId");
  const archivedBy = getOptionalString(payload, "archivedBy");
  const reason = getOptionalString(payload, "reason") ?? undefined;

  if (!lineItemId) {
    return { status: 400, body: { error: "lineItemId is required" } };
  }

  try {
    const data = await service.archive({ lineItemId, archivedBy, reason });
    return { status: 200, body: { data } };
  } catch (error) {
    const message = asErrorMessage(error);
    if (isNotFound(error)) {
      return { status: 404, body: { error: "Line item not found" } };
    }

    if (message.includes("already archived")) {
      return { status: 409, body: { error: message } };
    }

    return { status: 500, body: { error: "Failed to archive line item" } };
  }
}
