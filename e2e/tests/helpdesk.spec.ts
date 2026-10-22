import { expect, test } from "@playwright/test";
import { devSignIn, email } from "./helpers";

test.describe("helpdesk", () => {
  test("an employee raises a request, an agent replies, and internal notes stay internal", async ({ page }) => {
    const stamp = Date.now().toString(36);
    const subject = `VPN drops every few minutes ${stamp}`;
    const note = `Internal: check the Berlin concentrator ${stamp}`;
    const reply = `Thanks Maya, we are looking at it now ${stamp}`;

    // Employee raises a request through the catalog form.
    await devSignIn(page, email("maya.chen"), "/help/new?type=vpn-issue");
    await page.getByRole("textbox", { name: "Summary" }).fill(subject);
    await page.getByRole("combobox", { name: /where are you working from/i }).click();
    await page.getByRole("option").first().click();
    await page.getByRole("button", { name: "Send request" }).click();
    await expect(page).toHaveURL(/\/help\/\d+/);
    const number = page.url().match(/\/help\/(\d+)/)![1];

    // Agent works it: an internal note and a public reply.
    await devSignIn(page, email("alex.morgan"), `/queue/${number}`);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(subject);
    await page.getByRole("tab", { name: "Internal note" }).click();
    const composer = page.locator("#agent-composer");
    await composer.fill(note);
    await page.getByRole("button", { name: /add note|save note|send note/i }).click();
    await expect(page.getByText(note)).toBeVisible();
    await expect(composer).toHaveValue("");
    await page.getByRole("tab", { name: /reply to/i }).click();
    await composer.fill(reply);
    await expect(composer).toHaveValue(reply);
    await page.getByRole("button", { name: "Send reply" }).click();
    await expect(page.getByText(reply)).toBeVisible();

    // Requester sees the reply but never the note.
    await devSignIn(page, email("maya.chen"), `/help/${number}`);
    await expect(page.getByText(reply)).toBeVisible();
    await expect(page.getByText(note)).toHaveCount(0);
  });

  test("an approval request waits for the manager, who can approve it", async ({ page }) => {
    const stamp = Date.now().toString(36);
    await devSignIn(page, email("maya.chen"), "/help/new?type=software-request");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const summary = page.getByRole("textbox", { name: "Summary" });
    await summary.fill(`Need a Tailscale licence for the VPN ${stamp}`);
    // Typing the summary loads suggested articles; let that settle before filling the rest.
    await expect(page.getByText(/these might answer it/i)).toBeVisible();
    await page.getByLabel(/^software/i).fill("Diagram editor");
    await page.getByRole("textbox", { name: /why do you need it/i }).fill("Diagramming for the platform roadmap");
    await expect(summary).toHaveValue(new RegExp(stamp));
    await page.getByRole("button", { name: /send for approval/i }).click();
    await expect(page).toHaveURL(/\/help\/\d+/);
    await expect(page.getByText(/waiting for approval|pending approval/i).first()).toBeVisible();

    // Maya's manager (Nikolai Petrov) approves it from Approvals.
    await devSignIn(page, email("nikolai.petrov"), "/approvals");
    const row = page.getByText(new RegExp(stamp)).first();
    await expect(row).toBeVisible();
    await row.click();
    await page.getByRole("button", { name: /^approve/i }).first().click();
    await expect(page.getByText(/approved/i).first()).toBeVisible();
  });
});
