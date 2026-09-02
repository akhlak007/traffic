import { test, expect } from "@playwright/test";

const pages = [
  "admin-dashboard", "admin-cameras", "admin-zones", "admin-users", "database-viewer",
  "officer-dashboard", "officer-verification", "officer-notices", "officer-appeals", "officer-incidents",
  "supervisor-dashboard", "supervisor-appeals", "owner-dashboard", "owner-vehicles",
  "owner-notices", "owner-payment", "owner-appeal", "dmp-dashboard", "dmp-vehicle-lookup"
];

const roleFor = (name) => name.startsWith("admin") || name === "database-viewer" ? "admin"
  : name.startsWith("officer") ? "officer" : name.startsWith("supervisor") ? "supervisor"
    : name.startsWith("owner") ? "owner" : "dmp";

for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
  test(`all role pages render and navigate at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    for (const name of pages) {
      await page.goto(`/pages/${name}.html?role=${roleFor(name)}`);
      await expect(page.locator("[data-app-shell]")).toBeVisible();
      await expect(page.locator("body")).not.toContainText("Data could not be loaded");
      if (name !== "database-viewer") await expect(page.locator("h1")).toBeVisible();
    }
  });
}

test("demo login and primary forms are usable", async ({ page }) => {
  page.on("pageerror", (error) => console.error("Browser page error:", error.message));
  await page.goto("/index.html");
  await expect(page.locator('body[data-login-ready="true"]')).toBeVisible();
  await page.selectOption("#data-mode", "mock");
  await page.getByLabel("Traffic Officer").check();
  await page.getByRole("button", { name: /Sign in/ }).click();
  await expect(page).toHaveURL(/officer-dashboard/);
  await page.goto("/pages/owner-payment.html?role=owner");
  await expect(page.getByText("Select an eligible notice")).toBeVisible();
  await page.goto("/pages/owner-appeal.html?role=owner");
  await expect(page.getByText("Select an eligible notice")).toBeVisible();
});
