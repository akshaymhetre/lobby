import Link from "next/link";
import { Settings2 } from "lucide-react";
import { getOrgSettings } from "@lobby/core";
import { appCounts } from "@lobby/core/counts";
import { Page } from "@/components/page";
import { Button } from "@/components/ui/button";
import { MastheadLink } from "@/components/ui/masthead";
import { AppLauncher } from "@/components/apps/launcher";
import { loadLauncher } from "@/components/apps/load";
import { requireUser } from "@/server/auth";

export const metadata = { title: "Apps" };

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export default async function AppsPage({
  searchParams,
}: {
  searchParams: Promise<{ focus?: string; unavailable?: string; reason?: string }>;
}) {
  const ctx = await requireUser();
  const [sp, org, data, counts] = await Promise.all([searchParams, getOrgSettings(), loadLauncher(ctx), appCounts(ctx)]);
  // The canonical count (@lobby/core/counts): apps this reader can see, of every app in the catalogue.
  const { visible, total } = counts;
  const reason = sp.reason === "no_access" || sp.reason === "bad_url" || sp.reason === "not_found" ? sp.reason : "not_found";
  const sso = data.apps.filter((a) => a.launchType !== "bookmark").length;
  const pending = data.requestable.filter((a) => a.pendingTicket).length;
  const askable = data.requestable.length - pending;
  return (
    <Page
      width="wide"
      title="Apps"
      today={
        <>
          {visible} of {total} apps at {org.companyName}, {sso} with single sign-on.{" "}
          {data.pinnedIds.length ? (
            <>
              <MastheadLink href="#your-apps">{plural(data.pinnedIds.length, "pinned", "pinned")}</MastheadLink> to your home page.
            </>
          ) : (
            "Pin the ones you open most and they sit on your home page."
          )}
          {askable ? (
            <>
              {" "}
              <MastheadLink href="#request-access">{askable} more you can ask for</MastheadLink>.
            </>
          ) : null}
          {pending ? ` ${plural(pending, "request", "requests")} waiting on an owner.` : ""}
        </>
      }
      actions={
        ctx.has("admin") ? (
          <Button variant="secondary" size="sm" asChild>
            <Link href="/admin/apps">
              <Settings2 aria-hidden />
              Manage apps
            </Link>
          </Button>
        ) : null
      }
    >
      <AppLauncher
        org={{ name: org.companyName, logoUrl: org.logoUrl }}
        apps={data.apps}
        pinnedIds={data.pinnedIds}
        recentIds={data.recentIds}
        requestable={data.requestable}
        focusSlug={sp.focus ?? null}
        unavailable={sp.unavailable ? { slug: sp.unavailable, reason } : null}
      />
    </Page>
  );
}
