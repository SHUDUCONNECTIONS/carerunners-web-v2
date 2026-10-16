import { test, expect } from "playwright/test";

test("signed-out visitors are sent to the login page from protected routes", async ({ page }) => {
  for (const path of ["/dashboard", "/request", "/trips", "/billing"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/auth\/login/, { timeout: 30_000 });
  }
});

test("login page renders the sign-in form", async ({ page }) => {
  await page.goto("/auth/login");
  await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
  await expect(page.locator('input[type="email"]')).toBeVisible();
  await expect(page.locator('input[type="password"]')).toBeVisible();
});

test("login blocks an empty submit via browser validation", async ({ page }) => {
  await page.goto("/auth/login");
  await page.locator('form button[type="submit"]').click();
  await expect(page.locator('input[type="email"]:invalid')).toBeVisible();
  await expect(page).toHaveURL(/\/auth\/login/);
});

test("unknown routes show the 404 page", async ({ page }) => {
  await page.goto("/no-such-page");
  await expect(page.getByRole("heading", { name: "404" })).toBeVisible();
});

test("offline page renders", async ({ page }) => {
  await page.goto("/offline");
  await expect(page.getByRole("heading", { name: /offline/i })).toBeVisible();
});

test("responses carry the security headers", async ({ request }) => {
  const res = await request.get("/auth/login");
  expect(res.headers()["x-frame-options"]).toBe("DENY");
  expect(res.headers()["x-content-type-options"]).toBe("nosniff");
});
