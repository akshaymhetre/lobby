import { expect, type Page } from "@playwright/test";

export const DEMO_PASSWORD = "northwind";

/** Signs in through the real identity provider (Keycloak), exactly as an employee would. */
export async function ssoSignIn(page: Page, username: string, returnTo = "/") {
  await page.goto(`/sign-in?returnTo=${encodeURIComponent(returnTo)}`);
  await page.getByRole("link", { name: /continue with/i }).click();
  // Keycloak's login form (stable element ids across themes).
  await page.locator("#username").fill(username);
  await page.locator("#password").fill(DEMO_PASSWORD);
  await page.locator("#kc-login").click();
  await expect(page).toHaveURL(new RegExp(`localhost:4100${returnTo === "/" ? "/?$" : returnTo.replace(/[/?]/g, "\\$&")}`));
}

/** Development impersonation (LOBBY_DEV_LOGIN=1), for tests that are not about sign-in. */
export async function devSignIn(page: Page, email: string, returnTo = "/") {
  await page.goto(`/auth/dev-login?email=${encodeURIComponent(email)}&returnTo=${encodeURIComponent(returnTo)}`);
  // Typing before React hydrates loses the input, so wait for the page to settle.
  await page.waitForLoadState("networkidle");
}

export const email = (username: string) => `${username}@northwind.example`;
