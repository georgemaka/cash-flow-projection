/**
 * Shared mock data and route helpers for e2e tests.
 */
import type { Page } from "@playwright/test";

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

export const MOCK_SNAPSHOTS = [
  {
    id: "snap-draft",
    name: "FY2026 Draft",
    status: "draft",
    asOfMonth: "2026-01-01T00:00:00.000Z",
    createdAt: "2026-01-15T10:00:00Z",
    createdBy: "user-1"
  },
  {
    id: "snap-locked",
    name: "FY2025 Locked",
    status: "locked",
    asOfMonth: "2025-01-01T00:00:00.000Z",
    createdAt: "2025-06-01T10:00:00Z",
    createdBy: "user-1",
    lockedBy: "admin-1",
    lockedAt: "2025-12-31T10:00:00Z"
  }
];

export const MOCK_GROUPS = [
  { id: "g1", name: "Rental Income", groupType: "sector", sortOrder: 0, isActive: true },
  { id: "g2", name: "Operating Expenses", groupType: "sector", sortOrder: 1, isActive: true }
];

export const MOCK_LINE_ITEMS = [
  { id: "li-1", groupId: "g1", label: "Base Rent", projectionMethod: "annual_spread", sortOrder: 0 },
  { id: "li-2", groupId: "g1", label: "Parking Revenue", projectionMethod: "manual", sortOrder: 1 },
  { id: "li-3", groupId: "g2", label: "Utilities", projectionMethod: "prior_year_pct", sortOrder: 0 }
];

export function generateMockValues(snapshotId: string) {
  const values = [];
  for (const li of MOCK_LINE_ITEMS) {
    for (let m = 1; m <= 12; m++) {
      const period = `2026-${String(m).padStart(2, "0")}-01T00:00:00.000Z`;
      values.push({
        lineItemId: li.id,
        snapshotId,
        period,
        projectedAmount: li.id === "li-1" ? "10000.00" : li.id === "li-2" ? "500.00" : "1200.00",
        actualAmount: m <= 3 ? (li.id === "li-1" ? "10500.00" : li.id === "li-2" ? "480.00" : "1150.00") : null,
        note: null,
        lineItem: li
      });
    }
  }
  return values;
}

// ---------------------------------------------------------------------------
// Route interceptors
// ---------------------------------------------------------------------------

export async function mockAllApis(page: Page, snapshotId = "snap-draft") {
  // Snapshot list
  await page.route("**/api/snapshots", (route) => {
    if (route.request().method() === "GET") {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_SNAPSHOTS)
      });
    } else {
      route.continue();
    }
  });

  // Snapshot detail
  await page.route("**/api/snapshots/*", (route) => {
    const url = route.request().url();
    const match = url.match(/\/api\/snapshots\/([^/?]+)/);
    const id = match?.[1];
    const snap = MOCK_SNAPSHOTS.find((s) => s.id === id);
    if (snap) {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(snap)
      });
    } else {
      route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ error: "Not found" }) });
    }
  });

  // Groups
  await page.route("**/api/groups", (route) => {
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(MOCK_GROUPS)
    });
  });

  // Values
  await page.route("**/api/values?*", (route) => {
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(generateMockValues(snapshotId))
    });
  });

  // Value upsert
  await page.route("**/api/values/upsert", (route) => {
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: { id: "v-new" } })
    });
  });

  // Line items
  await page.route("**/api/line-items**", (route) => {
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: MOCK_LINE_ITEMS })
    });
  });

  // Excel export
  await page.route("**/api/exports/excel**", (route) => {
    route.fulfill({
      status: 200,
      contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      body: Buffer.from("PK\x03\x04fake-xlsx-content") // Minimal non-empty response
    });
  });
}
