import type {
  ArchiveLineItemInput,
  CreateLineItemInput,
  ProjectionMethod,
  UpdateLineItemInput
} from "./types";
import {
  createLineItemSchema,
  updateLineItemSchema,
  archiveLineItemSchema,
  firstZodError
} from "@/lib/validations";

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
  const result = createLineItemSchema.safeParse(payload);
  if (!result.success) {
    return { status: 400, body: { error: firstZodError(result.error) } };
  }

  const { groupId, label, projectionMethod, projectionParams, sortOrder, createdBy } = result.data;
  try {
    const data = await service.create({
      groupId,
      label,
      projectionMethod: projectionMethod as ProjectionMethod | undefined,
      projectionParams,
      sortOrder,
      createdBy: createdBy ?? null
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
  const result = updateLineItemSchema.safeParse(payload);
  if (!result.success) {
    return { status: 400, body: { error: firstZodError(result.error) } };
  }

  const {
    lineItemId,
    groupId,
    label,
    projectionMethod,
    projectionParams,
    sortOrder,
    updatedBy,
    reason
  } = result.data;
  try {
    const data = await service.update({
      lineItemId,
      groupId,
      label,
      projectionMethod: projectionMethod as ProjectionMethod | undefined,
      projectionParams,
      sortOrder,
      updatedBy: updatedBy ?? null,
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
  const result = archiveLineItemSchema.safeParse(payload);
  if (!result.success) {
    return { status: 400, body: { error: firstZodError(result.error) } };
  }

  const { lineItemId, archivedBy, reason } = result.data;
  try {
    const data = await service.archive({ lineItemId, archivedBy: archivedBy ?? null, reason });
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
