import { NextResponse, type NextRequest } from "next/server";
import { launchApp } from "@lobby/core/apps";
import { requireUser } from "@/server/auth";

/**
 * Launches an app: re-checks visibility, records the launch, then redirects to the app's
 * launch URL. For SSO apps that URL bounces through the shared IdP, which already holds a
 * session, so the person lands signed in.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const user = await requireUser();
  const { slug } = await ctx.params;
  const result = await launchApp(user, slug);
  if (!result.ok) {
    const back = new URL("/apps", req.nextUrl.origin);
    back.searchParams.set("unavailable", slug);
    back.searchParams.set("reason", result.reason);
    return NextResponse.redirect(back, 303);
  }
  const res = NextResponse.redirect(result.url, 303);
  res.headers.set("Cache-Control", "no-store");
  res.headers.set("Referrer-Policy", "no-referrer");
  return res;
}
