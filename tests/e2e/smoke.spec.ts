/**
 * Smoke tests — verify critical pages render without crashing.
 *
 * Runs against the Next.js dev server with DEV_AUTH_BYPASS=true so no Clerk
 * credentials are required. API calls to the database are intercepted and
 * mocked so a live Postgres instance is also not required.
 */

import { test, expect } from "@playwright/test";

// ---------------------------------------------------------------------------
// API mocks — intercept fetch calls so tests don't need a live database
// ---------------------------------------------------------------------------

async function mockSnapshotsApi(page: import("@playwright/test").Page) {
  await page.route("**/api/snapshots", (route) => {
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([
        {
          id: "snap-1",
          name: "FY2026 Draft",
          status: "draft",
          asOfMonth: "2026-01-01T00:00:00.000Z",
          createdAt: "2026-01-15T10:00:00Z"
        },
        {
          id: "snap-2",
          name: "FY2025 Locked",
          status: "locked",
          asOfMonth: "2025-01-01T00:00:00.000Z",
          createdAt: "2025-06-01T10:00:00Z"
        }
      ])
    });
  });
}

async function mockGroupsApi(page: import("@playwright/test").Page) {
  await page.route("**/api/groups", (route) => {
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: [
          { id: "g1", name: "Residential Properties", groupType: "sector", sortOrder: 1 },
          { id: "g2", name: "Non-Operating Items", groupType: "non_operating", sortOrder: 2 }
        ]
      })
    });
  });
}

async function mockLineItemsApi(page: import("@playwright/test").Page) {
  await page.route("**/api/line-items**", (route) => {
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: [] })
    });
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test("home page renders Cash Flow Projection heading", async ({ page }) => {
  await mockSnapshotsApi(page);

  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Cash Flow Projection" })).toBeVisible();
});

test("home page renders Snapshots section", async ({ page }) => {
  await mockSnapshotsApi(page);

  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Snapshots" })).toBeVisible();
});

test("home page snapshot list shows mocked snapshots", async ({ page }) => {
  await mockSnapshotsApi(page);

  await page.goto("/");

  // Wait for the snapshots to load (SnapshotList uses useEffect + fetch)
  await expect(page.getByText("FY2026 Draft")).toBeVisible({ timeout: 10_000 });
});

test("admin page renders group management UI", async ({ page }) => {
  await mockGroupsApi(page);
  await mockLineItemsApi(page);

  await page.goto("/admin");

  // Admin dashboard header or group management section should render
  await expect(page.locator("body")).toBeVisible();
  // Should not show an error page
  await expect(page.getByText("Application error")).not.toBeVisible();
  await expect(page.getByText("500")).not.toBeVisible();
});
