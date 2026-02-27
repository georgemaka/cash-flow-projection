/**
 * Integration tests for /api/groups route handlers.
 *
 * Tests the full route flow: auth guard → body parse → http-handler → JSON response.
 * Prisma is never called; both the auth module and service factory are vi.mock'd.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

// ── Mocks (must be declared before any import that uses them) ───────────────

vi.mock("@/lib/auth", () => ({
  requireSignedIn: vi.fn(),
  requireAdmin: vi.fn(),
  requireEditorOrAbove: vi.fn()
}));

vi.mock("@/lib/groups/service-factory", () => ({
  groupService: {
    list: vi.fn(),
    getById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    archive: vi.fn()
  }
}));

// ── Imports (after mock declarations) ──────────────────────────────────────

import { GET as listGroupsRoute, POST as createGroupRoute } from "@/app/api/groups/route";
import { requireSignedIn, requireAdmin } from "@/lib/auth";
import { groupService } from "@/lib/groups/service-factory";

// ── Helpers ─────────────────────────────────────────────────────────────────

function makeRequest(method: string, url: string, body?: unknown): Request {
  return new Request(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body !== undefined ? JSON.stringify(body) : undefined
  });
}

function passGuard(mock: unknown) {
  (mock as ReturnType<typeof vi.fn>).mockResolvedValue(null);
}

function failGuard401(mock: unknown) {
  (mock as ReturnType<typeof vi.fn>).mockResolvedValue(
    NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  );
}

function failGuard403(mock: unknown) {
  (mock as ReturnType<typeof vi.fn>).mockResolvedValue(
    NextResponse.json({ error: "Forbidden" }, { status: 403 })
  );
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("GET /api/groups", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    passGuard(requireSignedIn);
    (groupService.list as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: "g1", name: "Operations", groupType: "sector" }
    ]);
  });

  it("returns 200 with groups list", async () => {
    const req = makeRequest("GET", "http://localhost/api/groups");
    const res = await listGroupsRoute(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(1);
  });

  it("returns 401 when not signed in", async () => {
    failGuard401(requireSignedIn);
    const req = makeRequest("GET", "http://localhost/api/groups");
    const res = await listGroupsRoute(req);
    expect(res.status).toBe(401);
  });

  it("returns 500 on service error", async () => {
    (groupService.list as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("DB down"));
    const req = makeRequest("GET", "http://localhost/api/groups");
    const res = await listGroupsRoute(req);
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBeTruthy();
  });
});

describe("POST /api/groups", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    passGuard(requireAdmin);
    (groupService.create as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "g1",
      name: "Operations",
      groupType: "sector"
    });
  });

  it("creates group and returns 201", async () => {
    const req = makeRequest("POST", "http://localhost/api/groups", {
      name: "Operations",
      groupType: "sector"
    });
    const res = await createGroupRoute(req);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.name).toBe("Operations");
  });

  it("returns 400 for missing groupType", async () => {
    const req = makeRequest("POST", "http://localhost/api/groups", { name: "Ops" });
    const res = await createGroupRoute(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBeTruthy();
  });

  it("returns 400 for invalid groupType", async () => {
    const req = makeRequest("POST", "http://localhost/api/groups", {
      name: "Ops",
      groupType: "invalid"
    });
    const res = await createGroupRoute(req);
    expect(res.status).toBe(400);
  });

  it("returns 401 when not signed in", async () => {
    failGuard401(requireAdmin);
    const req = makeRequest("POST", "http://localhost/api/groups", {
      name: "Ops",
      groupType: "sector"
    });
    const res = await createGroupRoute(req);
    expect(res.status).toBe(401);
  });

  it("returns 403 for non-admin role", async () => {
    failGuard403(requireAdmin);
    const req = makeRequest("POST", "http://localhost/api/groups", {
      name: "Ops",
      groupType: "sector"
    });
    const res = await createGroupRoute(req);
    expect(res.status).toBe(403);
  });

  it("returns 400 for invalid JSON body", async () => {
    const req = new Request("http://localhost/api/groups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not-json"
    });
    const res = await createGroupRoute(req);
    expect(res.status).toBe(400);
  });

  it("returns 500 on service error", async () => {
    (groupService.create as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("DB down"));
    const req = makeRequest("POST", "http://localhost/api/groups", {
      name: "Ops",
      groupType: "sector"
    });
    const res = await createGroupRoute(req);
    expect(res.status).toBe(500);
  });
});
