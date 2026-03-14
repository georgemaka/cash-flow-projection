/**
 * E2E tests for snapshot list navigation, compare mode, and admin page.
 */
import { test, expect } from "@playwright/test";
import { mockAllApis, MOCK_SNAPSHOTS, MOCK_GROUPS } from "./fixtures";

test.describe("snapshot list navigation", () => {
  test.beforeEach(async ({ page }) => {
    await mockAllApis(page, "snap-draft");
  });

  test("home page shows snapshot list with both snapshots", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("FY2026 Draft")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("FY2025 Locked")).toBeVisible();
  });

  test("clicking a snapshot navigates to its detail page", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("FY2026 Draft")).toBeVisible({ timeout: 10_000 });

    await page.getByText("FY2026 Draft").click();
    await page.waitForURL("**/snapshots/snap-draft");
    await expect(page.getByRole("heading", { name: "FY2026 Draft" })).toBeVisible({
      timeout: 10_000
    });
  });

  test("snapshot status chips are displayed", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator(".snapshot-chip.draft")).toBeVisible({ timeout: 10_000 });
    await expect(page.locator(".snapshot-chip.locked")).toBeVisible();
  });

  test("compare mode button toggles compare selection", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Compare two snapshots")).toBeVisible({ timeout: 10_000 });

    await page.getByText("Compare two snapshots").click();
    await expect(page.getByText("Pick first snapshot…")).toBeVisible();

    // Cancel exits compare mode
    await page.getByText("Cancel").click();
    await expect(page.getByText("Compare two snapshots")).toBeVisible();
  });

  test("breadcrumb on detail page navigates to home", async ({ page }) => {
    await page.goto("/snapshots/snap-draft");
    await expect(page.locator("table.cf-grid")).toBeVisible({ timeout: 10_000 });

    // Breadcrumb "Dashboard" link replaces the old back button
    await page.locator(".breadcrumb-link").first().click();
    await page.waitForURL("/");
  });
});

test.describe("admin page", () => {
  test.beforeEach(async ({ page }) => {
    await mockAllApis(page, "snap-draft");
  });

  test("admin page renders without errors", async ({ page }) => {
    await page.goto("/admin");

    // Should not show error pages
    await expect(page.locator("body")).toBeVisible();
    await expect(page.getByText("Application error")).not.toBeVisible();
    await expect(page.getByText("500")).not.toBeVisible();
  });
});
