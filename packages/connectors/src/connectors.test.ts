import { describe, expect, it } from "vitest";
import { JiraServiceManagementConnector } from "./jira-sm";
import { WebhookConnector } from "./webhook";
import { signWebhook, verifyWebhookSignature } from "./secret";
import { ConnectorError, type TicketPayload } from "./types";

interface Call {
  url: string;
  init: RequestInit;
}

function mockFetch(responses: { status?: number; body?: unknown }[]) {
  const calls: Call[] = [];
  let i = 0;
  const fn = async (url: string, init: RequestInit = {}) => {
    calls.push({ url, init });
    const r = responses[Math.min(i++, responses.length - 1)] ?? {};
    const body = r.body === undefined ? "" : typeof r.body === "string" ? r.body : JSON.stringify(r.body);
    const status = r.status ?? 200;
    return new Response(status === 204 ? null : body, { status, headers: { "Content-Type": "application/json" } });
  };
  return { fn, calls };
}

const ticket: TicketPayload = {
  id: "8f8b4b34-1d7e-4d0f-9d3a-3d6a1a6f0e11",
  number: 1042,
  subject: "Figma access for design reviews",
  description: "I review designs every week.",
  status: "open",
  priority: "normal",
  url: "http://localhost:4100/help/1042",
  createdAt: "2026-10-15T09:00:00.000Z",
  team: { slug: "it", name: "IT" },
  requestType: { slug: "app-access", name: "Access to an app" },
  requester: { name: "Maya Chen", email: "maya.chen@northwind.example" },
  fields: [{ label: "App", value: "Figma" }],
};

const jiraConfig = {
  baseUrl: "https://northwind.atlassian.net/",
  email: "it-bot@northwind.example",
  apiToken: "tok_123",
  serviceDeskId: "4",
  requestTypeId: "27",
  webhookSecret: "s3cret",
};

