import type { NextRequest } from "next/server";
import { env } from "@lobby/core";
import { handleScimRequest } from "@lobby/core/people/scim";

/**
 * SCIM 2.0 endpoint for identity providers (Okta, Entra ID, ...). Authenticated by a bearer token
 * from scim_tokens, never by a session cookie. All protocol logic lives in @lobby/core/people/scim.
 */
export const dynamic = "force-dynamic";

const MAX_BODY = 1024 * 1024;

async function handle(req: NextRequest, ctx: { params: Promise<{ path?: string[] }> }) {
  const { path = [] } = await ctx.params;
  const body = req.method === "GET" || req.method === "DELETE" ? "" : await req.text();
  if (body.length > MAX_BODY) {
    return scimJson(413, {
      schemas: ["urn:ietf:params:scim:api:messages:2.0:Error"],
      status: "413",
      detail: "The request body is too large.",
    });
  }
  const res = await handleScimRequest({
    method: req.method,
    segments: path.map(decodeURIComponent),
    query: req.nextUrl.searchParams,
    body,
    authorization: req.headers.get("authorization"),
    baseUrl: `${env.url.replace(/\/$/, "")}/api/scim/v2`,
  });
  if (res.body === null) return new Response(null, { status: res.status, headers: res.headers });
  return scimJson(res.status, res.body, res.headers);
}

function scimJson(status: number, body: unknown, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/scim+json; charset=utf-8", "Cache-Control": "no-store", ...headers },
  });
}

export { handle as GET, handle as POST, handle as PUT, handle as PATCH, handle as DELETE };
