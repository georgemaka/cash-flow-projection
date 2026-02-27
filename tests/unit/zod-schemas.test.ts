import { describe, expect, it } from "vitest";
import {
  createSnapshotSchema,
  lockSnapshotSchema,
  copySnapshotSchema,
  compareSnapshotParamsSchema,
  createGroupSchema,
  updateGroupSchema,
  archiveGroupSchema,
  createLineItemSchema,
  updateLineItemSchema,
  archiveLineItemSchema,
  upsertValueSchema,
  bulkUpdateSchema,
  bulkRestoreSchema,
  previewTemplateSchema,
  onboardTemplateSchema
} from "@/lib/validations";

// ── Snapshot schemas ────────────────────────────────────────────────────────

describe("createSnapshotSchema", () => {
  it("accepts valid input", () => {
    const result = createSnapshotSchema.safeParse({
      name: "FY2026",
      asOfMonth: "2026-01",
      createdBy: "user-1"
    });
    expect(result.success).toBe(true);
  });

  it("trims whitespace from name", () => {
    const result = createSnapshotSchema.safeParse({
      name: "  FY2026  ",
      asOfMonth: "2026-01",
      createdBy: "user-1"
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.name).toBe("FY2026");
  });

  it("rejects empty name", () => {
    const result = createSnapshotSchema.safeParse({
      name: "",
      asOfMonth: "2026-01",
      createdBy: "u"
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid asOfMonth format", () => {
    const result = createSnapshotSchema.safeParse({
      name: "X",
      asOfMonth: "2026/01",
      createdBy: "u"
    });
    expect(result.success).toBe(false);
  });

  it("rejects month 13", () => {
    const result = createSnapshotSchema.safeParse({
      name: "X",
      asOfMonth: "2026-13",
      createdBy: "u"
    });
    expect(result.success).toBe(false);
  });
});

describe("lockSnapshotSchema", () => {
  it("accepts required fields", () => {
    const result = lockSnapshotSchema.safeParse({ snapshotId: "s1", lockedBy: "u1" });
    expect(result.success).toBe(true);
  });

  it("accepts optional reason", () => {
    const result = lockSnapshotSchema.safeParse({
      snapshotId: "s1",
      lockedBy: "u1",
      reason: "End of month"
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing snapshotId", () => {
    const result = lockSnapshotSchema.safeParse({ lockedBy: "u1" });
    expect(result.success).toBe(false);
  });
});

describe("compareSnapshotParamsSchema", () => {
  it("accepts two distinct IDs", () => {
    const result = compareSnapshotParamsSchema.safeParse({ a: "snap-1", b: "snap-2" });
    expect(result.success).toBe(true);
  });

  it("rejects same IDs", () => {
    const result = compareSnapshotParamsSchema.safeParse({ a: "snap-1", b: "snap-1" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe("Snapshots must be different");
    }
  });

  it("rejects empty param a", () => {
    const result = compareSnapshotParamsSchema.safeParse({ a: "", b: "snap-2" });
    expect(result.success).toBe(false);
  });
});

describe("copySnapshotSchema", () => {
  it("accepts valid input", () => {
    const result = copySnapshotSchema.safeParse({
      sourceSnapshotId: "s1",
      name: "Copy",
      asOfMonth: "2026-06",
      createdBy: "u1"
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing sourceSnapshotId", () => {
    const result = copySnapshotSchema.safeParse({
      name: "Copy",
      asOfMonth: "2026-06",
      createdBy: "u"
    });
    expect(result.success).toBe(false);
  });
});

// ── Group schemas ───────────────────────────────────────────────────────────

describe("createGroupSchema", () => {
  it("accepts valid sector group", () => {
    const result = createGroupSchema.safeParse({ name: "Operations", groupType: "sector" });
    expect(result.success).toBe(true);
  });

  it("rejects invalid groupType", () => {
    const result = createGroupSchema.safeParse({ name: "Ops", groupType: "invalid" });
    expect(result.success).toBe(false);
  });

  it("rejects name longer than 100 chars", () => {
    const result = createGroupSchema.safeParse({ name: "a".repeat(101), groupType: "sector" });
    expect(result.success).toBe(false);
  });

  it("rejects negative sortOrder", () => {
    const result = createGroupSchema.safeParse({
      name: "Ops",
      groupType: "sector",
      sortOrder: -1
    });
    expect(result.success).toBe(false);
  });
});

describe("updateGroupSchema", () => {
  it("accepts partial update", () => {
    const result = updateGroupSchema.safeParse({ groupId: "g1", name: "New Name" });
    expect(result.success).toBe(true);
  });

  it("rejects when no updatable fields provided", () => {
    const result = updateGroupSchema.safeParse({ groupId: "g1" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe("No updatable fields provided");
    }
  });

  it("rejects missing groupId", () => {
    const result = updateGroupSchema.safeParse({ name: "X" });
    expect(result.success).toBe(false);
  });
});

describe("archiveGroupSchema", () => {
  it("accepts groupId only", () => {
    const result = archiveGroupSchema.safeParse({ groupId: "g1" });
    expect(result.success).toBe(true);
  });

  it("rejects missing groupId", () => {
    const result = archiveGroupSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

// ── Line-item schemas ───────────────────────────────────────────────────────

describe("createLineItemSchema", () => {
  it("accepts minimal required fields", () => {
    const result = createLineItemSchema.safeParse({ groupId: "g1", label: "Revenue" });
    expect(result.success).toBe(true);
  });

  it("accepts valid projectionMethod", () => {
    const result = createLineItemSchema.safeParse({
      groupId: "g1",
      label: "Revenue",
      projectionMethod: "annual_spread"
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid projectionMethod", () => {
    const result = createLineItemSchema.safeParse({
      groupId: "g1",
      label: "Revenue",
      projectionMethod: "magic"
    });
    expect(result.success).toBe(false);
  });
});

describe("updateLineItemSchema", () => {
  it("accepts label update", () => {
    const result = updateLineItemSchema.safeParse({ lineItemId: "li1", label: "New Label" });
    expect(result.success).toBe(true);
  });

  it("rejects when no updatable fields", () => {
    const result = updateLineItemSchema.safeParse({ lineItemId: "li1" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe("No updatable fields provided");
    }
  });
});

describe("archiveLineItemSchema", () => {
  it("accepts lineItemId only", () => {
    const result = archiveLineItemSchema.safeParse({ lineItemId: "li1" });
    expect(result.success).toBe(true);
  });
});

// ── Value schemas ───────────────────────────────────────────────────────────

describe("upsertValueSchema", () => {
  it("accepts valid upsert payload", () => {
    const result = upsertValueSchema.safeParse({
      lineItemId: "li1",
      snapshotId: "s1",
      period: "2026-03",
      projectedAmount: "12345.00"
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid period", () => {
    const result = upsertValueSchema.safeParse({
      lineItemId: "li1",
      snapshotId: "s1",
      period: "03-2026"
    });
    expect(result.success).toBe(false);
  });

  it("accepts null amounts", () => {
    const result = upsertValueSchema.safeParse({
      lineItemId: "li1",
      snapshotId: "s1",
      period: "2026-03",
      projectedAmount: null,
      actualAmount: null
    });
    expect(result.success).toBe(true);
  });
});

// ── Bulk schemas ────────────────────────────────────────────────────────────

describe("bulkUpdateSchema", () => {
  it("accepts preview mode without reason", () => {
    const result = bulkUpdateSchema.safeParse({
      snapshotId: "s1",
      field: "projected",
      operation: "multiply",
      operand: 5,
      preview: true
    });
    expect(result.success).toBe(true);
  });

  it("requires reason when not preview", () => {
    const result = bulkUpdateSchema.safeParse({
      snapshotId: "s1",
      field: "projected",
      operation: "add",
      operand: 1000
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe("reason is required when not in preview mode");
    }
  });

  it("rejects non-finite operand", () => {
    const result = bulkUpdateSchema.safeParse({
      snapshotId: "s1",
      field: "projected",
      operation: "add",
      operand: Infinity,
      preview: true
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid field", () => {
    const result = bulkUpdateSchema.safeParse({
      snapshotId: "s1",
      field: "variance",
      operation: "add",
      operand: 100,
      preview: true
    });
    expect(result.success).toBe(false);
  });
});

describe("bulkRestoreSchema", () => {
  it("accepts valid restore payload", () => {
    const result = bulkRestoreSchema.safeParse({
      snapshotId: "s1",
      reason: "Undo bulk change",
      restores: [{ lineItemId: "li1", period: "2026-01", projectedAmount: "1000.00" }]
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty restores array", () => {
    const result = bulkRestoreSchema.safeParse({
      snapshotId: "s1",
      reason: "Reason",
      restores: []
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing reason", () => {
    const result = bulkRestoreSchema.safeParse({
      snapshotId: "s1",
      restores: [{ lineItemId: "li1", period: "2026-01" }]
    });
    expect(result.success).toBe(false);
  });
});

// ── Template schemas ────────────────────────────────────────────────────────

describe("previewTemplateSchema", () => {
  it("accepts valid preview request", () => {
    const result = previewTemplateSchema.safeParse({
      sourceSnapshotId: "s1",
      targetYear: 2027
    });
    expect(result.success).toBe(true);
  });

  it("rejects year below 2000", () => {
    const result = previewTemplateSchema.safeParse({ sourceSnapshotId: "s1", targetYear: 1999 });
    expect(result.success).toBe(false);
  });

  it("rejects year above 2100", () => {
    const result = previewTemplateSchema.safeParse({ sourceSnapshotId: "s1", targetYear: 2101 });
    expect(result.success).toBe(false);
  });

  it("rejects non-integer year", () => {
    const result = previewTemplateSchema.safeParse({ sourceSnapshotId: "s1", targetYear: 2026.5 });
    expect(result.success).toBe(false);
  });
});

describe("onboardTemplateSchema", () => {
  it("accepts valid onboard request", () => {
    const result = onboardTemplateSchema.safeParse({
      sourceSnapshotId: "s1",
      name: "FY2027",
      targetYear: 2027,
      createdBy: "u1"
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty name", () => {
    const result = onboardTemplateSchema.safeParse({
      sourceSnapshotId: "s1",
      name: "   ",
      targetYear: 2027,
      createdBy: "u1"
    });
    expect(result.success).toBe(false);
  });
});
