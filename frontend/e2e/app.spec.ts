import { test, expect, Page } from "@playwright/test";

const DEMO_EMAIL = process.env.SEED_DEMO_USER_EMAIL ?? "demo@example.com";
const DEMO_PASSWORD = process.env.SEED_DEMO_USER_PASSWORD ?? "ChangeMe123!";

// Assumes: frontend dev server + backend + a seeded Postgres are all running
// (see README "Running the e2e tests"). Serial + a single shared page: this
// flow is one continuous user journey (logged-out -> wrong creds -> logged
// in -> browse -> search -> filter -> scroll -> logout), and re-logging in
// per test would needlessly multiply attempts against the real login rate
// limiter (test.describe.serial alone only orders tests, it doesn't share
// page/context — that needs an explicit shared `page` created once here).
test.describe.serial("catalog app", () => {
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
  });

  test.afterAll(async () => {
    await page.close();
  });

  test("redirects unauthenticated visitors to /login", async () => {
    await page.goto("/");
    await page.waitForURL("**/login");
    expect(page.url()).toContain("/login");
  });

  test("shows a clear error on wrong credentials", async () => {
    await page.fill("#email", DEMO_EMAIL);
    await page.fill("#password", "definitely-wrong-password");
    await page.click("button[type=submit]");

    const error = page.locator("p[role=alert]"); // scoped past Next's route-announcer, which is a <div>
    await expect(error).toHaveText("Invalid email or password.");
  });

  test("logs in with correct credentials and reaches the catalog", async () => {
    await page.fill("#email", DEMO_EMAIL);
    await page.fill("#password", DEMO_PASSWORD);
    await page.click("button[type=submit]");
    await page.waitForURL((url) => url.pathname === "/");

    await expect(page.locator("h3").first()).toBeVisible();
  });

  test("shows a visually distinguished sponsored item in the browse view", async () => {
    // Exact slot math (position 5, 10, 20, ...) is covered by backend unit
    // tests (sponsored-slots.spec.ts); this just confirms it actually
    // renders with the required visual distinction in the real browser.
    await expect(page.locator("text=Sponsored").first()).toBeVisible();
  });

  test("search filters results and hides sponsored items entirely", async () => {
    await page.fill('input[aria-label="Search products"]', "chair");
    await page.waitForTimeout(500); // debounce + fetch
    await expect(page.locator("text=Sponsored")).toHaveCount(0);
    await expect(page.locator("h3").first()).toBeVisible();
  });

  test("highlights the matched search term within result names", async () => {
    // Search box already holds "chair" from the previous test.
    const marks = page.locator("h3 mark");
    await expect(marks.first()).toBeVisible();
    await expect(marks.first()).toHaveText(/chair/i);
  });

  test("clearing search and filtering by category updates the list", async () => {
    await page.click('button[aria-label="Clear search"]');
    await page.selectOption('select[aria-label="Filter by category"]', { label: "Books" });
    await page.waitForTimeout(500);

    const categoryLabels = page.locator("p.text-\\[11px\\]");
    await expect(categoryLabels.first()).toHaveText("Books");
  });

  test("infinite scroll loads more items while keeping the DOM bounded (virtualized)", async () => {
    await page.selectOption('select[aria-label="Filter by category"]', { label: "All categories" });
    await page.waitForTimeout(500);

    for (let i = 0; i < 6; i++) {
      await page.mouse.wheel(0, 2000);
      await page.waitForTimeout(300);
    }

    const renderedCards = await page.locator("h3").count();
    // Virtualization should keep this small regardless of how far scrolled —
    // a real bug caught during manual verification had this at 600+.
    expect(renderedCards).toBeLessThan(60);
  });

  test("logs out and is redirected, losing access to the catalog", async () => {
    await page.click("button:has-text('Log out')");
    await page.waitForURL("**/login");
    await page.goto("/");
    await page.waitForURL("**/login");
  });
});
