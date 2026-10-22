/** A ticket as connectors see it: plain data, no database types. */
export interface TicketPayload {
  id: string;
  number: number;
  subject: string;
  description: string;
  status: string;
  priority: string;
  url: string;
  createdAt: string;
  team: { slug: string; name: string };
  requestType: { slug: string; name: string } | null;
  requester: { name: string; email: string };
  fields: { label: string; value: string }[];
}

export interface LinkRef {
  externalKey: string | null;
  externalUrl?: string | null;
}

export interface PushResult {
  externalKey?: string | null;
  externalUrl?: string | null;
  status?: string | null;
}

export interface ExternalStatus {
  status: string;
  category?: string | null;
}

export interface InboundRequest {
  headers: Headers;
  url: URL;
  body: string;
}

export interface InboundUpdate {
  externalKey: string;
  status: string;
  category?: string | null;
}

export type UpdateEvent = { kind: "status"; from: string; to: string } | { kind: "priority"; from: string; to: string } | { kind: "other" };

/**
 * One external ticketing system. Implementations must be safe to retry: `create` is only
 * called when no external key is recorded for the ticket yet.
 */
export interface TicketConnector {
  readonly kind: "jira_sm" | "webhook";
  create(ticket: TicketPayload): Promise<PushResult>;
  update(link: LinkRef, ticket: TicketPayload, event: UpdateEvent): Promise<PushResult>;
  comment(link: LinkRef, comment: { body: string; authorName: string }, ticket: TicketPayload): Promise<void>;
  /** Null when the system cannot report status (a plain webhook). */
  fetchStatus(link: LinkRef): Promise<ExternalStatus | null>;
  /** True when the request carries the shared secret. */
  verifyInbound(req: InboundRequest): boolean;
  /** The status change described by an inbound webhook, or null when it is not one. */
  parseInbound(req: InboundRequest): InboundUpdate | null;
  /** A harmless call that proves the settings work. */
  test(): Promise<{ ok: boolean; message: string }>;
}

export class ConnectorError extends Error {
  constructor(
    message: string,
    public status?: number,
  ) {
    super(message);
    this.name = "ConnectorError";
  }
}

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;
