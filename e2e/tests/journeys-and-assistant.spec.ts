import { expect, test } from "@playwright/test";
import { devSignIn, email } from "./helpers";

test.describe("onboarding journeys", () => {
  test("a new hire sees their journey and can tick off a step", async ({ page }) => {
    await devSignIn(page, email("sam.okafor"), "/journeys");
    await expect(page.getByText(/you start tomorrow|day 1|welcome/i).first()).toBeVisible();
    const before = await page.getByRole("checkbox", { checked: true }).count();
    const open = page.getByRole("checkbox", { checked: false }).first();
    await open.click();
    await expect(page.getByRole("checkbox", { checked: true })).toHaveCount(before + 1);
    await page.reload();
    await expect(page.getByRole("checkbox", { checked: true })).toHaveCount(before + 1);
  });

  test("a manager sees their new hire's progress", async ({ page }) => {
    await devSignIn(page, email("grace.okoye"), "/journeys");
    await expect(page.getByText("Sam Okafor").first()).toBeVisible();
  });
});

test.describe("assistant", () => {
  test("answers from the knowledge base with sources the user can open", async ({ page }) => {
    await devSignIn(page, email("maya.chen"), "/");
    await page.getByRole("button", { name: "Ask the assistant", exact: true }).click();
    const box = page.getByRole("textbox", { name: "Ask the assistant" });
    await box.fill("How much parental leave do we get?");
    await box.press("Enter");
    await expect(page.getByText("Sources", { exact: true })).toBeVisible({ timeout: 60_000 });
    const source = page.getByRole("link", { name: /parental leave/i }).first();
    await expect(source).toBeVisible();
    await source.click();
    await expect(page).toHaveURL(/\/knowledge\/people\/parental-leave/);
  });
});
