import { describe, it, expect } from "vitest";
import Decimal from "decimal.js";
import {
  materialChangeThreshold,
  checkMaterialChange,
  FIXED_THRESHOLD,
  PCT_THRESHOLD
} from "@/lib/values/threshold";

describe("materialChangeThreshold", () => {
  it("uses fixed threshold when old value is small", () => {
    // 5% of 1000 = 50 < 1000, so threshold = 1000
    expect(materialChangeThreshold(new Decimal(1000))).toBe(FIXED_THRESHOLD);
  });

  it("uses percentage threshold when old value is large", () => {
    // 5% of 100000 = 5000 > 1000, so threshold = 5000
    expect(materialChangeThreshold(new Decimal(100000))).toBeCloseTo(100000 * PCT_THRESHOLD, 5);
  });

  it("returns fixed threshold for zero old value", () => {
    expect(materialChangeThreshold(new Decimal(0))).toBe(FIXED_THRESHOLD);
  });

  it("uses absolute value for negative old amounts", () => {
    // 5% of |-40000| = 2000 > 1000, so threshold = 2000
    expect(materialChangeThreshold(new Decimal(-40000))).toBeCloseTo(2000, 5);
  });
});

describe("checkMaterialChange", () => {
  it("is not material when old value is null (new record)", () => {
    const result = checkMaterialChange(null, new Decimal(50000));
    expect(result.isMaterial).toBe(false);
  });

  it("is not material when new value is null (clearing)", () => {
    const result = checkMaterialChange(new Decimal(10000), null);
    expect(result.isMaterial).toBe(false);
  });

  it("is not material when values are equal", () => {
    const result = checkMaterialChange(new Decimal(5000), new Decimal(5000));
    expect(result.isMaterial).toBe(false);
  });

  it("is not material for a small change below threshold", () => {
    // old=10000, threshold=max(1000, 500)=1000, delta=100
    const result = checkMaterialChange(new Decimal(10000), new Decimal(10100));
    expect(result.isMaterial).toBe(false);
    expect(result.delta).toBeCloseTo(100);
  });

  it("is material for a large absolute change", () => {
    // old=5000, threshold=max(1000, 250)=1000, delta=2000
    const result = checkMaterialChange(new Decimal(5000), new Decimal(7000));
    expect(result.isMaterial).toBe(true);
    expect(result.delta).toBeCloseTo(2000);
    expect(result.threshold).toBe(FIXED_THRESHOLD);
  });

  it("is material for a large percentage change", () => {
    // old=100000, threshold=max(1000, 5000)=5000, delta=10000
    const result = checkMaterialChange(new Decimal(100000), new Decimal(110000));
    expect(result.isMaterial).toBe(true);
    expect(result.delta).toBeCloseTo(10000);
    expect(result.threshold).toBeCloseTo(5000);
  });

  it("is material for a decrease that exceeds threshold", () => {
    const result = checkMaterialChange(new Decimal(50000), new Decimal(40000));
    expect(result.isMaterial).toBe(true);
    expect(result.delta).toBeCloseTo(10000);
  });

  it("returns correct threshold and delta values", () => {
    // old=20000, threshold=max(1000, 1000)=1000, delta=1500
    const result = checkMaterialChange(new Decimal(20000), new Decimal(21500));
    expect(result.isMaterial).toBe(true);
    expect(result.threshold).toBeCloseTo(1000);
    expect(result.delta).toBeCloseTo(1500);
  });
});
