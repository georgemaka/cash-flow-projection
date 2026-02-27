import Decimal from "decimal.js";
import type { PrismaClient } from "@prisma/client";
import { diffFields, type AuditService } from "../audit";
import type { ListValuesInput, UpsertValueInput } from "./types";
import { checkMaterialChange, MaterialChangeRequiredError } from "./threshold";
import { LockedSnapshotError } from "@/lib/errors";

function parsePeriod(period: string): Date {
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(period);
  if (!match) {
    throw new Error("period must be in YYYY-MM format");
  }

  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, 1));
}

export class ValueService {
  constructor(
    private prisma: PrismaClient,
    private audit: AuditService
  ) {}

  async list(input: ListValuesInput) {
    return this.prisma.value.findMany({
      where: {
        snapshotId: input.snapshotId,
        lineItem: input.groupId ? { groupId: input.groupId } : undefined
      },
      orderBy: [{ period: "asc" }, { createdAt: "asc" }],
      include: {
        lineItem: {
          select: {
            id: true,
            label: true,
            groupId: true,
            projectionMethod: true,
            sortOrder: true
          }
        }
      }
    });
  }

  async upsert(input: UpsertValueInput) {
    const snapshot = await this.prisma.snapshot.findUniqueOrThrow({
      where: { id: input.snapshotId },
      select: { status: true }
    });
    if (snapshot.status === "locked") {
      throw new LockedSnapshotError("Cannot edit values in a locked snapshot");
    }

    const periodDate = parsePeriod(input.period);

    const existing = await this.prisma.value.findUnique({
      where: {
        lineItemId_snapshotId_period: {
          lineItemId: input.lineItemId,
          snapshotId: input.snapshotId,
          period: periodDate
        }
      }
    });

    // ── Material-change threshold check (ADR-005) ──────────────────────────
    // Only applies to existing records. New records are exempt.
    if (existing) {
      // Normalise to Decimal — Prisma returns Decimal objects in production
      // but test mocks may return strings or numbers.
      const toDecimalOrNull = (v: unknown): Decimal | null => {
        if (v === null || v === undefined) return null;
        return new Decimal(v.toString());
      };

      const fieldsToCheck: Array<{
        field: "projectedAmount" | "actualAmount";
        newStr: string | null | undefined;
        oldDecimal: Decimal | null;
      }> = [
        {
          field: "projectedAmount",
          newStr: input.projectedAmount,
          oldDecimal: toDecimalOrNull(existing.projectedAmount)
        },
        {
          field: "actualAmount",
          newStr: input.actualAmount,
          oldDecimal: toDecimalOrNull(existing.actualAmount)
        }
      ];

      for (const { field, newStr, oldDecimal } of fieldsToCheck) {
        if (newStr === undefined) continue; // field not included in this request
        const newDecimal = newStr !== null ? new Decimal(newStr) : null;
        const { isMaterial, threshold, delta } = checkMaterialChange(oldDecimal, newDecimal);
        if (isMaterial && !input.reason) {
          throw new MaterialChangeRequiredError(field, threshold, delta);
        }
      }
    }
    // ──────────────────────────────────────────────────────────────────────

    const upserted = await this.prisma.value.upsert({
      where: {
        lineItemId_snapshotId_period: {
          lineItemId: input.lineItemId,
          snapshotId: input.snapshotId,
          period: periodDate
        }
      },
      create: {
        lineItemId: input.lineItemId,
        snapshotId: input.snapshotId,
        period: periodDate,
        projectedAmount: input.projectedAmount ?? null,
        actualAmount: input.actualAmount ?? null,
        note: input.note ?? null,
        updatedBy: input.updatedBy
      },
      update: {
        projectedAmount: input.projectedAmount ?? null,
        actualAmount: input.actualAmount ?? null,
        note: input.note ?? null,
        updatedBy: input.updatedBy
      }
    });

    if (!existing) {
      await this.audit.logCreate({
        userId: input.updatedBy,
        tableName: "Value",
        recordId: upserted.id,
        fields: {
          lineItemId: upserted.lineItemId,
          snapshotId: upserted.snapshotId,
          period: upserted.period.toISOString(),
          projectedAmount: upserted.projectedAmount?.toString() ?? null,
          actualAmount: upserted.actualAmount?.toString() ?? null,
          note: upserted.note
        },
        source: "ui_edit"
      });

      return upserted;
    }

    const changes = diffFields(
      existing as Record<string, unknown>,
      upserted as Record<string, unknown>,
      ["projectedAmount", "actualAmount", "note", "updatedBy"]
    );

    await this.audit.logUpdate({
      userId: input.updatedBy,
      tableName: "Value",
      recordId: upserted.id,
      changes,
      reason: input.reason,
      source: "ui_edit"
    });

    return upserted;
  }
}

export { parsePeriod };
