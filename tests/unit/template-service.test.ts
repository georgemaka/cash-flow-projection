import { describe, expect, it, vi, beforeEach } from "vitest";
import { TemplateService } from "../../lib/templates";
import { generateFiscalYearPeriods } from "../../lib/templates/types";

// ---------------------------------------------------------------------------
// generateFiscalYearPeriods — pure function tests
// ---------------------------------------------------------------------------
describe("generateFiscalYearPeriods", () => {
  it("generates 12 period strings for a year", () => {
    const periods = generateFiscalYearPeriods(2027);
    expect(periods).toHaveLength(12);
    expect(periods[0]).toBe("2027-01");
    expect(periods[11]).toBe("2027-12");
  });

  it("zero-pads single-digit months", () => {
    const periods = generateFiscalYearPeriods(2027);
    expect(periods[0]).toBe("2027-01");
    expect(periods[8]).toBe("2027-09");
  });

  it("handles different years", () => {
    const periods = generateFiscalYearPeriods(2030);
    expect(periods[5]).toBe("2030-06");
  });
});

// ---------------------------------------------------------------------------
// Mock factories
// ---------------------------------------------------------------------------
function createMockAudit() {
  return {
    logCreate: vi.fn().mockResolvedValue(undefined)
  } as never;
}

const MOCK_SOURCE_SNAPSHOT = {
  id: "snap-2026",
  name: "2026 Cash Flow",
  asOfMonth: new Date("2026-12-01T00:00:00.000Z"),
  status: "locked",
  createdBy: "user-1",
  lockedBy: "admin-1",
  lockedAt: new Date(),
  structureVersionId: "sv-1",
  createdAt: new Date(),
  updatedAt: new Date()
};

const MOCK_DRAFT_SNAPSHOT = {
  ...MOCK_SOURCE_SNAPSHOT,
  id: "snap-2026-draft",
  status: "draft",
  lockedBy: null,
  lockedAt: null,
  structureVersionId: null
};

const MOCK_GROUPS = [
  {
    id: "group-1",
    name: "Rental Income",
    groupType: "sector",
    sortOrder: 0,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    lineItems: [
      {
        id: "li-1",
        groupId: "group-1",
        label: "Base Rent",
        projectionMethod: "annual_spread",
        projectionParams: { annualTotal: "120000" },
        sortOrder: 0,
        isActive: true
      },
      {
        id: "li-2",
        groupId: "group-1",
        label: "Parking Revenue",
        projectionMethod: "prior_year_flat",
        projectionParams: {},
        sortOrder: 1,
        isActive: true
      }
    ]
  },
  {
    id: "group-2",
    name: "Operating Expenses",
    groupType: "sector",
    sortOrder: 1,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    lineItems: [
      {
        id: "li-3",
        groupId: "group-2",
        label: "Utilities",
        projectionMethod: "prior_year_pct",
        projectionParams: { pctChange: 3 },
        sortOrder: 0,
        isActive: true
      }
    ]
  }
];

