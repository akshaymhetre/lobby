import { expect, test } from "@playwright/test";
import { devSignIn, email } from "./helpers";

const CONFIDENTIAL = "/knowledge/people-confidential/salary-bands-2026";

test.describe("permissions follow the identity provider's groups", () => {
  test("positive control: a People team member can see the confidential page everywhere", async ({ page }) => {
    await devSignIn(page, email("priya.raman"), CONFIDENTIAL);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/salary bands/i);
    await page.goto("/search?q=salary%20bands");
    await expect(page.getByText(/salary bands 2026/i).first()).toBeVisible();
    // Same assistant question the engineer asks below: here it must find the page.
    const answer = await page.evaluate(async () => {
      const r = await fetch("/api/assistant", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: "What are the salary bands for 2026?" }),
      });
      return r.text();
    });
    expect(answer.toLowerCase()).toContain("salary bands 2026");
  });

  test("an engineer cannot reach it by list, link, search or the assistant", async ({ page }) => {
    await devSignIn(page, email("maya.chen"), "/knowledge");
    await expect(page.getByText(/people team only/i)).toHaveCount(0);

    const res = await page.goto(CONFIDENTIAL);
    expect(res?.status()).toBe(404);
    await expect(page.getByText(/salary bands 2026/i)).toHaveCount(0);

    await page.goto("/search?q=salary%20bands");
    await expect(page.getByText(/salary bands 2026/i)).toHaveCount(0);

    const answer = await page.evaluate(async () => {
      const r = await fetch("/api/assistant", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: "What are the salary bands for 2026?" }),
      });
      return r.text();
    });
    expect(answer.toLowerCase()).not.toContain("salary bands 2026");
  });

  test("non-admins cannot open the admin console", async ({ page }) => {
    await devSignIn(page, email("maya.chen"), "/admin");
    await expect(page.getByText(/do not have access/i)).toBeVisible();
  });

  test("apps limited to a group are hidden from everyone else", async ({ page }) => {
    await devSignIn(page, email("maya.chen"), "/apps");
    await expect(page.getByRole("link", { name: /grafana/i }).first()).toBeVisible();
    await devSignIn(page, email("olivia.brooks"), "/apps");
    await expect(page.getByRole("link", { name: /^grafana/i })).toHaveCount(0);
  });
  test("gated pages answer with real status codes, not a 200 that hides the refusal", async ({ page }) => {
    // Positive control first: an agent sees every ticket in the queue, so we can pick one Maya does not own.
    await devSignIn(page, email("alex.morgan"), "/queue");
    const all = [...new Set([...(await page.content()).matchAll(/\/queue\/(\d+)/g)].map((m) => m[1]))];
    expect(all.length).toBeGreaterThan(1);
    expect((await page.goto(`/queue/${all[0]}`))?.status()).toBe(200);

    await devSignIn(page, email("maya.chen"), "/help/requests");
    const mine = new Set([...(await page.content()).matchAll(/\/help\/(\d+)/g)].map((m) => m[1]));
    expect(mine.size).toBeGreaterThan(0);
    const own = [...mine][0];
    const other = all.find((n) => !mine.has(n));
    expect(other).toBeTruthy();

    expect((await page.goto(`/help/${own}`))?.status()).toBe(200);
    expect((await page.goto(`/help/${other}`))?.status()).toBe(404);
    expect((await page.goto("/queue"))?.status()).toBe(403);
    expect((await page.goto(`/queue/${other}`))?.status()).toBe(403);
  });
});
