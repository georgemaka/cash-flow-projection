import Decimal from "decimal.js";
import type { PrismaClient } from "@prisma/client";

type TxClient = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

import type { AuditService } from "../audit";
import { isPrismaNotFound, NotFoundError, SourceNotLockedError } from "@/lib/errors";
import { calculateProjections } from "../calculations";
import type { PeriodValue, ProjectionMethod } from "../calculations";
import type {
  OnboardFromTemplateInput,
  TemplateGroupPreview,
  TemplateLineItemPreview,
  TemplatePreview
} from "./types";
import { generateFiscalYearPeriods } from "./types";

/**
 * Template onboarding service.
 *
 * Creates a new fiscal year snapshot from a prior-year locked snapshot.
 * Copies the active group/line-item structure and uses the projection engine
 * to pre-fill projected values. Actuals are NOT copied (ADR-003).
 */
export class TemplateService {
  constructor(
    private prisma: PrismaClient,
    private audit: AuditService
  ) {}

  /**
   * Preview what onboarding will create.
   * Returns the structure that would be copied so admin can review before confirming.
   */
  async preview(sourceSnapshotId: string, targetYear: number): Promise<TemplatePreview> {
    let source;
    try {
      source = await this.prisma.snapshot.findUniqueOrThrow({
        where: { id: sourceSnapshotId }
      });
    } catch (e) {
      if (isPrismaNotFound(e)) {
        throw new NotFoundError(`Snapshot not found: ${sourceSnapshotId}`);
      }
      throw e;
    }

    if (source.status !== "locked") {
      throw new SourceNotLockedError();
    }

    const groups = await this.prisma.group.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      include: {
        lineItems: {
          where: { isActive: true },
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
        }
      }
    });

    // Fetch values from the source snapshot for prior-year totals (active items only)
    const sourceValues = await this.prisma.value.findMany({
      where: { snapshotId: sourceSnapshotId, lineItem: { isActive: true } }
    });

    // Build a map: lineItemId -> sum of actual amounts
    const actualTotals = new Map<string, Decimal>();
    for (const v of sourceValues) {
      if (v.actualAmount !== null) {
        const current = actualTotals.get(v.lineItemId) ?? new Decimal(0);
        actualTotals.set(v.lineItemId, current.plus(new Decimal(String(v.actualAmount))));
      }
    }

    const targetPeriods = generateFiscalYearPeriods(targetYear);
    let totalLineItems = 0;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const groupPreviews: TemplateGroupPreview[] = groups.map((g: any) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const lineItems: TemplateLineItemPreview[] = (g.lineItems as any[]).map((li) => {
        totalLineItems++;
        const total = actualTotals.get(li.id);
        return {
          id: li.id,
          label: li.label,
          projectionMethod: li.projectionMethod,
          projectionParams: li.projectionParams,
          priorYearTotal: total ? total.toFixed(2) : null
        };
      });

      return {
        id: g.id,
        name: g.name,
        groupType: g.groupType,
        sortOrder: g.sortOrder,
        lineItems
      };
    });

    const asOfMonth = source.asOfMonth;
    const asOfStr = `${asOfMonth.getUTCFullYear()}-${String(asOfMonth.getUTCMonth() + 1).padStart(2, "0")}`;

    return {
      sourceSnapshot: {
        id: source.id,
        name: source.name,
        asOfMonth: asOfStr
      },
      targetYear,
      targetPeriods,
      groups: groupPreviews,
      summary: {
        totalGroups: groups.length,
        totalLineItems,
        totalValues: totalLineItems * targetPeriods.length
      }
    };
  }

  /**
   * Execute template onboarding: create a new snapshot pre-filled with projections.
   *
   * Steps:
   * 1. Validate source snapshot is locked
   * 2. Create new draft snapshot
   * 3. For each active line item, run projection engine and create Value records
   * 4. Audit log the creation
   */
  async onboard(input: OnboardFromTemplateInput) {
    let source;
    try {
      source = await this.prisma.snapshot.findUniqueOrThrow({
        where: { id: input.sourceSnapshotId }
      });
    } catch (e) {
      if (isPrismaNotFound(e)) {
        throw new NotFoundError(`Snapshot not found: ${input.sourceSnapshotId}`);
      }
      throw e;
    }

    if (source.status !== "locked") {
      throw new SourceNotLockedError();
    }

    const targetPeriods = generateFiscalYearPeriods(input.targetYear);
    const asOfMonth = `${input.targetYear}-12`;

    // Fetch active groups + line items
    const groups = await this.prisma.group.findMany({
      where: { isActive: true },
      include: {
        lineItems: {
          where: { isActive: true },
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
        }
      }
    });

    // Fetch source snapshot values for prior-year-based methods (active items only)
    const sourceValues = await this.prisma.value.findMany({
      where: { snapshotId: source.id, lineItem: { isActive: true } }
    });

    // Build prior year values map: lineItemId -> PeriodValue[]
    const priorValuesByItem = new Map<string, PeriodValue[]>();
    for (const v of sourceValues) {
      if (!priorValuesByItem.has(v.lineItemId)) {
        priorValuesByItem.set(v.lineItemId, []);
      }
      const period = v.period;
      const periodStr = `${period.getUTCFullYear()}-${String(period.getUTCMonth() + 1).padStart(2, "0")}`;
      priorValuesByItem.get(v.lineItemId)!.push({
        period: periodStr,
        amount: v.actualAmount !== null ? String(v.actualAmount) : null
      });
    }

    // Execute in a transaction
    const result = await this.prisma.$transaction(async (tx: TxClient) => {
      // Create new snapshot
      const newSnapshot = await tx.snapshot.create({
        data: {
          name: input.name,
          asOfMonth: new Date(Date.UTC(input.targetYear, 11, 1)), // December of target year
          status: "draft",
          createdBy: input.createdBy
        }
      });

      // Generate projected values for each line item
      const valueRecords: Array<{
        lineItemId: string;
        snapshotId: string;
        period: Date;
        projectedAmount: Decimal | null;
        actualAmount: null;
        note: null;
        updatedBy: string;
      }> = [];

      for (const group of groups) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        for (const lineItem of group.lineItems as any[]) {
          const method = lineItem.projectionMethod as ProjectionMethod;
          const params = lineItem.projectionParams ?? {};
          const priorYearValues = priorValuesByItem.get(lineItem.id) ?? [];

          const projectionResult = calculateProjections({
            method,
            params,
            targetPeriods,
            priorYearValues
          });

          for (const pv of projectionResult.values) {
            const [year, month] = pv.period.split("-").map(Number);
            valueRecords.push({
              lineItemId: lineItem.id,
              snapshotId: newSnapshot.id,
              period: new Date(Date.UTC(year, month - 1, 1)),
              projectedAmount: pv.projectedAmount !== null ? new Decimal(pv.projectedAmount) : null,
              actualAmount: null,
              note: null,
              updatedBy: input.createdBy
            });
          }
        }
      }

      if (valueRecords.length > 0) {
        await tx.value.createMany({
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          data: valueRecords as any
        });
      }

      return newSnapshot;
    });

    await this.audit.logCreate({
      userId: input.createdBy,
      tableName: "Snapshot",
      recordId: result.id,
      fields: {
        name: input.name,
        targetYear: String(input.targetYear),
        status: "draft",
        onboardedFrom: input.sourceSnapshotId,
        totalGroups: String(groups.length),
        totalLineItems: String(
          groups.reduce(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (sum: number, g: any) => sum + (g.lineItems?.length ?? 0),
            0
          )
        )
      },
      source: "ui_edit"
    });

    return result;
  }
}
