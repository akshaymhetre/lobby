/**
 * Jira Service Management via its customer-facing REST API (/rest/servicedeskapi).
 *  - create:  POST /rest/servicedeskapi/request { serviceDeskId, requestTypeId, requestFieldValues }
 *  - status:  GET  /rest/servicedeskapi/request/{key}/status (newest first)
 *  - comment: POST /rest/servicedeskapi/request/{key}/comment { body, public }
 * Auth is HTTP basic with the account email and an API token.
 * Inbound: Jira webhooks or automation rules POST to /api/webhooks/jira-sm/<connectorId>
 * with the shared secret in `X-Lobby-Webhook-Secret` or `?secret=`.
 */
import { safeEqual } from "./secret";
import { ConnectorError, type FetchLike, type InboundRequest, type LinkRef, type TicketConnector, type TicketPayload, type UpdateEvent } from "./types";

export interface JiraSmConfig {
  baseUrl: string;
  email: string;
  apiToken: string;
  serviceDeskId: string;
  requestTypeId: string;
  /** Raise the Jira request as the Lobby requester (they must exist as a Jira customer). */
  raiseOnBehalfOf?: boolean;
  webhookSecret?: string;
}

const TIMEOUT_MS = 15_000;

export class JiraServiceManagementConnector implements TicketConnector {
  readonly kind = "jira_sm" as const;
  private readonly base: string;

  constructor(
    private readonly config: JiraSmConfig,
    private readonly fetchImpl: FetchLike = fetch,
  ) {
    this.base = config.baseUrl.replace(/\/+$/, "");
  }

