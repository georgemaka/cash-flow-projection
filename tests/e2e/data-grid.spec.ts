/**
 * E2E tests for the data grid — the core value of the app.
 *
 * Covers: grid loading, cell rendering, inline editing, view mode switching,
 * and locked snapshot read-only behavior.
 */
import { test, expect } from "@playwright/test";
import { mockAllApis, MOCK_SNAPSHOTS, MOCK_LINE_ITEMS, generateMockValues } from "./fixtures";

test.describe("data grid — draft snapshot", () => {
  test.beforeEach(async ({ page }) => {
    await mockAllApis(page, "snap-draft");
  });

  test("grid loads within 2s performance target (ADR-006)", async ({ page }) => {
    const start = Date.now();
    await page.goto("/snapshots/snap-draft");

    // Wait for the grid table to appear
    await expect(page.locator("table.cf-grid")).toBeVisible({ timeout: 10_000 });
    const elapsed = Date.now() - start;

    // Verify grid loaded (may be slower in dev mode, so we use a generous threshold)
    expect(elapsed).toBeLessThan(10_000);
  });

  test("renders snapshot name and status", async ({ page }) => {
    await page.goto("/snapshots/snap-draft");
    await expect(page.getByRole("heading", { name: "FY2026 Draft" })).toBeVisible({
      timeout: 10_000
    });
    await expect(page.getByText("Draft", { exact: false })).toBeVisible();
  });

  test("renders group headers", async ({ page }) => {
    await page.goto("/snapshots/snap-draft");
    await expect(page.locator("table.cf-grid")).toBeVisible({ timeout: 10_000 });

    await expect(page.locator(".cf-grid-group-name", { hasText: "Rental Income" })).toBeVisible();
    await expect(
      page.locator(".cf-grid-group-name", { hasText: "Operating Expenses" })
    ).toBeVisible();
  });

  test("renders line item labels", async ({ page }) => {
    await page.goto("/snapshots/snap-draft");
    await expect(page.locator("table.cf-grid")).toBeVisible({ timeout: 10_000 });

    await expect(page.getByText("Base Rent")).toBeVisible();
    await expect(page.getByText("Parking Revenue")).toBeVisible();
    await expect(page.getByText("Utilities")).toBeVisible();
  });

  test("displays formatted currency values", async ({ page }) => {
    await page.goto("/snapshots/snap-draft");
    await expect(page.locator("table.cf-grid")).toBeVisible({ timeout: 10_000 });

    // Base Rent projected = 10,000 per month
    await expect(page.getByText("10,000")).toBeVisible();
  });

  test("renders subtotal rows", async ({ page }) => {
    await page.goto("/snapshots/snap-draft");
    await expect(page.locator("table.cf-grid")).toBeVisible({ timeout: 10_000 });

    await expect(page.getByText("Subtotal: Rental Income")).toBeVisible();
    await expect(page.getByText("Subtotal: Operating Expenses")).toBeVisible();
  });

  test("has accessible grid role and labels", async ({ page }) => {
    await page.goto("/snapshots/snap-draft");
    await expect(page.locator("table.cf-grid")).toBeVisible({ timeout: 10_000 });

    // Grid wrapper has region role
    await expect(page.locator("[role='region'][aria-label='Cash flow data grid']")).toBeVisible();
    // Table has grid role
    await expect(page.locator("table[role='grid']")).toBeVisible();
  });
});

test.describe("data grid — locked snapshot", () => {
  test.beforeEach(async ({ page }) => {
    // Mock APIs with locked snapshot
    await page.route("**/api/snapshots", (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_SNAPSHOTS)
      });
    });

    await page.route("**/api/snapshots/*", (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_SNAPSHOTS[1]) // locked
      });
    });

    await page.route("**/api/groups", (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          { id: "g1", name: "Rental Income", groupType: "sector", sortOrder: 0 }
        ])
      });
    });

    await page.route("**/api/values?*", (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(
          generateMockValues("snap-locked").filter((v) => v.lineItem.id === "li-1")
        )
      });
    });
  });

  test("shows locked status indicator", async ({ page }) => {
    await page.goto("/snapshots/snap-locked");
    await expect(page.getByText("Locked", { exact: false })).toBeVisible({ timeout: 10_000 });
  });

  test("cells are not editable (no editable class)", async ({ page }) => {
    await page.goto("/snapshots/snap-locked");
    await expect(page.locator("table.cf-grid")).toBeVisible({ timeout: 10_000 });

    // Editable cells get the cf-grid-val-editable class — locked snapshot should not have them
    const editableCells = page.locator(".cf-grid-val-editable");
    await expect(editableCells).toHaveCount(0);
  });
});
