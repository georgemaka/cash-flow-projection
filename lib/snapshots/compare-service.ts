import Decimal from "decimal.js";
import type { PrismaClient } from "@prisma/client";
import { isPrismaNotFound, NotFoundError } from "@/lib/errors";

export interface CompareCellData {
  aProjected: string | null;
  aActual: string | null;
  bProjected: string | null;
  bActual: string | null;
  /** b.projected − a.projected (null when both are absent) */
  projectedDelta: string | null;
  /** b.actual − a.actual (null when both are absent) */
  actualDelta: string | null;
}

export interface CompareRowData {
  lineItemId: string;
  label: string;
  projectionMethod: string;
  groupId: string;
  /** Values keyed by YYYY-MM period string */
  cells: Record<string, CompareCellData>;
}

export interface CompareGroupData {
  id: string;
  name: string;
  groupType: string;
  sortOrder: number;
  rows: CompareRowData[];
}

export interface SnapshotCompareResult {
  snapshotA: { id: string; name: string; status: string };
  snapshotB: { id: string; name: string; status: string };
  periods: string[];
  groups: CompareGroupData[];
}

function extractPeriod(raw: Date | string): string | null {
  const str = raw instanceof Date ? raw.toISOString() : raw;
  const match = /^(\d{4})-(\d{2})/.exec(str);
  if (!match) return null;
  return `${match[1]}-${match[2]}`;
}

/**
 * Compute b − a as a fixed-precision string.
 * Treats null as zero for arithmetic, but returns null when both inputs are null.
 */
export function computeDelta(a: string | null, b: string | null): string | null {
  if (a === null && b === null) return null;
  const da = a !== null ? new Decimal(a) : new Decimal(0);
  const db = b !== null ? new Decimal(b) : new Decimal(0);
  return db.minus(da).toFixed(2);
}

export class CompareService {
  constructor(private prisma: PrismaClient) {}

  async compare(snapshotAId: string, snapshotBId: string): Promise<SnapshotCompareResult> {
    try {
      await Promise.all([
        this.prisma.snapshot.findUniqueOrThrow({ where: { id: snapshotAId } }),
        this.prisma.snapshot.findUniqueOrThrow({ where: { id: snapshotBId } })
      ]);
    } catch (e) {
      if (isPrismaNotFound(e)) {
        throw new NotFoundError("One or both snapshots not found");
      }
      throw e;
    }

    const [snapA, snapB, valuesA, valuesB, groups] = await Promise.all([
      this.prisma.snapshot.findUniqueOrThrow({ where: { id: snapshotAId } }),
      this.prisma.snapshot.findUniqueOrThrow({ where: { id: snapshotBId } }),
      this.prisma.value.findMany({
        where: { snapshotId: snapshotAId },
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
      }),
      this.prisma.value.findMany({
        where: { snapshotId: snapshotBId },
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
      }),
      this.prisma.group.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } })
    ]);

    // Collect periods from both snapshots
    const periodSet = new Set<string>();
    for (const v of [...valuesA, ...valuesB]) {
      const p = extractPeriod(v.period);
      if (p) periodSet.add(p);
    }
    const periods = Array.from(periodSet).sort();

    // Build per-snapshot lookup: lineItemId -> period -> value
    const buildLookup = (
      values: Array<{
        lineItemId: string;
        period: Date;
        projectedAmount: unknown;
        actualAmount: unknown;
      }>
    ) => {
      const map = new Map<
        string,
        Map<string, { projectedAmount: unknown; actualAmount: unknown }>
      >();
      for (const v of values) {
        const p = extractPeriod(v.period);
        if (!p) continue;
        if (!map.has(v.lineItemId)) map.set(v.lineItemId, new Map());
        map.get(v.lineItemId)!.set(p, v);
      }
      return map;
    };

    const lookupA = buildLookup(valuesA);
    const lookupB = buildLookup(valuesB);

    // Collect all line items seen in either snapshot
    const lineItemsById = new Map<
      string,
      { id: string; label: string; groupId: string; projectionMethod: string; sortOrder: number }
    >();
    for (const v of [...valuesA, ...valuesB]) {
      if (v.lineItem && !lineItemsById.has(v.lineItemId)) {
        lineItemsById.set(v.lineItemId, {
          id: v.lineItem.id,
          label: v.lineItem.label,
          groupId: v.lineItem.groupId,
          projectionMethod: v.lineItem.projectionMethod,
          sortOrder: v.lineItem.sortOrder
        });
      }
    }

    const toStr = (v: unknown): string | null => {
      if (v === null || v === undefined) return null;
      return v.toString();
    };

    const compareGroups: CompareGroupData[] = groups
      .map((group) => {
        const groupLineItems = Array.from(lineItemsById.values())
          .filter((li) => li.groupId === group.id)
          .sort((a, b) => a.sortOrder - b.sortOrder);

        const rows: CompareRowData[] = groupLineItems.map((li) => {
          const cellsA = lookupA.get(li.id) ?? new Map();
          const cellsB = lookupB.get(li.id) ?? new Map();
          const cells: Record<string, CompareCellData> = {};

          for (const p of periods) {
            const va = cellsA.get(p);
            const vb = cellsB.get(p);
            const aProjected = va ? toStr(va.projectedAmount) : null;
            const aActual = va ? toStr(va.actualAmount) : null;
            const bProjected = vb ? toStr(vb.projectedAmount) : null;
            const bActual = vb ? toStr(vb.actualAmount) : null;
            cells[p] = {
              aProjected,
              aActual,
              bProjected,
              bActual,
              projectedDelta: computeDelta(aProjected, bProjected),
              actualDelta: computeDelta(aActual, bActual)
            };
          }

          return {
            lineItemId: li.id,
            label: li.label,
            projectionMethod: li.projectionMethod,
            groupId: li.groupId,
            cells
          };
        });

        return {
          id: group.id,
          name: group.name,
          groupType: group.groupType,
          sortOrder: group.sortOrder,
          rows
        };
      })
      .filter((g: CompareGroupData) => g.rows.length > 0);

    return {
      snapshotA: { id: snapA.id, name: snapA.name, status: snapA.status },
      snapshotB: { id: snapB.id, name: snapB.name, status: snapB.status },
      periods,
      groups: compareGroups
    };
  }
}