  private async call<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
    const auth = Buffer.from(`${this.config.email}:${this.config.apiToken}`).toString("base64");
    let res: Response;
    try {
      res = await this.fetchImpl(`${this.base}${path}`, {
        method,
        headers: {
          Authorization: `Basic ${auth}`,
          Accept: "application/json",
          ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (err) {
      throw new ConnectorError(`Couldn't reach Jira at ${this.base}: ${(err as Error).message}`);
    }
    const text = await res.text();
    if (!res.ok) throw new ConnectorError(describeJiraError(res.status, text), res.status);
    return (text ? JSON.parse(text) : {}) as T;
  }

  async create(ticket: TicketPayload) {
    const body: Record<string, unknown> = {
      serviceDeskId: this.config.serviceDeskId,
      requestTypeId: this.config.requestTypeId,
      requestFieldValues: {
        summary: `${ticket.subject} (Lobby #${ticket.number})`.slice(0, 255),
        description: describe(ticket),
      },
    };
    if (this.config.raiseOnBehalfOf) body.raiseOnBehalfOf = ticket.requester.email;
    const res = await this.call<{ issueKey: string; currentStatus?: { status?: string }; _links?: { web?: string } }>("POST", "/rest/servicedeskapi/request", body);
    if (!res.issueKey) throw new ConnectorError("Jira accepted the request but returned no key.");
    return { externalKey: res.issueKey, externalUrl: res._links?.web ?? `${this.base}/browse/${res.issueKey}`, status: res.currentStatus?.status ?? null };
  }

  async update(link: LinkRef, ticket: TicketPayload, event: UpdateEvent) {
    if (!link.externalKey) throw new ConnectorError("This ticket has not been sent to Jira yet.");
    const text =
      event.kind === "status" ? `Status in Lobby changed from ${event.from} to ${event.to}.` : event.kind === "priority" ? `Priority in Lobby changed from ${event.from} to ${event.to}.` : `Updated in Lobby.`;
    await this.call("POST", `/rest/servicedeskapi/request/${encodeURIComponent(link.externalKey)}/comment`, { body: `${text}\n${ticket.url}`, public: false });
    return {};
  }

  async comment(link: LinkRef, comment: { body: string; authorName: string }) {
    if (!link.externalKey) throw new ConnectorError("This ticket has not been sent to Jira yet.");
    await this.call("POST", `/rest/servicedeskapi/request/${encodeURIComponent(link.externalKey)}/comment`, {
      body: `${comment.authorName} wrote in Lobby:\n\n${comment.body}`,
      public: true,
    });
  }

  async fetchStatus(link: LinkRef) {
    if (!link.externalKey) return null;
    const res = await this.call<{ values?: { status: string; statusCategory?: string }[] }>("GET", `/rest/servicedeskapi/request/${encodeURIComponent(link.externalKey)}/status?limit=1`);
    const latest = res.values?.[0];
    return latest ? { status: latest.status, category: latest.statusCategory ?? null } : null;
  }

  verifyInbound(req: InboundRequest): boolean {
    const expected = this.config.webhookSecret;
    if (!expected) return false;
    const given = req.headers.get("x-lobby-webhook-secret") ?? req.url.searchParams.get("secret") ?? "";
    return safeEqual(given, expected);
  }

  /**
   * Accepts Jira's native issue webhook (`issue.key`, `issue.fields.status`) and a simple
   * automation-rule body (`{ "issueKey": "{{issue.key}}", "status": "{{issue.status.name}}" }`).
   */
  parseInbound(req: InboundRequest) {
    let body: Record<string, unknown>;
    try {
      body = JSON.parse(req.body) as Record<string, unknown>;
    } catch {
      return null;
    }
    const issue = (body.issue ?? {}) as { key?: string; fields?: { status?: { name?: string; statusCategory?: { key?: string } } } };
    const key = issue.key ?? (body.issueKey as string | undefined) ?? (body.key as string | undefined);
    const status = issue.fields?.status?.name ?? (body.status as string | undefined) ?? (body.currentStatus as { status?: string } | undefined)?.status;
    const category = issue.fields?.status?.statusCategory?.key ?? (body.statusCategory as string | undefined) ?? null;
    if (typeof key !== "string" || typeof status !== "string" || !key || !status) return null;
    return { externalKey: key, status, category };
  }

  async test() {
    try {
      const desk = await this.call<{ projectName?: string; projectKey?: string }>("GET", `/rest/servicedeskapi/servicedesk/${encodeURIComponent(this.config.serviceDeskId)}`);
      const rt = await this.call<{ name?: string }>(
        "GET",
        `/rest/servicedeskapi/servicedesk/${encodeURIComponent(this.config.serviceDeskId)}/requesttype/${encodeURIComponent(this.config.requestTypeId)}`,
      );
      return { ok: true, message: `Connected to ${desk.projectName ?? "the service desk"}${desk.projectKey ? ` (${desk.projectKey})` : ""}. New requests become "${rt.name ?? "that request type"}".` };
    } catch (err) {
      return { ok: false, message: (err as Error).message };
    }
  }
}

function describe(t: TicketPayload): string {
  const lines = [
    t.description || "(No description)",
    "",
    `Raised in Lobby by ${t.requester.name} (${t.requester.email})`,
    `${t.requestType ? `${t.requestType.name}, ` : ""}${t.team.name} team, priority ${t.priority}`,
    ...t.fields.map((f) => `${f.label}: ${f.value}`),
    "",
    t.url,
  ];
  return lines.join("\n").slice(0, 30_000);
}

function describeJiraError(status: number, text: string): string {
  let detail = "";
  try {
    const j = JSON.parse(text) as { errorMessage?: string; errorMessages?: string[]; errors?: Record<string, string> };
    detail = j.errorMessage ?? j.errorMessages?.join(" ") ?? Object.values(j.errors ?? {}).join(" ");
  } catch {
    detail = text.slice(0, 200);
  }
  const hint =
    status === 401 ? "Check the email and API token." : status === 403 ? "The account can't do that in this service desk." : status === 404 ? "Check the service desk and request type ids." : "";
  return [`Jira answered ${status}.`, detail, hint].filter(Boolean).join(" ").trim();
}
