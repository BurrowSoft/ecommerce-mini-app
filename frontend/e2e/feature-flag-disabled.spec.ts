import { test, expect } from "@playwright/test";

const DEMO_EMAIL = process.env.SEED_DEMO_USER_EMAIL ?? "demo@example.com";
const DEMO_PASSWORD = process.env.SEED_DEMO_USER_PASSWORD ?? "ChangeMe123!";

// NEXT_PUBLIC_* values are inlined into the frontend bundle at build/dev-server
// start time (see README "Extras" -> "Feature flag"), so this can't be toggled
// per-test against a server already running with the flag enabled — it
// requires the dev server itself to have been started with the flag off:
//   NEXT_PUBLIC_ENABLE_SEARCH_EXTRAS=false npm run dev
//   NEXT_PUBLIC_ENABLE_SEARCH_EXTRAS=false npx playwright test feature-flag-disabled
// Skipped by default (i.e. in a normal `npm run test:e2e` run against the
// flag-enabled dev server) so it doesn't fail the default suite.
test.skip(
  process.env.NEXT_PUBLIC_ENABLE_SEARCH_EXTRAS !== "false",
  "run with NEXT_PUBLIC_ENABLE_SEARCH_EXTRAS=false against a dev server started the same way",
);

test("falls back to the pre-extras UI when the search-extras flag is disabled", async ({ page }) => {
  await page.goto("/login");
  await page.fill("#email", DEMO_EMAIL);
  await page.fill("#password", DEMO_PASSWORD);
  await page.click("button[type=submit]");
  await page.waitForURL((url) => url.pathname === "/");
  await expect(page.locator("h3").first()).toBeVisible();

  const input = page.locator('input[aria-label="Search products"]');
  await expect(input).not.toHaveAttribute("role", "combobox");

  await input.fill("cha");
  await page.waitForTimeout(500);
  await expect(page.locator("#search-suggestions-listbox")).toHaveCount(0);

  await input.fill("chair");
  await page.waitForTimeout(500);
  await expect(page.locator("h3 mark")).toHaveCount(0);
});
