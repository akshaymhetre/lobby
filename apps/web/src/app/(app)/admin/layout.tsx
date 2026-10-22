import { headers } from "next/headers";
import { forbidden } from "next/navigation";
import { AdminNav } from "@/components/admin/admin-nav";
import { requireUser } from "@/server/auth";

/**
 * Admins see everything. People who may manage onboarding journeys (the People team) get through
 * to /admin/journeys only, with a nav showing just that item. Every admin page and action
 * re-checks its own permission, so this layout is a first gate, not the only one.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireUser();
  let journeysOnly = false;
  if (!ctx.has("admin")) {
    const path = ((await headers()).get("x-lobby-path") ?? "").split("?")[0]!;
    const underJourneys = path === "/admin/journeys" || path.startsWith("/admin/journeys/");
    let allowed = false;
    if (underJourneys) {
      try {
        const { canManageJourneys } = await import("@lobby/core/journeys");
        allowed = await canManageJourneys(ctx);
      } catch {
        allowed = false;
      }
    }
    if (!allowed) forbidden();
    journeysOnly = true;
  }
  // Stale pages are the one admin number worth seeing from anywhere in the console.
  let badges: Record<string, { count: number; label: string }> | undefined;
  if (ctx.has("admin")) {
    const { contentHealth } = await import("@lobby/core/knowledge");
    const stale = (await contentHealth(ctx)).filter((r) => r.freshness === "stale").length;
    if (stale) badges = { "/admin/knowledge": { count: stale, label: stale === 1 ? "stale page" : "stale pages" } };
  }
  // A journey manager reaches one page, so a column holding a single link is chrome with nothing
  // to choose: they get the page alone, full width.
  if (journeysOnly) return <div className="min-w-0">{children}</div>;
  return (
    // Admin is a mode of the same slab: a second row of pill tabs under the top bar, aligned with
    // the page content, then the page. No sidebar. Not sticky: a sticky strip covered form fields
    // on phones once the page scrolled.
    <div className="min-w-0">
      <div className="mx-auto w-full max-w-(--container-page-wide) px-4 pt-2 sm:px-6 md:pt-3 lg:px-8">
        <AdminNav badges={badges} />
      </div>
      {children}
    </div>
  );
}
