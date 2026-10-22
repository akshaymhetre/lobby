/**
 * Generic outbound webhook: POSTs JSON for every ticket event, signed with HMAC-SHA256.
 * Headers: X-Lobby-Event, X-Lobby-Delivery, X-Lobby-Timestamp, X-Lobby-Signature (sha256=<hex>
 * over "<timestamp>.<body>"). A receiver may answer with { externalKey, url, status } to link
 * the ticket to its own record.
 */
import { randomUUID } from "node:crypto";
import { signWebhook } from "./secret";
import { ConnectorError, type FetchLike, type LinkRef, type PushResult, type TicketConnector, type TicketPayload, type UpdateEvent } from "./types";

export interface WebhookConfig {
  url: string;
  secret: string;
}

const TIMEOUT_MS = 10_000;

export class WebhookConnector implements TicketConnector {
  readonly kind = "webhook" as const;

  constructor(
    private readonly config: WebhookConfig,
    private readonly fetchImpl: FetchLike = fetch,
    private readonly now: () => number = Date.now,
  ) {}

  private async send(event: string, payload: Record<string, unknown>): Promise<PushResult> {
    const body = JSON.stringify({ event, sentAt: new Date(this.now()).toISOString(), ...payload });
    const timestamp = Math.floor(this.now() / 1000);
    let res: Response;
    try {
      res = await this.fetchImpl(this.config.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "Lobby-Webhook/1",
          "X-Lobby-Event": event,
          "X-Lobby-Delivery": randomUUID(),
          "X-Lobby-Timestamp": String(timestamp),
          "X-Lobby-Signature": signWebhook(this.config.secret, timestamp, body),
        },
        body,
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (err) {
      throw new ConnectorError(`Couldn't reach ${hostOf(this.config.url)}: ${(err as Error).message}`);
    }
    const text = await res.text().catch(() => "");
    if (!res.ok) throw new ConnectorError(`${hostOf(this.config.url)} answered ${res.status}.${text ? ` ${text.slice(0, 200)}` : ""}`, res.status);
    try {
      const j = JSON.parse(text) as { externalKey?: unknown; url?: unknown; status?: unknown };
      return {
        externalKey: typeof j.externalKey === "string" ? j.externalKey : null,
        externalUrl: typeof j.url === "string" && /^https?:\/\//.test(j.url) ? j.url : null,
        status: typeof j.status === "string" ? j.status : null,
      };
    } catch {
      return {};
    }
  }

  create(ticket: TicketPayload) {
    return this.send("ticket.created", { ticket });
  }

  update(link: LinkRef, ticket: TicketPayload, event: UpdateEvent) {
    return this.send("ticket.updated", { ticket, change: event, externalKey: link.externalKey });
  }

  async comment(link: LinkRef, comment: { body: string; authorName: string }, ticket: TicketPayload) {
    await this.send("ticket.commented", { ticket, comment: { body: comment.body, author: comment.authorName }, externalKey: link.externalKey });
  }

  async fetchStatus() {
    return null;
  }

  verifyInbound() {
    return false;
  }

  parseInbound() {
    return null;
  }

  async test() {
    try {
      await this.send("ping", { message: "Test delivery from Lobby." });
      return { ok: true, message: `${hostOf(this.config.url)} accepted a signed test delivery.` };
    } catch (err) {
      return { ok: false, message: (err as Error).message };
    }
  }
}

function hostOf(url: string) {
  try {
    return new URL(url).host;
  } catch {
    return "The webhook";
  }
}
