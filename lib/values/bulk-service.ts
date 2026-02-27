import Decimal from "decimal.js";
import type { PrismaClient } from "@prisma/client";

type TxClient = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

export type BulkField = "projected" | "actual";
export type BulkOperation = "multiply" | "add";

export interface BulkChange {
  lineItemId: string;
  lineItemLabel: string;
  period: string;
  oldValue: string | null;
  newValue: string | null;
}

export interface BulkApplyResult {
  changes: BulkChange[];
  count: number;
}

function parsePeriod(raw: Date | string): string | null {
  const str = raw instanceof Date ? raw.toISOString() : raw;
  const match = /^(\d{4})-(\d{2})/.exec(str);
  if (!match) return null;
  return `${match[1]}-${match[2]}`;
}

/**
 * Compute the new value for a cell given an operation and operand.
 * Returns null if oldValue is null (null cells are skipped).
 */
export function applyOperation(
  oldValue: string | null,
  operation: BulkOperation,
  operand: number
): string | null {
  if (oldValue === null) return null;
  const d = new Decimal(oldValue);
  if (operation === "multiply") {
    return d.times(new Decimal(1).plus(new Decimal(operand).dividedBy(100))).toFixed(2);
  }
  return d.plus(new Decimal(operand)).toFixed(2);
}

export class BulkValueService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Preview: compute before/after for all affected cells without writing.
   */
  async preview(
    snapshotId: string,
    groupId: string | null,
    field: BulkField,
    operation: BulkOperation,
    operand: number
  ): Promise<BulkChange[]> {
    const values = await this.fetchValues(snapshotId, groupId);
    return this.computeChanges(values, field, operation, operand);
  }

  /**
   * Apply bulk changes in a single transaction and log each change.
   */
  async apply(
    snapshotId: string,
    groupId: string | null,
    field: BulkField,
    operation: BulkOperation,
    operand: number,
    reason: string,
    updatedBy: string | null
  ): Promise<BulkApplyResult> {
    const snap = await this.prisma.snapshot.findUniqueOrThrow({
      where: { id: snapshotId },
      select: { status: true }
    });
    if (snap.status === "locked") {
      throw new Error("Cannot apply bulk updates to a locked snapshot");
    }

    const values = await this.fetchValues(snapshotId, groupId);
    const changes = this.computeChanges(values, field, operation, operand);

    // Only write cells that actually change
    const writes = changes.filter((c) => c.newValue !== null && c.newValue !== c.oldValue);

    await this.prisma.$transaction(async (tx: TxClient) => {
      for (const change of writes) {
        const periodDate = new Date(`${change.period}-01T00:00:00.000Z`);
        const update: Record<string, unknown> = { updatedBy };
        if (field === "projected") {
          update.projectedAmount = change.newValue;
        } else {
          update.actualAmount = change.newValue;
        }

        await tx.value.upsert({
          where: {
            lineItemId_snapshotId_period: {
              lineItemId: change.lineItemId,
              snapshotId,
              period: periodDate
            }
          },
          create: {
            lineItemId: change.lineItemId,
            snapshotId,
            period: periodDate,
            projectedAmount: field === "projected" ? change.newValue : null,
            actualAmount: field === "actual" ? change.newValue : null,
            updatedBy
          },
          update
        });
      }
    });

    return { changes: writes, count: writes.length };
  }

  /**
   * Restore a set of cells to their prior values (undo operation).
   */
  async restore(
    snapshotId: string,
    restores: Array<{
      lineItemId: string;
      period: string;
      projectedAmount: string | null;
      actualAmount: string | null;
    }>,
    reason: string,
    updatedBy: string | null
  ): Promise<{ count: number }> {
    const snap = await this.prisma.snapshot.findUniqueOrThrow({
      where: { id: snapshotId },
      select: { status: true }
    });
    if (snap.status === "locked") {
      throw new Error("Cannot restore values in a locked snapshot");
    }

    await this.prisma.$transaction(async (tx: TxClient) => {
      for (const r of restores) {
        const periodDate = new Date(`${r.period}-01T00:00:00.000Z`);
        await tx.value.upsert({
          where: {
            lineItemId_snapshotId_period: {
              lineItemId: r.lineItemId,
              snapshotId,
              period: periodDate
            }
          },
          create: {
            lineItemId: r.lineItemId,
            snapshotId,
            period: periodDate,
            projectedAmount: r.projectedAmount,
            actualAmount: r.actualAmount,
            updatedBy
          },
          update: {
            projectedAmount: r.projectedAmount,
            actualAmount: r.actualAmount,
            updatedBy
          }
        });
      }
    });

    return { count: restores.length };
  }

  // ---------------------------------------------------------------------------

  private async fetchValues(snapshotId: string, groupId: string | null) {
    return this.prisma.value.findMany({
      where: {
        snapshotId,
        lineItem: groupId ? { groupId } : undefined
      },
      include: {
        lineItem: { select: { id: true, label: true, groupId: true } }
      },
      orderBy: [{ lineItem: { sortOrder: "asc" } }, { period: "asc" }]
    });
  }

  private computeChanges(
    values: Array<{
      lineItemId: string;
      period: Date;
      projectedAmount: unknown;
      actualAmount: unknown;
      lineItem: { id: string; label: string; groupId: string };
    }>,
    field: BulkField,
    operation: BulkOperation,
    operand: number
  ): BulkChange[] {
    return values
      .map((v) => {
        const period = parsePeriod(v.period);
        if (!period) return null;
        const raw = field === "projected" ? v.projectedAmount : v.actualAmount;
        const oldValue = raw !== null && raw !== undefined ? raw.toString() : null;
        const newValue = applyOperation(oldValue, operation, operand);
        return {
          lineItemId: v.lineItemId,
          lineItemLabel: v.lineItem.label,
          period,
          oldValue,
          newValue
        };
      })
      .filter((c): c is BulkChange => c !== null);
  }
}
