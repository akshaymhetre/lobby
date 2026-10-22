import Link from "next/link";
import { ArrowRight, LifeBuoy, PenLine, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HeroLight } from "@/components/ui/hero-light";

const ROLES = [
  { key: "admin", label: "Administrator", icon: ShieldCheck, empty: "Only the break-glass account" },
  { key: "agent", label: "Helpdesk agent", icon: LifeBuoy, empty: "Nobody works the queue yet" },
  { key: "content-editor", label: "Content editor", icon: PenLine, empty: "Only administrators edit pages" },
] as const;

/**
 * The groups page's hero: who holds rights. A verdict at hero size ("4 of 11 groups grant a role"),
 * and one lane per role showing the groups that grant it and how many people sit in them. The rest
 * of the page is every group; this answers the question an admin opens it with.
 */
export function GroupsHero({ groups }: { groups: { name: string; displayName: string; members: number; roles: string[] }[] }) {
  const granting = groups.filter((g) => g.roles.length).length;
  return (
    <section aria-labelledby="groups-verdict" className="relative isolate overflow-hidden rounded-panel panel dark:glass">
      <HeroLight tone="blue" position="top-left" />
      <div className="grid gap-8 p-6 sm:p-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,560px)] lg:items-center lg:gap-12">
        <div className="flex min-w-0 flex-col gap-3">
          <h2 id="groups-verdict" className="text-balance text-h2 font-medium text-fg md:text-hero">
            {granting} of {groups.length} groups grant a role
          </h2>
          <p className="max-w-md text-row text-muted text-pretty">Everyone else gets the employee view. A role follows the group, so leavers lose it the moment your identity provider removes them.</p>
          <Button asChild variant="secondary" className="mt-1 self-start">
            <Link href="/admin/identity#roles">
              Change role mappings
              <ArrowRight aria-hidden />
            </Link>
          </Button>
        </div>
        <ul className="flex flex-col gap-2.5">
          {ROLES.map((r) => {
            const holders = groups.filter((g) => g.roles.includes(r.key));
            const people = holders.reduce((n, g) => n + g.members, 0);
            const Icon = r.icon;
            return (
              <li key={r.key} className="cell flex min-h-16 items-center gap-3.5 rounded-card px-4 py-3">
                <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-full bg-accent-soft text-accent-text">
                  <Icon className="size-[18px] stroke-[1.75]" />
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="text-row font-medium text-fg">{r.label}</span>
                  <span className="flex min-w-0 flex-wrap gap-1.5 text-caption text-muted">
                    {holders.length
                      ? holders.map((g) => (
                          <span key={g.name} className="inline-flex h-6 items-center rounded-full bg-sunken px-2.5 font-mono text-fg shadow-inset">
                            {g.name}
                          </span>
                        ))
                      : r.empty}
                  </span>
                </span>
                <span className="flex shrink-0 flex-col items-end">
                  <span className="tabular text-h3 font-medium leading-none text-fg">{people}</span>
                  <span className="text-caption text-muted">{people === 1 ? "member" : "members"}</span>
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
