import { describe, expect, it } from "vitest";
import { validateCreateGroup, validateUpdateGroup } from "../../lib/validations/group-validation";

describe("validateCreateGroup", () => {
  const valid = { name: "Self Storage", groupType: "sector" as const, createdBy: "user-1" };

  it("passes with valid input", () => {
    expect(validateCreateGroup(valid).valid).toBe(true);
  });

  it("passes with optional sortOrder", () => {
    expect(validateCreateGroup({ ...valid, sortOrder: 3 }).valid).toBe(true);
  });

  it("rejects empty name", () => {
    const result = validateCreateGroup({ ...valid, name: "" });
    expect(result.valid).toBe(false);
    expect(result.errors[0].field).toBe("name");
  });

  it("rejects whitespace-only name", () => {
    const result = validateCreateGroup({ ...valid, name: "   " });
    expect(result.valid).toBe(false);
    expect(result.errors[0].field).toBe("name");
  });

  it("rejects name over 100 characters", () => {
    const result = validateCreateGroup({ ...valid, name: "x".repeat(101) });
    expect(result.valid).toBe(false);
    expect(result.errors[0].field).toBe("name");
  });

  it("accepts name at exactly 100 characters", () => {
    expect(validateCreateGroup({ ...valid, name: "x".repeat(100) }).valid).toBe(true);
  });

  it("rejects invalid groupType", () => {
    const result = validateCreateGroup({ ...valid, groupType: "invalid" as never });
    expect(result.valid).toBe(false);
    expect(result.errors[0].field).toBe("groupType");
  });

  it("accepts all valid group types", () => {
    for (const type of ["sector", "non_operating", "custom"] as const) {
      expect(validateCreateGroup({ ...valid, groupType: type }).valid).toBe(true);
    }
  });

  it("rejects negative sortOrder", () => {
    const result = validateCreateGroup({ ...valid, sortOrder: -1 });
    expect(result.valid).toBe(false);
    expect(result.errors[0].field).toBe("sortOrder");
  });

  it("rejects fractional sortOrder", () => {
    const result = validateCreateGroup({ ...valid, sortOrder: 1.5 });
    expect(result.valid).toBe(false);
    expect(result.errors[0].field).toBe("sortOrder");
  });

  it("rejects empty createdBy", () => {
    const result = validateCreateGroup({ ...valid, createdBy: "" });
    expect(result.valid).toBe(false);
    expect(result.errors[0].field).toBe("createdBy");
  });

  it("collects multiple errors", () => {
    const result = validateCreateGroup({
      name: "",
      groupType: "invalid" as never,
      createdBy: ""
    });
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(3);
  });
});

describe("validateUpdateGroup", () => {
  const valid = { groupId: "grp-1", updatedBy: "user-1" };

  it("passes with no optional fields", () => {
    expect(validateUpdateGroup(valid).valid).toBe(true);
  });

  it("passes with name update", () => {
    expect(validateUpdateGroup({ ...valid, name: "New Name" }).valid).toBe(true);
  });

  it("passes with sortOrder update", () => {
    expect(validateUpdateGroup({ ...valid, sortOrder: 5 }).valid).toBe(true);
  });

  it("rejects empty groupId", () => {
    const result = validateUpdateGroup({ ...valid, groupId: "" });
    expect(result.valid).toBe(false);
    expect(result.errors[0].field).toBe("groupId");
  });

  it("rejects empty name when provided", () => {
    const result = validateUpdateGroup({ ...valid, name: "" });
    expect(result.valid).toBe(false);
    expect(result.errors[0].field).toBe("name");
  });

  it("rejects name over 100 characters", () => {
    const result = validateUpdateGroup({ ...valid, name: "x".repeat(101) });
    expect(result.valid).toBe(false);
  });

  it("rejects negative sortOrder", () => {
    const result = validateUpdateGroup({ ...valid, sortOrder: -1 });
    expect(result.valid).toBe(false);
  });

  it("rejects empty updatedBy", () => {
    const result = validateUpdateGroup({ ...valid, updatedBy: "" });
    expect(result.valid).toBe(false);
    expect(result.errors[0].field).toBe("updatedBy");
  });
});
