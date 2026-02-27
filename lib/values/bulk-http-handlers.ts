import type { BulkField, BulkOperation } from "./bulk-service";
import { bulkUpdateSchema, bulkRestoreSchema, firstZodError } from "@/lib/validations";

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

export async function handleBulkUpdate(
  service: BulkServiceLike,
  payload: unknown
): Promise<HandlerResult> {
  const result = bulkUpdateSchema.safeParse(payload);
  if (!result.success) {
    return { status: 400, body: { error: firstZodError(result.error) } };
  }

  const { snapshotId, groupId, field, operation, operand, preview, reason, updatedBy } =
    result.data;
  const isPreview = preview === true;

  try {
    if (isPreview) {
      const data = await service.preview(snapshotId, groupId ?? null, field, operation, operand);
      return { status: 200, body: { data } };
    }
    const data = await service.apply(
      snapshotId,
      groupId ?? null,
      field,
      operation,
      operand,
      reason!,
      updatedBy ?? null
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
  const result = bulkRestoreSchema.safeParse(payload);
  if (!result.success) {
    return { status: 400, body: { error: firstZodError(result.error) } };
  }

  const { snapshotId, reason, updatedBy, restores } = result.data;
  const normalizedRestores = restores.map((r) => ({
    lineItemId: r.lineItemId,
    period: r.period,
    projectedAmount: r.projectedAmount !== undefined ? (r.projectedAmount ?? null) : null,
    actualAmount: r.actualAmount !== undefined ? (r.actualAmount ?? null) : null
  }));

  try {
    const data = await service.restore(snapshotId, normalizedRestores, reason, updatedBy ?? null);
    return { status: 200, body: { data } };
  } catch {
    return { status: 500, body: { error: "Bulk restore failed" } };
  }
}
