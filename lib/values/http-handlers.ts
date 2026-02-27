import type { ListValuesInput, UpsertValueInput } from "./types";
import { MaterialChangeRequiredError } from "./threshold";
import { upsertValueSchema, firstZodError } from "@/lib/validations";

type HandlerResult = {
  status: number;
  body: Record<string, unknown>;
};

type ValueServiceLike = {
  list: (input: ListValuesInput) => Promise<unknown>;
  upsert: (input: UpsertValueInput) => Promise<unknown>;
};

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

export async function upsertValue(
  service: ValueServiceLike,
  payload: unknown
): Promise<HandlerResult> {
  const result = upsertValueSchema.safeParse(payload);
  if (!result.success) {
    return { status: 400, body: { error: firstZodError(result.error) } };
  }

  const { lineItemId, snapshotId, period, projectedAmount, actualAmount, note, updatedBy, reason } =
    result.data;
  try {
    const data = await service.upsert({
      lineItemId,
      snapshotId,
      period,
      projectedAmount: projectedAmount ?? null,
      actualAmount: actualAmount ?? null,
      note: note ?? null,
      updatedBy: updatedBy ?? null,
      reason
    });
    return { status: 200, body: { data } };
  } catch (error) {
    if (error instanceof MaterialChangeRequiredError) {
      return {
        status: 422,
        body: {
          error: "reason_required",
          field: error.field,
          threshold: error.threshold,
          delta: error.delta
        }
      };
    }
    if (error instanceof Error && error.message === "Cannot edit values in a locked snapshot") {
      return { status: 409, body: { error: error.message } };
    }
    return { status: 500, body: { error: "Failed to upsert value" } };
  }
}
