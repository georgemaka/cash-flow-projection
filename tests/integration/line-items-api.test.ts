/**
 * Integration tests for /api/line-items route handlers.
 *
 * Covers list, create, get-by-id, update, and archive endpoints.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

vi.mock("@/lib/auth", () => ({
  requireSignedIn: vi.fn(),
  requireAdmin: vi.fn(),
  requireEditorOrAbove: vi.fn()
}));

vi.mock("@/lib/line-items/service-factory", () => ({
  lineItemService: {
    list: vi.fn(),
    getById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    archive: vi.fn()
  }
}));

import { GET as listLineItemsRoute, POST as createLineItemRoute } from "@/app/api/line-items/route";
import {
  GET as getLineItemRoute,
  PATCH as updateLineItemRoute,
  DELETE as archiveLineItemRoute
} from "@/app/api/line-items/[lineItemId]/route";
import { requireSignedIn, requireAdmin } from "@/lib/auth";
import { lineItemService } from "@/lib/line-items/service-factory";

function makeRequest(method: string, url: string, body?: unknown): Request {
  return new Request(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body !== undefined ? JSON.stringify(body) : undefined
  });
}

function makeParams(lineItemId: string) {
  return { params: Promise.resolve({ lineItemId }) };
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

// ── LIST line items ───────────────────────────────────────────────────────────

describe("GET /api/line-items", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    passGuard(requireSignedIn);
    (lineItemService.list as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: "li-1", label: "Rent Revenue", groupId: "g1" }
    ]);
  });

  it("returns 200 with line items list", async () => {
    const req = makeRequest("GET", "http://localhost/api/line-items");
    const res = await listLineItemsRoute(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(1);
  });

  it("returns 401 when not signed in", async () => {
    failGuard401(requireSignedIn);
    const req = makeRequest("GET", "http://localhost/api/line-items");
    const res = await listLineItemsRoute(req);
    expect(res.status).toBe(401);
  });

  it("returns 500 on service error", async () => {
    (lineItemService.list as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("DB down"));
    const req = makeRequest("GET", "http://localhost/api/line-items");
    const res = await listLineItemsRoute(req);
    expect(res.status).toBe(500);
  });
});

// ── CREATE line item ──────────────────────────────────────────────────────────

describe("POST /api/line-items", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    passGuard(requireAdmin);
    (lineItemService.create as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "li-new",
      label: "Tenant Rent",
      groupId: "g1"
    });
  });

  it("creates line item and returns 201", async () => {
    const req = makeRequest("POST", "http://localhost/api/line-items", {
      groupId: "g1",
      label: "Tenant Rent",
      projectionMethod: "manual",
      createdBy: "admin-1"
    });
    const res = await createLineItemRoute(req);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.label).toBe("Tenant Rent");
  });

  it("returns 400 for missing groupId", async () => {
    const req = makeRequest("POST", "http://localhost/api/line-items", {
      label: "Tenant Rent"
    });
    const res = await createLineItemRoute(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid projectionMethod", async () => {
    const req = makeRequest("POST", "http://localhost/api/line-items", {
      groupId: "g1",
      label: "Tenant Rent",
      projectionMethod: "bad_method"
    });
    const res = await createLineItemRoute(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid JSON body", async () => {
    const req = new Request("http://localhost/api/line-items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not-json"
    });
    const res = await createLineItemRoute(req);
    expect(res.status).toBe(400);
  });

  it("returns 401 when not signed in", async () => {
    failGuard401(requireAdmin);
    const req = makeRequest("POST", "http://localhost/api/line-items", {
      groupId: "g1",
      label: "Tenant Rent"
    });
    const res = await createLineItemRoute(req);
    expect(res.status).toBe(401);
  });

  it("returns 403 for non-admin role", async () => {
    failGuard403(requireAdmin);
    const req = makeRequest("POST", "http://localhost/api/line-items", {
      groupId: "g1",
      label: "Tenant Rent"
    });
    const res = await createLineItemRoute(req);
    expect(res.status).toBe(403);
  });

  it("returns 500 on service error", async () => {
    (lineItemService.create as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("DB down"));
    const req = makeRequest("POST", "http://localhost/api/line-items", {
      groupId: "g1",
      label: "Tenant Rent"
    });
    const res = await createLineItemRoute(req);
    expect(res.status).toBe(500);
  });
});

// ── GET line item by id ───────────────────────────────────────────────────────

describe("GET /api/line-items/[lineItemId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    passGuard(requireSignedIn);
    (lineItemService.getById as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "li-1",
      label: "Rent Revenue"
    });
  });

  it("returns 200 with line item", async () => {
    const req = makeRequest("GET", "http://localhost/api/line-items/li-1");
    const res = await getLineItemRoute(req, makeParams("li-1"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.id).toBe("li-1");
  });

  it("returns 404 when line item not found", async () => {
    (lineItemService.getById as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("No LineItem found")
    );
    const req = makeRequest("GET", "http://localhost/api/line-items/missing");
    const res = await getLineItemRoute(req, makeParams("missing"));
    expect(res.status).toBe(404);
  });

  it("returns 401 when not signed in", async () => {
    failGuard401(requireSignedIn);
    const req = makeRequest("GET", "http://localhost/api/line-items/li-1");
    const res = await getLineItemRoute(req, makeParams("li-1"));
    expect(res.status).toBe(401);
  });
});

// ── UPDATE line item ──────────────────────────────────────────────────────────

describe("PATCH /api/line-items/[lineItemId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    passGuard(requireAdmin);
    (lineItemService.update as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "li-1",
      label: "Updated Label"
    });
  });

  it("updates line item and returns 200", async () => {
    const req = makeRequest("PATCH", "http://localhost/api/line-items/li-1", {
      label: "Updated Label",
      updatedBy: "admin-1"
    });
    const res = await updateLineItemRoute(req, makeParams("li-1"));
    expect(res.status).toBe(200);
  });

  it("returns 400 when no updatable fields provided", async () => {
    const req = makeRequest("PATCH", "http://localhost/api/line-items/li-1", {
      updatedBy: "admin-1"
    });
    const res = await updateLineItemRoute(req, makeParams("li-1"));
    expect(res.status).toBe(400);
  });

  it("returns 401 when not signed in", async () => {
    failGuard401(requireAdmin);
    const req = makeRequest("PATCH", "http://localhost/api/line-items/li-1", {
      label: "Updated"
    });
    const res = await updateLineItemRoute(req, makeParams("li-1"));
    expect(res.status).toBe(401);
  });
});

// ── ARCHIVE line item ─────────────────────────────────────────────────────────

describe("DELETE /api/line-items/[lineItemId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    passGuard(requireAdmin);
    (lineItemService.archive as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "li-1",
      isActive: false
    });
  });

  it("archives line item and returns 200", async () => {
    const req = makeRequest("DELETE", "http://localhost/api/line-items/li-1", {
      archivedBy: "admin-1"
    });
    const res = await archiveLineItemRoute(req, makeParams("li-1"));
    expect(res.status).toBe(200);
  });

  it("returns 409 when already archived", async () => {
    (lineItemService.archive as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("Line item is already archived")
    );
    const req = makeRequest("DELETE", "http://localhost/api/line-items/li-1", {
      archivedBy: "admin-1"
    });
    const res = await archiveLineItemRoute(req, makeParams("li-1"));
    expect(res.status).toBe(409);
  });

  it("returns 401 when not signed in", async () => {
    failGuard401(requireAdmin);
    const req = makeRequest("DELETE", "http://localhost/api/line-items/li-1");
    const res = await archiveLineItemRoute(req, makeParams("li-1"));
    expect(res.status).toBe(401);
  });
});
