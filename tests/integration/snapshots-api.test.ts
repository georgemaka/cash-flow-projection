/**
 * Integration tests for /api/snapshots route handlers.
 *
 * Covers list, create, lock, unlock, and copy endpoints.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

vi.mock("@/lib/auth", () => ({
  requireSignedIn: vi.fn(),
  requireAdmin: vi.fn(),
  requireEditorOrAbove: vi.fn()
}));

vi.mock("@/lib/snapshots/service-factory", () => ({
  snapshotService: {
    list: vi.fn(),
    getById: vi.fn(),
    create: vi.fn(),
    lock: vi.fn(),
    unlock: vi.fn(),
    copyFromPrior: vi.fn()
  }
}));

import { GET as listSnapshotsRoute, POST as createSnapshotRoute } from "@/app/api/snapshots/route";
import { POST as lockSnapshotRoute } from "@/app/api/snapshots/lock/route";
import { POST as unlockSnapshotRoute } from "@/app/api/snapshots/unlock/route";
import { POST as copySnapshotRoute } from "@/app/api/snapshots/copy/route";
import { requireSignedIn, requireAdmin, requireEditorOrAbove } from "@/lib/auth";
import { snapshotService } from "@/lib/snapshots/service-factory";

function makeRequest(method: string, body?: unknown): Request {
  return new Request("http://localhost/api/snapshots", {
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

// ── LIST snapshots ───────────────────────────────────────────────────────────

describe("GET /api/snapshots", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    passGuard(requireSignedIn);
    (snapshotService.list as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: "s1", name: "FY2026", status: "draft" }
    ]);
  });

  it("returns 200 with snapshot list", async () => {
    const req = makeRequest("GET");
    const res = await listSnapshotsRoute();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(1);
  });

  it("returns 401 when not signed in", async () => {
    failGuard401(requireSignedIn);
    const res = await listSnapshotsRoute();
    expect(res.status).toBe(401);
  });
});

// ── CREATE snapshot ──────────────────────────────────────────────────────────

describe("POST /api/snapshots (create)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    passGuard(requireEditorOrAbove);
    (snapshotService.create as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "s1",
      name: "FY2026",
      status: "draft"
    });
  });

  it("creates snapshot and returns 201", async () => {
    const req = makeRequest("POST", {
      name: "FY2026",
      asOfMonth: "2026-01",
      createdBy: "user-1"
    });
    const res = await createSnapshotRoute(req);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.name).toBe("FY2026");
  });

  it("returns 400 for invalid asOfMonth format", async () => {
    const req = makeRequest("POST", { name: "FY2026", asOfMonth: "bad", createdBy: "u" });
    const res = await createSnapshotRoute(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 for missing required fields", async () => {
    const req = makeRequest("POST", { name: "FY2026" });
    const res = await createSnapshotRoute(req);
    expect(res.status).toBe(400);
  });

  it("returns 401 when not signed in", async () => {
    failGuard401(requireEditorOrAbove);
    const req = makeRequest("POST", { name: "FY2026", asOfMonth: "2026-01", createdBy: "u" });
    const res = await createSnapshotRoute(req);
    expect(res.status).toBe(401);
  });

  it("returns 403 for viewer role", async () => {
    failGuard403(requireEditorOrAbove);
    const req = makeRequest("POST", { name: "FY2026", asOfMonth: "2026-01", createdBy: "u" });
    const res = await createSnapshotRoute(req);
    expect(res.status).toBe(403);
  });

  it("returns 500 on service error", async () => {
    (snapshotService.create as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("DB down"));
    const req = makeRequest("POST", { name: "FY2026", asOfMonth: "2026-01", createdBy: "u" });
    const res = await createSnapshotRoute(req);
    expect(res.status).toBe(500);
  });
});

// ── LOCK snapshot ────────────────────────────────────────────────────────────

describe("POST /api/snapshots/lock", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    passGuard(requireAdmin);
    (snapshotService.lock as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "s1",
      status: "locked"
    });
  });

  it("locks snapshot and returns 200", async () => {
    const req = makeRequest("POST", { snapshotId: "s1", lockedBy: "admin-1" });
    const res = await lockSnapshotRoute(req);
    expect(res.status).toBe(200);
  });

  it("returns 400 for missing lockedBy", async () => {
    const req = makeRequest("POST", { snapshotId: "s1" });
    const res = await lockSnapshotRoute(req);
    expect(res.status).toBe(400);
  });

  it("returns 401 when not signed in", async () => {
    failGuard401(requireAdmin);
    const req = makeRequest("POST", { snapshotId: "s1", lockedBy: "a" });
    const res = await lockSnapshotRoute(req);
    expect(res.status).toBe(401);
  });

  it("returns 409 when snapshot already locked", async () => {
    (snapshotService.lock as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("Snapshot is already locked")
    );
    const req = makeRequest("POST", { snapshotId: "s1", lockedBy: "admin-1" });
    const res = await lockSnapshotRoute(req);
    expect(res.status).toBe(409);
  });
});

// ── UNLOCK snapshot ──────────────────────────────────────────────────────────

describe("POST /api/snapshots/unlock", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    passGuard(requireAdmin);
    (snapshotService.unlock as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "s1",
      status: "draft"
    });
  });

  it("unlocks snapshot and returns 200", async () => {
    const req = makeRequest("POST", { snapshotId: "s1", unlockedBy: "admin-1" });
    const res = await unlockSnapshotRoute(req);
    expect(res.status).toBe(200);
  });

  it("returns 400 for missing unlockedBy", async () => {
    const req = makeRequest("POST", { snapshotId: "s1" });
    const res = await unlockSnapshotRoute(req);
    expect(res.status).toBe(400);
  });

  it("returns 409 when snapshot already draft", async () => {
    (snapshotService.unlock as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("Snapshot is already unlocked")
    );
    const req = makeRequest("POST", { snapshotId: "s1", unlockedBy: "admin-1" });
    const res = await unlockSnapshotRoute(req);
    expect(res.status).toBe(409);
  });
});

// ── COPY snapshot ────────────────────────────────────────────────────────────

describe("POST /api/snapshots/copy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    passGuard(requireEditorOrAbove);
    (snapshotService.copyFromPrior as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "s2",
      name: "FY2027",
      status: "draft"
    });
  });

  it("copies snapshot and returns 201", async () => {
    const req = makeRequest("POST", {
      sourceSnapshotId: "s1",
      name: "FY2027",
      asOfMonth: "2027-01",
      createdBy: "u1"
    });
    const res = await copySnapshotRoute(req);
    expect(res.status).toBe(201);
  });

  it("returns 400 for missing fields", async () => {
    const req = makeRequest("POST", { sourceSnapshotId: "s1" });
    const res = await copySnapshotRoute(req);
    expect(res.status).toBe(400);
  });

  it("returns 409 when source is not locked", async () => {
    (snapshotService.copyFromPrior as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("Can only copy from a locked snapshot")
    );
    const req = makeRequest("POST", {
      sourceSnapshotId: "s1",
      name: "FY2027",
      asOfMonth: "2027-01",
      createdBy: "u1"
    });
    const res = await copySnapshotRoute(req);
    expect(res.status).toBe(409);
  });
});
