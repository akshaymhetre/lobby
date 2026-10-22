import Link from "next/link";
import { Network } from "lucide-react";
import { listOrgChart } from "@lobby/core/people";
import { Breadcrumb, PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { OrgChart } from "@/components/people/org-chart";
import { requireUser } from "@/server/auth";

export const metadata = { title: "Org chart" };

/** Full-height tool page: the header is compact so the canvas gets the room, and `OrgChart` owns its toolbar. */
export default async function OrgChartPage({ searchParams }: { searchParams: Promise<{ focus?: string | string[] }> }) {
  const ctx = await requireUser();
  const sp = await searchParams;
  const focus = (Array.isArray(sp.focus) ? sp.focus[0] : sp.focus) ?? null;
  const people = await listOrgChart(ctx);

  // Top bar is 64px; on a phone the 96px dock sits under main, so the canvas stops above it.
  return (
    <div className="flex h-[calc(100dvh-160px)] flex-col md:h-[calc(100dvh-64px)]">
      <div className="px-4 pt-3 sm:px-6 md:pt-4 lg:px-8">
        <PageHeader
          className="pb-4 md:pb-4"
          breadcrumb={<Breadcrumb items={[{ label: "People", href: "/people" }, { label: "Org chart" }]} />}
          title="Org chart"
          description={
            people.length ? (
              <>
                <span className="hidden sm:inline">Drag to move around, pinch or Ctrl and scroll to zoom. </span>
                {people.length} people, from the top down.
              </>
            ) : undefined
          }
        />
      </div>
      {people.length ? (
        <OrgChart people={people} focusId={focus} viewerId={ctx.user.id} />
      ) : (
        <div className="px-4 sm:px-6 lg:px-8">
          <EmptyState
            icon={<Network />}
            title="No reporting lines yet"
            description="The chart draws itself from each person's manager. Add managers by import, SCIM or on someone's profile."
            action={
              <Button asChild size="sm" variant="secondary">
                <Link href="/people">Go to People</Link>
              </Button>
            }
          />
        </div>
      )}
    </div>
  );
}
