import { describe, expect, it } from "vitest";
import { mergeEdits } from "@/lib/hooks/merge-edits";

describe("mergeEdits", () => {
  it("returns empty array for no edits", () => {
    expect(mergeEdits([])).toEqual([]);
  });

  it("passes through a single projected edit", () => {
    const result = mergeEdits([
      { lineItemId: "li-1", period: "2026-01", field: "projected", value: "1000.00" }
    ]);
    expect(result).toEqual([
      { lineItemId: "li-1", period: "2026-01", projected: "1000.00" }
    ]);
  });

  it("passes through a single actual edit", () => {
    const result = mergeEdits([
      { lineItemId: "li-1", period: "2026-01", field: "actual", value: "950.00" }
    ]);
    expect(result).toEqual([
      { lineItemId: "li-1", period: "2026-01", actual: "950.00" }
    ]);
  });

  it("passes through a single note edit", () => {
    const result = mergeEdits([
      { lineItemId: "li-1", period: "2026-01", field: "note", value: "Revised forecast" }
    ]);
    expect(result).toEqual([
      { lineItemId: "li-1", period: "2026-01", note: "Revised forecast" }
    ]);
  });

  it("merges projected, actual, and note edits for the same cell into one record", () => {
    const result = mergeEdits([
      { lineItemId: "li-1", period: "2026-01", field: "projected", value: "1000.00" },
      { lineItemId: "li-1", period: "2026-01", field: "actual", value: "950.00" },
      { lineItemId: "li-1", period: "2026-01", field: "note", value: "Q1 adjustment" }
    ]);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      lineItemId: "li-1",
      period: "2026-01",
      projected: "1000.00",
      actual: "950.00",
      note: "Q1 adjustment"
    });
  });

  it("keeps edits for different periods separate", () => {
    const result = mergeEdits([
      { lineItemId: "li-1", period: "2026-01", field: "projected", value: "1000.00" },
      { lineItemId: "li-1", period: "2026-02", field: "projected", value: "2000.00" }
    ]);
    expect(result).toHaveLength(2);
    const jan = result.find((r) => r.period === "2026-01");
    const feb = result.find((r) => r.period === "2026-02");
    expect(jan?.projected).toBe("1000.00");
    expect(feb?.projected).toBe("2000.00");
  });

  it("keeps edits for different line items separate", () => {
    const result = mergeEdits([
      { lineItemId: "li-1", period: "2026-01", field: "projected", value: "100.00" },
      { lineItemId: "li-2", period: "2026-01", field: "projected", value: "200.00" }
    ]);
    expect(result).toHaveLength(2);
  });

  it("later edit for the same field wins (dedup)", () => {
    const result = mergeEdits([
      { lineItemId: "li-1", period: "2026-01", field: "projected", value: "1000.00" },
      { lineItemId: "li-1", period: "2026-01", field: "projected", value: "1500.00" }
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].projected).toBe("1500.00");
  });

  it("null note value clears the note", () => {
    const result = mergeEdits([
      { lineItemId: "li-1", period: "2026-01", field: "note", value: null }
    ]);
    expect(result[0].note).toBeNull();
  });

  it("fields not in the batch are left as undefined", () => {
    const result = mergeEdits([
      { lineItemId: "li-1", period: "2026-01", field: "projected", value: "100.00" }
    ]);
    expect(result[0].actual).toBeUndefined();
    expect(result[0].note).toBeUndefined();
  });
});
