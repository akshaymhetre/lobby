import { expect, test } from "@playwright/test";
import { ssoSignIn } from "./helpers";

test.describe("single sign-on", () => {
  test("an employee signs in through the IdP and lands on their home page", async ({ page }) => {
    await ssoSignIn(page, "maya.chen");
    await expect(page.getByRole("navigation", { name: "Main" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Account menu" })).toContainText("Maya Chen");
  });

  test("opening Grafana from the launcher signs in silently with the same IdP session", async ({ page, context }) => {
    await ssoSignIn(page, "maya.chen", "/apps");
    const popup = context.waitForEvent("page");
    await page.getByRole("link", { name: /grafana/i }).first().click();
    const grafana = await popup;
    await grafana.waitForLoadState("domcontentloaded");
    await expect(grafana).toHaveURL(/localhost:4130/, { timeout: 20_000 });
    // No login form: Grafana is already showing the signed-in user's home.
    await expect(grafana.locator("#username")).toHaveCount(0);
    const user = await grafana.evaluate(() => fetch("/api/user").then((r) => r.json()));
    expect(user.login).toBe("maya.chen");
  });

  test("opening Expenses (behind oauth2-proxy) signs in silently too", async ({ page, context }) => {
    await ssoSignIn(page, "maya.chen", "/apps");
    const popup = context.waitForEvent("page");
    await page.getByRole("link", { name: /expenses/i }).first().click();
    const app = await popup;
    await expect(app.getByTestId("signed-in-as")).toContainText("maya.chen", { timeout: 20_000 });
  });

  test("signing out ends the IdP session as well", async ({ page }) => {
    await ssoSignIn(page, "maya.chen");
    await page.getByRole("button", { name: "Account menu" }).click();
    await page.getByRole("menuitem", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/signed-out/);
    await page.goto("/");
    await expect(page).toHaveURL(/sign-in/);
  });
});
