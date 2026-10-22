import Link from "next/link";
import { headers } from "next/headers";
import { Lock } from "lucide-react";
import { and, asc, db, eq, inArray, s } from "@lobby/db";
import { Avatar } from "@/components/ui/avatar";
import { Page } from "@/components/page";
import { buttonVariants } from "@/components/ui/button-variants";
import { HeroLight } from "@/components/ui/hero-light";
import { Reveal, RevealItem } from "@/components/ui/motion";
import { NAV_SECTIONS } from "@/lib/nav";

export const metadata = { title: "No access" };

/**
 * The group that would have let the reader in, when the route is one the navigation model gates by
 * role (the help queue needs "agent", admin needs "admin") and an IdP group is mapped to that role.
 * Null when it cannot be known, in which case the page says so plainly instead of guessing.
 */
async function grantingGroups(
  path: string,
): Promise<{ area: string; groups: string[]; names: string[] } | null> {
  const item = NAV_SECTIONS.flatMap((sec) => sec.items).find(
    (i) => i.role && (path === i.href || path.startsWith(`${i.href}/`)),
  );
  if (!item?.role) return null;
  const mappings = await db
    .select({ groupName: s.roleMappings.groupName })
    .from(s.roleMappings)
    .where(inArray(s.roleMappings.role, [item.role]));
  const names = mappings.map((m) => m.groupName);
  if (!names.length)
    return {
      area: item.label === "Admin" ? "Admin" : `the ${item.label.toLowerCase()}`,
      groups: [],
      names: [],
    };
  const rows = await db
    .select({ displayName: s.groups.displayName })
    .from(s.groups)
    .where(inArray(s.groups.name, names));
  const area = item.label === "Admin" ? "Admin" : `the ${item.label.toLowerCase()}`;
  return { area, groups: rows.map((g) => g.displayName).sort(), names };
}

/** 403 inside the shell: the navigation stays, so the reader can carry on, and the page names the way in. */
export default async function Forbidden() {
  const path = ((await headers()).get("x-lobby-path") ?? "").split("?")[0] ?? "";
  const grant = await grantingGroups(path);
  const area = grant?.area ?? "this page";
  const groups = grant?.groups ?? [];
  // The locked place, by name, or a plain "This page".
  const lockedLabel = grant
    ? grant.area.replace(/^the /, "").replace(/^./, (c) => c.toUpperCase())
    : "This page";
  // A few active people already in the granting group: the people who can vouch for the reader.
  const holders = grant?.names.length
    ? await db
        .selectDistinct({ id: s.users.id, name: s.users.displayName, title: s.users.title, avatarUrl: s.users.avatarUrl })
        .from(s.groupMembers)
        .innerJoin(s.groups, eq(s.groups.id, s.groupMembers.groupId))
        .innerJoin(s.users, eq(s.users.id, s.groupMembers.userId))
        .where(and(inArray(s.groups.name, grant.names), eq(s.users.status, "active")))
        .orderBy(asc(s.users.displayName))
        .limit(4)
    : [];

  return (
    <Page width="wide">
      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 pt-2 md:pt-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:items-stretch">
        {/* The page's one authored moment: the message builds in, code to actions, on arrival. The
            panel is lit amber: a door that is closed for now, not an error. */}
        <section aria-labelledby="forbidden-title" className="panel relative isolate flex flex-col justify-end overflow-hidden rounded-panel p-6 sm:p-10 lg:min-h-[520px]">
        <HeroLight tone="amber" position="top-right" intensity="strong" />
        <Reveal stagger={0.07}>
          <RevealItem from="fade">
            <p aria-hidden className="bg-gradient-to-b from-cat-amber-text to-cat-amber-text/40 bg-clip-text text-[112px] font-medium leading-[100px] tracking-[-0.06em] text-transparent tabular sm:text-[168px] sm:leading-[148px]">
              403
            </p>
          </RevealItem>
          <RevealItem>
            <h1 id="forbidden-title" className="mt-3 text-title-sm font-medium text-fg text-balance md:text-title">
              <span className="sr-only">Error 403. </span>
              You do not have access to {area}
            </h1>
          </RevealItem>
          <RevealItem>
            <p className="mt-3 text-body-lg text-muted text-pretty">
              {groups.length === 1 ? (
                <>
                  Access comes with the <span className="font-medium text-fg">{groups[0]}</span>{" "}
                  group. If you think you should be in it, ask your IT team to add you.
                </>
              ) : groups.length > 1 ? (
                <>
                  Access comes with any of these groups:{" "}
                  <span className="font-medium text-fg">{groups.join(", ")}</span>. If you think you
                  should be in one of them, ask your IT team to add you.
                </>
              ) : (
                <>
                  Access is granted by group membership. If you think you should have it, ask your
                  IT team to add you to the right group.
                </>
              )}
            </p>
          </RevealItem>
          <RevealItem>
            <div className="mt-8 flex flex-wrap items-center gap-2">
              <Link href="/help/new" className={buttonVariants()}>
                Ask IT through Help
              </Link>
              <Link href="/" className={buttonVariants({ variant: "ghost" })}>
                Back to home
              </Link>
            </div>
          </RevealItem>
        </Reveal>
        </section>
        <LockedPanel area={lockedLabel} groups={groups} holders={holders} />
      </div>
    </Page>
  );
}

/**
 * The way in, drawn: the locked area as a large lock on the ambient panel, the group that opens
 * it, and a few people already in that group (generated faces, names and titles) so the reader
 * knows whose door to knock on. Every name here comes from the directory.
 */
function LockedPanel({
  area,
  groups,
  holders,
}: {
  area: string;
  groups: string[];
  holders: { id: string; name: string; title: string | null; avatarUrl: string | null }[];
}) {
  return (
    <section aria-label={`How to get into ${area}`} className="relative isolate flex flex-col justify-center overflow-hidden rounded-panel panel p-6 sm:p-8">
      <div className="flex items-center gap-4">
        <span className="relative grid size-16 shrink-0 place-items-center rounded-full bg-raised shadow-cell">
          <span aria-hidden className="absolute -inset-2 rounded-full border border-dashed border-border-strong" />
          <Lock aria-hidden className="size-6 stroke-[1.75] text-fg" />
        </span>
        <div className="min-w-0">
          <p className="text-h3 font-medium text-fg">{area} is locked</p>
          <p className="text-small text-muted">
            {groups.length ? `It opens for ${groups.length === 1 ? "the" : "these"} ${groups.length === 1 ? "group" : "groups"} below.` : "It opens by group membership."}
          </p>
        </div>
      </div>
      {groups.length ? (
        <ul className="mt-6 flex flex-wrap gap-2">
          {groups.map((g) => (
            <li key={g} className="inline-flex h-9 items-center gap-2 rounded-full bg-raised px-3.5 text-small font-medium text-fg shadow-cell">
              <span aria-hidden className="size-2 rounded-full bg-now" />
              {g}
            </li>
          ))}
        </ul>
      ) : null}
      {holders.length ? (
        <div className="mt-6">
          <p className="text-small text-muted">Already in it, and able to vouch for you</p>
          <ul className="mt-3 flex flex-col gap-2">
            {holders.map((p) => (
              <li key={p.id} className="cell flex min-h-14 items-center gap-3 rounded-cell px-3 py-2">
                <Avatar name={p.name} src={p.avatarUrl} seed={p.id} size="lg" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-row font-medium text-fg">{p.name}</span>
                  {p.title ? <span className="block truncate text-small text-muted">{p.title}</span> : null}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
