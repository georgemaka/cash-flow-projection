import { beforeEach, describe, expect, it, vi } from "vitest";
import { applyOperation, BulkValueService } from "@/lib/values/bulk-service";

describe("applyOperation — multiply (% change)", () => {
  it("applies a positive percentage increase", () => {
    // +5% of 1000 → 1050
    expect(applyOperation("1000.00", "multiply", 5)).toBe("1050.00");
  });

  it("applies a negative percentage decrease", () => {
    // -10% of 2000 → 1800
    expect(applyOperation("2000.00", "multiply", -10)).toBe("1800.00");
  });

  it("returns null when oldValue is null", () => {
    expect(applyOperation(null, "multiply", 5)).toBeNull();
  });

  it("handles zero operand (no change)", () => {
    expect(applyOperation("5000.00", "multiply", 0)).toBe("5000.00");
  });

  it("handles negative old value with positive pct", () => {
    // +10% of -4000 → -4400
    expect(applyOperation("-4000.00", "multiply", 10)).toBe("-4400.00");
  });

  it("preserves two decimal places", () => {
    // +1% of 333.33 → 336.66
    const result = applyOperation("333.33", "multiply", 1);
    expect(result).not.toBeNull();
    // Check it's a valid number string with 2 decimals
    expect(result).toMatch(/^-?\d+\.\d{2}$/);
  });
});

describe("applyOperation — add (flat adjustment)", () => {
  it("adds a positive flat amount", () => {
    expect(applyOperation("1000.00", "add", 500)).toBe("1500.00");
  });

  it("subtracts a negative flat amount", () => {
    expect(applyOperation("1000.00", "add", -200)).toBe("800.00");
  });

  it("returns null when oldValue is null", () => {
    expect(applyOperation(null, "add", 500)).toBeNull();
  });

  it("handles zero operand (no change)", () => {
    expect(applyOperation("3000.00", "add", 0)).toBe("3000.00");
  });

  it("handles adding to a negative value", () => {
    expect(applyOperation("-1000.00", "add", 500)).toBe("-500.00");
  });

  it("handles large amounts without precision loss", () => {
    expect(applyOperation("1234567.89", "add", 111111.11)).toBe("1345679.00");
  });
});

// ---------------------------------------------------------------------------
// BulkValueService — locked-snapshot guards
// ---------------------------------------------------------------------------

function createMockPrisma(snapshotStatus: "draft" | "locked" = "draft") {
  return {
    snapshot: {
      findUniqueOrThrow: vi.fn().mockResolvedValue({ id: "snap-1", status: snapshotStatus })
    },
    value: {
      findMany: vi.fn().mockResolvedValue([]),
      upsert: vi.fn().mockResolvedValue({})
    },
    $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn({}))
  } as never;
}

describe("BulkValueService.apply", () => {
  beforeEach(() => vi.clearAllMocks());

  it("throws when snapshot is locked", async () => {
    const svc = new BulkValueService(createMockPrisma("locked"));
    await expect(
      svc.apply("snap-1", null, "projected", "add", 500, "test reason", "user-1")
    ).rejects.toThrow("Cannot apply bulk updates to a locked snapshot");
  });

  it("proceeds when snapshot is draft", async () => {
    const mockPrisma = createMockPrisma("draft");
    const svc = new BulkValueService(mockPrisma);
    const result = await svc.apply("snap-1", null, "projected", "add", 0, "no-op", "user-1");
    expect(result.count).toBe(0);
  });
});

describe("BulkValueService.restore", () => {
  beforeEach(() => vi.clearAllMocks());

  it("throws when snapshot is locked", async () => {
    const svc = new BulkValueService(createMockPrisma("locked"));
    await expect(svc.restore("snap-1", [], "undo reason", "user-1")).rejects.toThrow(
      "Cannot restore values in a locked snapshot"
    );
  });

  it("proceeds when snapshot is draft", async () => {
    const mockPrisma = createMockPrisma("draft");
    const svc = new BulkValueService(mockPrisma);
    const result = await svc.restore("snap-1", [], "undo", "user-1");
    expect(result.count).toBe(0);
  });
});