describe("JiraServiceManagementConnector", () => {
  it("creates a request with basic auth and the servicedeskapi body", async () => {
    const m = mockFetch([{ status: 201, body: { issueKey: "IT-88", currentStatus: { status: "Waiting for support" }, _links: { web: "https://northwind.atlassian.net/servicedesk/customer/portal/4/IT-88" } } }]);
    const jira = new JiraServiceManagementConnector({ ...jiraConfig, raiseOnBehalfOf: true }, m.fn);
    const res = await jira.create(ticket);

    expect(res).toEqual({ externalKey: "IT-88", externalUrl: "https://northwind.atlassian.net/servicedesk/customer/portal/4/IT-88", status: "Waiting for support" });
    expect(m.calls).toHaveLength(1);
    const call = m.calls[0]!;
    expect(call.url).toBe("https://northwind.atlassian.net/rest/servicedeskapi/request");
    expect(call.init.method).toBe("POST");
    const headers = call.init.headers as Record<string, string>;
    expect(headers.Authorization).toBe(`Basic ${Buffer.from("it-bot@northwind.example:tok_123").toString("base64")}`);
    const body = JSON.parse(String(call.init.body));
    expect(body.serviceDeskId).toBe("4");
    expect(body.requestTypeId).toBe("27");
    expect(body.raiseOnBehalfOf).toBe("maya.chen@northwind.example");
    expect(body.requestFieldValues.summary).toBe("Figma access for design reviews (Lobby #1042)");
    expect(body.requestFieldValues.description).toContain("App: Figma");
    expect(body.requestFieldValues.description).toContain("http://localhost:4100/help/1042");
  });

  it("adds public comments and reads the newest status", async () => {
    const m = mockFetch([{ status: 201, body: { id: "1" } }, { body: { values: [{ status: "Resolved", statusCategory: "DONE" }, { status: "In progress" }] } }]);
    const jira = new JiraServiceManagementConnector(jiraConfig, m.fn);
    await jira.comment({ externalKey: "IT-88" }, { body: "Done, try now.", authorName: "Alex Morgan" });
    const st = await jira.fetchStatus({ externalKey: "IT-88" });

    expect(m.calls[0]!.url).toBe("https://northwind.atlassian.net/rest/servicedeskapi/request/IT-88/comment");
    expect(JSON.parse(String(m.calls[0]!.init.body))).toEqual({ body: "Alex Morgan wrote in Lobby:\n\nDone, try now.", public: true });
    expect(m.calls[1]!.url).toBe("https://northwind.atlassian.net/rest/servicedeskapi/request/IT-88/status?limit=1");
    expect(st).toEqual({ status: "Resolved", category: "DONE" });
  });

  it("turns Jira errors into readable ConnectorErrors", async () => {
    const m = mockFetch([{ status: 401, body: { errorMessage: "Client must be authenticated" } }]);
    const jira = new JiraServiceManagementConnector(jiraConfig, m.fn);
    const err = await jira.create(ticket).catch((e) => e);
    expect(err).toBeInstanceOf(ConnectorError);
    expect(err.status).toBe(401);
    expect(err.message).toContain("Client must be authenticated");
    expect(err.message).toContain("Check the email and API token.");
  });

  it("refuses to comment before the request exists", async () => {
    const jira = new JiraServiceManagementConnector(jiraConfig, mockFetch([]).fn);
    await expect(jira.comment({ externalKey: null }, { body: "x", authorName: "y" })).rejects.toThrow(/not been sent/);
  });

  it("verifies the inbound secret from a header or the query string", () => {
    const jira = new JiraServiceManagementConnector(jiraConfig, mockFetch([]).fn);
    const url = new URL("http://lobby/api/webhooks/jira-sm/x");
    expect(jira.verifyInbound({ headers: new Headers({ "x-lobby-webhook-secret": "s3cret" }), url, body: "" })).toBe(true);
    expect(jira.verifyInbound({ headers: new Headers(), url: new URL("http://lobby/x?secret=s3cret"), body: "" })).toBe(true);
    expect(jira.verifyInbound({ headers: new Headers({ "x-lobby-webhook-secret": "wrong" }), url, body: "" })).toBe(false);
    expect(jira.verifyInbound({ headers: new Headers(), url, body: "" })).toBe(false);
    const noSecret = new JiraServiceManagementConnector({ ...jiraConfig, webhookSecret: undefined }, mockFetch([]).fn);
    expect(noSecret.verifyInbound({ headers: new Headers({ "x-lobby-webhook-secret": "" }), url, body: "" })).toBe(false);
  });

  it("parses native issue webhooks and automation bodies", () => {
    const jira = new JiraServiceManagementConnector(jiraConfig, mockFetch([]).fn);
    const req = (body: unknown) => ({ headers: new Headers(), url: new URL("http://lobby/x"), body: JSON.stringify(body) });
    expect(jira.parseInbound(req({ webhookEvent: "jira:issue_updated", issue: { key: "IT-88", fields: { status: { name: "Done", statusCategory: { key: "done" } } } } }))).toEqual({
      externalKey: "IT-88",
      status: "Done",
      category: "done",
    });
    expect(jira.parseInbound(req({ issueKey: "IT-90", status: "Waiting for customer" }))).toEqual({ externalKey: "IT-90", status: "Waiting for customer", category: null });
    expect(jira.parseInbound(req({ hello: "world" }))).toBeNull();
    expect(jira.parseInbound({ headers: new Headers(), url: new URL("http://lobby/x"), body: "not json" })).toBeNull();
  });

  it("tests the connection against the service desk and request type", async () => {
    const m = mockFetch([{ body: { projectName: "IT Service Desk", projectKey: "IT" } }, { body: { name: "Get IT help" } }]);
    const r = await new JiraServiceManagementConnector(jiraConfig, m.fn).test();
    expect(r.ok).toBe(true);
    expect(r.message).toContain("IT Service Desk (IT)");
    expect(m.calls.map((c) => c.url)).toEqual([
      "https://northwind.atlassian.net/rest/servicedeskapi/servicedesk/4",
      "https://northwind.atlassian.net/rest/servicedeskapi/servicedesk/4/requesttype/27",
    ]);
    const bad = await new JiraServiceManagementConnector(jiraConfig, mockFetch([{ status: 404, body: { errorMessage: "No service desk" } }]).fn).test();
    expect(bad.ok).toBe(false);
    expect(bad.message).toContain("Check the service desk and request type ids.");
  });
});

