import { NextResponse, type NextRequest } from "next/server";
import { handleInbound } from "@lobby/connectors";

/**
 * Inbound status updates from Jira Service Management. No user session: the caller proves
 * itself with the connector's shared secret (X-Lobby-Webhook-Secret header or ?secret=).
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ connectorId: string }> }) {
  const { connectorId } = await params;
  const body = await req.text();
  if (body.length > 1_000_000) return NextResponse.json({ ok: false, message: "Payload too large" }, { status: 413 });
  try {
    const r = await handleInbound(connectorId, { headers: req.headers, url: req.nextUrl, body });
    return NextResponse.json({ ok: r.status < 400, message: r.message }, { status: r.status });
  } catch (err) {
    console.error("[webhooks/jira-sm]", err);
    return NextResponse.json({ ok: false, message: "Could not process the update" }, { status: 500 });
  }
}
