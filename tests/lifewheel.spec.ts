import { test } from "@playwright/test";

test.describe.skip("LifeWheel smoke flows", () => {
  test("can capture idea and convert to task", async ({ page }) => {
    await page.goto("http://localhost:3000/app");
    // Auth and Supabase setup required. This test is skipped in CI by default.
  });

  test("completing a task triggers XP feedback", async ({ page }) => {
    await page.goto("http://localhost:3000/app");
  });

  test("calendar sync paints watch ring", async ({ page }) => {
    await page.goto("http://localhost:3000/app");
  });

  test("paywall blocks once usage limit exceeded", async ({ page }) => {
    await page.goto("http://localhost:3000/app");
  });
});