describe("WebhookConnector", () => {
  const now = () => Date.parse("2026-10-15T10:00:00Z");

  it("posts signed JSON that a receiver can verify", async () => {
    const m = mockFetch([{ body: { externalKey: "OPS-7", url: "https://ops.example/7" } }]);
    const hook = new WebhookConnector({ url: "https://ops.example/hooks/lobby", secret: "whsec" }, m.fn, now);
    const res = await hook.create(ticket);

    expect(res).toEqual({ externalKey: "OPS-7", externalUrl: "https://ops.example/7", status: null });
    const call = m.calls[0]!;
    const headers = call.init.headers as Record<string, string>;
    expect(headers["X-Lobby-Event"]).toBe("ticket.created");
    expect(headers["X-Lobby-Timestamp"]).toBe(String(now() / 1000));
    const body = String(call.init.body);
    expect(JSON.parse(body).ticket.number).toBe(1042);
    expect(headers["X-Lobby-Signature"]).toBe(signWebhook("whsec", now() / 1000, body));
    expect(verifyWebhookSignature("whsec", { signature: headers["X-Lobby-Signature"]!, timestamp: headers["X-Lobby-Timestamp"]! }, body, now())).toBe(true);
    // Tampered body, wrong secret and stale timestamps are refused.
    expect(verifyWebhookSignature("whsec", { signature: headers["X-Lobby-Signature"]!, timestamp: headers["X-Lobby-Timestamp"]! }, body + " ", now())).toBe(false);
    expect(verifyWebhookSignature("other", { signature: headers["X-Lobby-Signature"]!, timestamp: headers["X-Lobby-Timestamp"]! }, body, now())).toBe(false);
    expect(verifyWebhookSignature("whsec", { signature: headers["X-Lobby-Signature"]!, timestamp: headers["X-Lobby-Timestamp"]! }, body, now() + 600_000)).toBe(false);
  });

  it("sends comments and updates as their own events", async () => {
    const m = mockFetch([{ body: "" }, { body: "" }]);
    const hook = new WebhookConnector({ url: "https://ops.example/h", secret: "whsec" }, m.fn, now);
    await hook.comment({ externalKey: "OPS-7" }, { body: "On it", authorName: "Alex Morgan" }, ticket);
    await hook.update({ externalKey: "OPS-7" }, ticket, { kind: "status", from: "open", to: "resolved" });
    const bodies = m.calls.map((c) => JSON.parse(String(c.init.body)));
    expect(bodies[0].event).toBe("ticket.commented");
    expect(bodies[0].comment).toEqual({ body: "On it", author: "Alex Morgan" });
    expect(bodies[1].event).toBe("ticket.updated");
    expect(bodies[1].change).toEqual({ kind: "status", from: "open", to: "resolved" });
  });

  it("reports non-2xx answers and supports no status or inbound", async () => {
    const hook = new WebhookConnector({ url: "https://ops.example/h", secret: "whsec" }, mockFetch([{ status: 500, body: "boom" }]).fn, now);
    await expect(hook.create(ticket)).rejects.toThrow("ops.example answered 500. boom");
    expect(await hook.fetchStatus()).toBeNull();
    expect(hook.verifyInbound()).toBe(false);
    const t = await new WebhookConnector({ url: "https://ops.example/h", secret: "whsec" }, mockFetch([{ status: 204 }]).fn, now).test();
    expect(t.ok).toBe(true);
  });
});
