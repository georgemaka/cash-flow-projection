import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { z } from "zod";

/**
 * Test the env validation logic without importing the module (which
 * would attempt to parse process.env immediately). Instead, we replicate
 * the schema and test it directly.
 */

const serverSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  CLERK_SECRET_KEY: z.string().min(1, "CLERK_SECRET_KEY is required"),
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().min(1, "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY is required")
});

describe("env validation schema", () => {
  it("accepts valid env vars", () => {
    const result = serverSchema.safeParse({
      DATABASE_URL: "postgresql://localhost:5432/cashflow",
      CLERK_SECRET_KEY: "sk_test_abc123",
      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_test_xyz789"
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing DATABASE_URL", () => {
    const result = serverSchema.safeParse({
      CLERK_SECRET_KEY: "sk_test_abc123",
      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_test_xyz789"
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing CLERK_SECRET_KEY", () => {
    const result = serverSchema.safeParse({
      DATABASE_URL: "postgresql://localhost:5432/cashflow",
      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_test_xyz789"
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", () => {
    const result = serverSchema.safeParse({
      DATABASE_URL: "postgresql://localhost:5432/cashflow",
      CLERK_SECRET_KEY: "sk_test_abc123"
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty string values", () => {
    const result = serverSchema.safeParse({
      DATABASE_URL: "",
      CLERK_SECRET_KEY: "sk_test_abc123",
      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_test_xyz789"
    });
    expect(result.success).toBe(false);
  });

  it("reports all missing fields in errors", () => {
    const result = serverSchema.safeParse({});
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path[0]);
      expect(paths).toContain("DATABASE_URL");
      expect(paths).toContain("CLERK_SECRET_KEY");
      expect(paths).toContain("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY");
    }
  });
});