function makePriorValues() {
  // Create 12 months of values for li-2 (Parking Revenue) and li-3 (Utilities)
  const values = [];
  for (let m = 1; m <= 12; m++) {
    // li-2: $500/month parking
    values.push({
      id: `v-li2-${m}`,
      lineItemId: "li-2",
      snapshotId: "snap-2026",
      period: new Date(Date.UTC(2026, m - 1, 1)),
      projectedAmount: null,
      actualAmount: { toString: () => "500.00" },
      note: null,
      updatedBy: "user-1"
    });
    // li-3: $1000/month utilities
    values.push({
      id: `v-li3-${m}`,
      lineItemId: "li-3",
      snapshotId: "snap-2026",
      period: new Date(Date.UTC(2026, m - 1, 1)),
      projectedAmount: null,
      actualAmount: { toString: () => "1000.00" },
      note: null,
      updatedBy: "user-1"
    });
  }
  return values;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function createMockPrisma(overrides: Record<string, any> = {}): any {
  return {
    snapshot: {
      findUniqueOrThrow: vi.fn().mockResolvedValue(MOCK_SOURCE_SNAPSHOT),
      create: vi.fn().mockResolvedValue({
        id: "snap-2027",
        name: "2027 Cash Flow",
        asOfMonth: new Date("2027-12-01T00:00:00.000Z"),
        status: "draft",
        createdBy: "user-1"
      }),
      ...overrides.snapshot
    },
    group: {
      findMany: vi.fn().mockResolvedValue(MOCK_GROUPS),
      ...overrides.group
    },
    value: {
      findMany: vi.fn().mockResolvedValue(makePriorValues()),
      createMany: vi.fn().mockResolvedValue({ count: 36 }),
      ...overrides.value
    },
    $transaction: vi.fn().mockImplementation(async (fn: Function) => {
      const tx = {
        snapshot: {
          create: vi.fn().mockResolvedValue({
            id: "snap-2027",
            name: "2027 Cash Flow",
            asOfMonth: new Date("2027-12-01T00:00:00.000Z"),
            status: "draft",
            createdBy: "user-1"
          }),
          ...overrides.txSnapshot
        },
        value: {
          createMany: vi.fn().mockResolvedValue({ count: 36 }),
          ...overrides.txValue
        }
      };
      return fn(tx);
    }),
    ...overrides.root
  };
}

// ---------------------------------------------------------------------------
// TemplateService.preview
// ---------------------------------------------------------------------------
describe("TemplateService.preview", () => {
  let prisma: ReturnType<typeof createMockPrisma>;
  let audit: ReturnType<typeof createMockAudit>;
  let service: TemplateService;

  beforeEach(() => {
    prisma = createMockPrisma();
    audit = createMockAudit();
    service = new TemplateService(prisma, audit);
  });

  it("returns preview with groups, line items, and summary", async () => {
    const preview = await service.preview("snap-2026", 2027);

    expect(preview.sourceSnapshot.id).toBe("snap-2026");
    expect(preview.sourceSnapshot.name).toBe("2026 Cash Flow");
    expect(preview.targetYear).toBe(2027);
    expect(preview.targetPeriods).toHaveLength(12);
    expect(preview.groups).toHaveLength(2);
    expect(preview.summary.totalGroups).toBe(2);
    expect(preview.summary.totalLineItems).toBe(3);
    expect(preview.summary.totalValues).toBe(36); // 3 items × 12 months
  });

  it("includes prior-year actual totals per line item", async () => {
    const preview = await service.preview("snap-2026", 2027);

    // li-1 (Base Rent): no actuals in mock data → null
    const baseRent = preview.groups[0].lineItems[0];
    expect(baseRent.priorYearTotal).toBeNull();

    // li-2 (Parking): $500 × 12 = $6000
    const parking = preview.groups[0].lineItems[1];
    expect(parking.priorYearTotal).toBe("6000.00");

    // li-3 (Utilities): $1000 × 12 = $12000
    const utilities = preview.groups[1].lineItems[0];
    expect(utilities.priorYearTotal).toBe("12000.00");
  });

  it("includes projection method and params", async () => {
    const preview = await service.preview("snap-2026", 2027);

    expect(preview.groups[0].lineItems[0].projectionMethod).toBe("annual_spread");
    expect(preview.groups[0].lineItems[0].projectionParams).toEqual({ annualTotal: "120000" });
    expect(preview.groups[0].lineItems[1].projectionMethod).toBe("prior_year_flat");
    expect(preview.groups[1].lineItems[0].projectionMethod).toBe("prior_year_pct");
  });

  it("throws if source snapshot is not locked", async () => {
    prisma.snapshot.findUniqueOrThrow.mockResolvedValue(MOCK_DRAFT_SNAPSHOT);

    await expect(service.preview("snap-2026-draft", 2027)).rejects.toThrow(
      "Can only onboard from a locked snapshot"
    );
  });

  it("formats asOfMonth correctly", async () => {
    const preview = await service.preview("snap-2026", 2027);
    expect(preview.sourceSnapshot.asOfMonth).toBe("2026-12");
  });

  it("handles empty groups", async () => {
    prisma.group.findMany.mockResolvedValue([]);

    const preview = await service.preview("snap-2026", 2027);

    expect(preview.groups).toHaveLength(0);
    expect(preview.summary.totalGroups).toBe(0);
    expect(preview.summary.totalLineItems).toBe(0);
    expect(preview.summary.totalValues).toBe(0);
  });

  it("handles groups with no line items", async () => {
    prisma.group.findMany.mockResolvedValue([{ ...MOCK_GROUPS[0], lineItems: [] }]);

    const preview = await service.preview("snap-2026", 2027);

    expect(preview.groups).toHaveLength(1);
    expect(preview.groups[0].lineItems).toHaveLength(0);
    expect(preview.summary.totalLineItems).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// TemplateService.onboard
// ---------------------------------------------------------------------------
describe("TemplateService.onboard", () => {
  let prisma: ReturnType<typeof createMockPrisma>;
  let audit: ReturnType<typeof createMockAudit>;
  let service: TemplateService;

  beforeEach(() => {
    prisma = createMockPrisma();
    audit = createMockAudit();
    service = new TemplateService(prisma, audit);
  });

  it("creates a new draft snapshot", async () => {
    const result = await service.onboard({
      sourceSnapshotId: "snap-2026",
      name: "2027 Cash Flow Projection",
      targetYear: 2027,
      createdBy: "user-1"
    });

    expect(result.id).toBe("snap-2027");
    expect(result.status).toBe("draft");
  });

  it("creates value records via transaction", async () => {
    let txCalls: { createMany?: unknown } = {};

    prisma.$transaction.mockImplementation(async (fn: Function) => {
      const tx = {
        snapshot: {
          create: vi.fn().mockResolvedValue({
            id: "snap-2027",
            name: "2027 CF",
            asOfMonth: new Date("2027-12-01"),
            status: "draft",
            createdBy: "user-1"
          })
        },
        value: {
          createMany: vi.fn().mockImplementation((args: unknown) => {
            txCalls.createMany = args;
            return { count: 36 };
          })
        }
      };
      return fn(tx);
    });

    await service.onboard({
      sourceSnapshotId: "snap-2026",
      name: "2027 CF",
      targetYear: 2027,
      createdBy: "user-1"
    });

    expect(txCalls.createMany).toBeDefined();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = (txCalls.createMany as any).data;
    // 3 line items × 12 months = 36 records
    expect(data).toHaveLength(36);
  });

  it("uses projection engine for annual_spread line items", async () => {
    let createdValues: unknown[] = [];

    prisma.$transaction.mockImplementation(async (fn: Function) => {
      const tx = {
        snapshot: {
          create: vi.fn().mockResolvedValue({
            id: "snap-2027",
            name: "2027 CF",
            asOfMonth: new Date("2027-12-01"),
            status: "draft",
            createdBy: "user-1"
          })
        },
        value: {
          createMany: vi.fn().mockImplementation((args: { data: unknown[] }) => {
            createdValues = args.data;
            return { count: args.data.length };
          })
        }
      };
      return fn(tx);
    });

    await service.onboard({
      sourceSnapshotId: "snap-2026",
      name: "2027 CF",
      targetYear: 2027,
      createdBy: "user-1"
    });

    // li-1 uses annual_spread with annualTotal=120000 → 10000/month
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const li1Values = createdValues.filter((v: any) => v.lineItemId === "li-1");
    expect(li1Values).toHaveLength(12);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    li1Values.forEach((v: any) => {
      expect(v.projectedAmount.toString()).toBe("10000");
      expect(v.actualAmount).toBeNull();
    });
  });

  it("uses projection engine for prior_year_flat line items", async () => {
    let createdValues: unknown[] = [];

    prisma.$transaction.mockImplementation(async (fn: Function) => {
      const tx = {
        snapshot: {
          create: vi.fn().mockResolvedValue({
            id: "snap-2027",
            name: "2027 CF",
            asOfMonth: new Date("2027-12-01"),
            status: "draft",
            createdBy: "user-1"
          })
        },
        value: {
          createMany: vi.fn().mockImplementation((args: { data: unknown[] }) => {
            createdValues = args.data;
            return { count: args.data.length };
          })
        }
      };
      return fn(tx);
    });

    await service.onboard({
      sourceSnapshotId: "snap-2026",
      name: "2027 CF",
      targetYear: 2027,
      createdBy: "user-1"
    });

    // li-2 uses prior_year_flat → copies $500/month from prior year
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const li2Values = createdValues.filter((v: any) => v.lineItemId === "li-2");
    expect(li2Values).toHaveLength(12);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    li2Values.forEach((v: any) => {
      expect(v.projectedAmount.toString()).toBe("500");
      expect(v.actualAmount).toBeNull();
    });
  });

  it("uses projection engine for prior_year_pct line items", async () => {
    let createdValues: unknown[] = [];

    prisma.$transaction.mockImplementation(async (fn: Function) => {
      const tx = {
        snapshot: {
          create: vi.fn().mockResolvedValue({
            id: "snap-2027",
            name: "2027 CF",
            asOfMonth: new Date("2027-12-01"),
            status: "draft",
            createdBy: "user-1"
          })
        },
        value: {
          createMany: vi.fn().mockImplementation((args: { data: unknown[] }) => {
            createdValues = args.data;
            return { count: args.data.length };
          })
        }
      };
      return fn(tx);
    });

    await service.onboard({
      sourceSnapshotId: "snap-2026",
      name: "2027 CF",
      targetYear: 2027,
      createdBy: "user-1"
    });

    // li-3 uses prior_year_pct with pctChange=3 → $1000 × 1.03 = $1030/month
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const li3Values = createdValues.filter((v: any) => v.lineItemId === "li-3");
    expect(li3Values).toHaveLength(12);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    li3Values.forEach((v: any) => {
      expect(v.projectedAmount.toString()).toBe("1030");
      expect(v.actualAmount).toBeNull();
    });
  });

  it("sets actualAmount to null for all values (ADR-003)", async () => {
    let createdValues: unknown[] = [];

    prisma.$transaction.mockImplementation(async (fn: Function) => {
      const tx = {
        snapshot: {
          create: vi.fn().mockResolvedValue({
            id: "snap-2027",
            name: "2027 CF",
            asOfMonth: new Date("2027-12-01"),
            status: "draft",
            createdBy: "user-1"
          })
        },
        value: {
          createMany: vi.fn().mockImplementation((args: { data: unknown[] }) => {
            createdValues = args.data;
            return { count: args.data.length };
          })
        }
      };
      return fn(tx);
    });

    await service.onboard({
      sourceSnapshotId: "snap-2026",
      name: "2027 CF",
      targetYear: 2027,
      createdBy: "user-1"
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    createdValues.forEach((v: any) => {
      expect(v.actualAmount).toBeNull();
    });
  });

  it("throws if source snapshot is not locked", async () => {
    prisma.snapshot.findUniqueOrThrow.mockResolvedValue(MOCK_DRAFT_SNAPSHOT);

    await expect(
      service.onboard({
        sourceSnapshotId: "snap-2026-draft",
        name: "2027 CF",
        targetYear: 2027,
        createdBy: "user-1"
      })
    ).rejects.toThrow("Can only onboard from a locked snapshot");
  });

  it("logs an audit entry on successful onboarding", async () => {
    await service.onboard({
      sourceSnapshotId: "snap-2026",
      name: "2027 Cash Flow",
      targetYear: 2027,
      createdBy: "user-1"
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const auditReal = audit as any;
    expect(auditReal.logCreate).toHaveBeenCalledOnce();
    expect(auditReal.logCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        tableName: "Snapshot",
        recordId: "snap-2027",
        source: "ui_edit"
      })
    );
  });

  it("handles empty groups gracefully", async () => {
    prisma.group.findMany.mockResolvedValue([]);
    prisma.value.findMany.mockResolvedValue([]);

    prisma.$transaction.mockImplementation(async (fn: Function) => {
      const tx = {
        snapshot: {
          create: vi.fn().mockResolvedValue({
            id: "snap-2027",
            name: "2027 CF",
            asOfMonth: new Date("2027-12-01"),
            status: "draft",
            createdBy: "user-1"
          })
        },
        value: {
          createMany: vi.fn()
        }
      };
      return fn(tx);
    });

    const result = await service.onboard({
      sourceSnapshotId: "snap-2026",
      name: "2027 CF",
      targetYear: 2027,
      createdBy: "user-1"
    });

    expect(result.id).toBe("snap-2027");
  });

  it("creates periods with correct UTC dates", async () => {
    let createdValues: unknown[] = [];

    prisma.$transaction.mockImplementation(async (fn: Function) => {
      const tx = {
        snapshot: {
          create: vi.fn().mockResolvedValue({
            id: "snap-2027",
            name: "2027 CF",
            asOfMonth: new Date("2027-12-01"),
            status: "draft",
            createdBy: "user-1"
          })
        },
        value: {
          createMany: vi.fn().mockImplementation((args: { data: unknown[] }) => {
            createdValues = args.data;
            return { count: args.data.length };
          })
        }
      };
      return fn(tx);
    });

    await service.onboard({
      sourceSnapshotId: "snap-2026",
      name: "2027 CF",
      targetYear: 2027,
      createdBy: "user-1"
    });

    // Check first line item's periods are Jan-Dec 2027
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const li1Values = createdValues.filter((v: any) => v.lineItemId === "li-1");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const periods = li1Values.map((v: any) => v.period.toISOString());
    expect(periods[0]).toBe("2027-01-01T00:00:00.000Z");
    expect(periods[11]).toBe("2027-12-01T00:00:00.000Z");
  });
});

// ---------------------------------------------------------------------------
// HTTP Handlers
// ---------------------------------------------------------------------------
describe("template http-handlers", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockService: any;

  beforeEach(() => {
    mockService = {
      preview: vi.fn(),
      onboard: vi.fn()
    };
  });

  describe("previewTemplate", () => {
    // Dynamic import to avoid module-level side effects
    async function getHandler() {
      const { previewTemplate } = await import("../../lib/templates/http-handlers");
      return previewTemplate;
    }

    it("returns 400 for missing sourceSnapshotId", async () => {
      const handler = await getHandler();
      const result = await handler(mockService, { targetYear: 2027 });
      expect(result.status).toBe(400);
    });

    it("returns 400 for missing targetYear", async () => {
      const handler = await getHandler();
      const result = await handler(mockService, { sourceSnapshotId: "snap-1" });
      expect(result.status).toBe(400);
    });

    it("returns 400 for non-integer targetYear", async () => {
      const handler = await getHandler();
      const result = await handler(mockService, {
        sourceSnapshotId: "snap-1",
        targetYear: 2027.5
      });
      expect(result.status).toBe(400);
    });

    it("returns 400 for out-of-range targetYear", async () => {
      const handler = await getHandler();
      const result = await handler(mockService, {
        sourceSnapshotId: "snap-1",
        targetYear: 1999
      });
      expect(result.status).toBe(400);
    });

    it("returns 200 with preview data", async () => {
      const handler = await getHandler();
      const mockPreview = { sourceSnapshot: { id: "snap-1" }, targetYear: 2027 };
      mockService.preview.mockResolvedValue(mockPreview);

      const result = await handler(mockService, {
        sourceSnapshotId: "snap-1",
        targetYear: 2027
      });

      expect(result.status).toBe(200);
      expect(result.body).toEqual(mockPreview);
    });

    it("returns 409 for unlocked snapshot", async () => {
      const handler = await getHandler();
      mockService.preview.mockRejectedValue(new Error("Can only onboard from a locked snapshot"));

      const result = await handler(mockService, {
        sourceSnapshotId: "snap-1",
        targetYear: 2027
      });

      expect(result.status).toBe(409);
    });
  });

  describe("onboardTemplate", () => {
    async function getHandler() {
      const { onboardTemplate } = await import("../../lib/templates/http-handlers");
      return onboardTemplate;
    }

    it("returns 400 for missing name", async () => {
      const handler = await getHandler();
      const result = await handler(mockService, {
        sourceSnapshotId: "snap-1",
        targetYear: 2027,
        createdBy: "user-1"
      });
      expect(result.status).toBe(400);
    });

    it("returns 400 for missing createdBy", async () => {
      const handler = await getHandler();
      const result = await handler(mockService, {
        sourceSnapshotId: "snap-1",
        name: "2027 CF",
        targetYear: 2027
      });
      expect(result.status).toBe(400);
    });

    it("returns 400 for whitespace-only name", async () => {
      const handler = await getHandler();
      const result = await handler(mockService, {
        sourceSnapshotId: "snap-1",
        name: "   ",
        targetYear: 2027,
        createdBy: "user-1"
      });
      expect(result.status).toBe(400);
    });

    it("returns 201 on successful onboarding", async () => {
      const handler = await getHandler();
      mockService.onboard.mockResolvedValue({ id: "snap-2027", status: "draft" });

      const result = await handler(mockService, {
        sourceSnapshotId: "snap-1",
        name: "2027 CF",
        targetYear: 2027,
        createdBy: "user-1"
      });

      expect(result.status).toBe(201);
    });

    it("returns 404 for missing source snapshot", async () => {
      const handler = await getHandler();
      mockService.onboard.mockRejectedValue(new Error("No Snapshot found"));

      const result = await handler(mockService, {
        sourceSnapshotId: "not-real",
        name: "2027 CF",
        targetYear: 2027,
        createdBy: "user-1"
      });

      expect(result.status).toBe(404);
    });

    it("returns 409 for draft source snapshot", async () => {
      const handler = await getHandler();
      mockService.onboard.mockRejectedValue(new Error("Can only onboard from a locked snapshot"));

      const result = await handler(mockService, {
        sourceSnapshotId: "snap-draft",
        name: "2027 CF",
        targetYear: 2027,
        createdBy: "user-1"
      });

      expect(result.status).toBe(409);
    });

    it("trims name before passing to service", async () => {
      const handler = await getHandler();
      mockService.onboard.mockResolvedValue({ id: "snap-2027" });

      await handler(mockService, {
        sourceSnapshotId: "snap-1",
        name: "  2027 CF  ",
        targetYear: 2027,
        createdBy: "user-1"
      });

      expect(mockService.onboard).toHaveBeenCalledWith(
        expect.objectContaining({ name: "2027 CF" })
      );
    });
  });
});
