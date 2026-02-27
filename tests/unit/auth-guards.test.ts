import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  requireAdmin,
  requireEditorOrAbove,
  requireSignedIn,
  hasRole,
  getAuthContext
} from "@/lib/auth";

// Mock @clerk/nextjs/server
vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn()
}));

import { auth } from "@clerk/nextjs/server";

const mockAuth = vi.mocked(auth);

function makeAuthResult(userId: string | null, role?: string) {
  return {
    userId,
    sessionClaims: userId ? { publicMetadata: role ? { role } : {} } : null
  };
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("getAuthContext", () => {
  it("returns null when not signed in", async () => {
    mockAuth.mockResolvedValue(makeAuthResult(null) as never);
    const ctx = await getAuthContext();
    expect(ctx).toBeNull();
  });

  it("returns clerkUserId and role when signed in with admin", async () => {
    mockAuth.mockResolvedValue(makeAuthResult("user_abc", "admin") as never);
    const ctx = await getAuthContext();
    expect(ctx).toEqual({ clerkUserId: "user_abc", role: "admin" });
  });

  it("defaults to viewer role when no role is set in metadata", async () => {
    mockAuth.mockResolvedValue(makeAuthResult("user_abc") as never);
    const ctx = await getAuthContext();
    expect(ctx?.role).toBe("viewer");
  });
});

describe("requireSignedIn", () => {
  it("returns null when signed in", async () => {
    mockAuth.mockResolvedValue(makeAuthResult("user_123", "viewer") as never);
    const result = await requireSignedIn();
    expect(result).toBeNull();
  });

  it("returns 401 when not signed in", async () => {
    mockAuth.mockResolvedValue(makeAuthResult(null) as never);
    const result = await requireSignedIn();
    expect(result).not.toBeNull();
    expect(result?.status).toBe(401);
    const body = await result!.json();
    expect(body.error).toBe("Unauthorized");
  });
});

describe("requireAdmin", () => {
  it("returns null for admin users", async () => {
    mockAuth.mockResolvedValue(makeAuthResult("user_123", "admin") as never);
    const result = await requireAdmin();
    expect(result).toBeNull();
  });

  it("returns 401 when not signed in", async () => {
    mockAuth.mockResolvedValue(makeAuthResult(null) as never);
    const result = await requireAdmin();
    expect(result?.status).toBe(401);
    const body = await result!.json();
    expect(body.error).toBe("Unauthorized");
  });

  it("returns 403 for editor users", async () => {
    mockAuth.mockResolvedValue(makeAuthResult("user_123", "editor") as never);
    const result = await requireAdmin();
    expect(result?.status).toBe(403);
    const body = await result!.json();
    expect(body.error).toBe("Forbidden");
  });

  it("returns 403 for viewer users", async () => {
    mockAuth.mockResolvedValue(makeAuthResult("user_123", "viewer") as never);
    const result = await requireAdmin();
    expect(result?.status).toBe(403);
  });
});

describe("requireEditorOrAbove", () => {
  it("returns null for admin users", async () => {
    mockAuth.mockResolvedValue(makeAuthResult("user_123", "admin") as never);
    const result = await requireEditorOrAbove();
    expect(result).toBeNull();
  });

  it("returns null for editor users", async () => {
    mockAuth.mockResolvedValue(makeAuthResult("user_123", "editor") as never);
    const result = await requireEditorOrAbove();
    expect(result).toBeNull();
  });

  it("returns 403 for viewer users", async () => {
    mockAuth.mockResolvedValue(makeAuthResult("user_123", "viewer") as never);
    const result = await requireEditorOrAbove();
    expect(result?.status).toBe(403);
  });

  it("returns 401 when not signed in", async () => {
    mockAuth.mockResolvedValue(makeAuthResult(null) as never);
    const result = await requireEditorOrAbove();
    expect(result?.status).toBe(401);
  });
});

describe("hasRole", () => {
  it("admin passes all role requirements", () => {
    expect(hasRole("admin", "admin")).toBe(true);
    expect(hasRole("admin", "editor")).toBe(true);
    expect(hasRole("admin", "viewer")).toBe(true);
  });

  it("editor passes editor and viewer but not admin", () => {
    expect(hasRole("editor", "admin")).toBe(false);
    expect(hasRole("editor", "editor")).toBe(true);
    expect(hasRole("editor", "viewer")).toBe(true);
  });

  it("viewer only passes viewer requirement", () => {
    expect(hasRole("viewer", "admin")).toBe(false);
    expect(hasRole("viewer", "editor")).toBe(false);
    expect(hasRole("viewer", "viewer")).toBe(true);
  });
});
