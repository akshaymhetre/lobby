import Link from "next/link";
import { notFound } from "next/navigation";
import { Building2, Hand, Mail, MapPin, Network, Phone } from "lucide-react";
import { getOrgSettings } from "@lobby/core";
import { getPersonProfile, listPeopleOptions, type PersonSummary } from "@lobby/core/people";
import { daysUntil, formatWorkingHours, isNewJoiner, isUpcomingStarter, isWorkingNow, startLabel } from "@lobby/core/people/format";
import { Page } from "@/components/page";
import { Breadcrumb } from "@/components/ui/page-header";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { SpotlightLayer } from "@/components/ui/effects/spotlight";
import { CountUp, Reveal, RevealItem } from "@/components/ui/motion";
import { Section } from "@/components/ui/section";
import { traitsFor } from "@/components/ui/avatar-art";
import { DayBand } from "@/components/people/day-track";
import { EditProfileSheet } from "@/components/people/edit-profile-sheet";
import { personCellClass } from "@/components/people/person-card";
import { ReportingLine } from "@/components/people/reporting-line";
import { SayHiButton } from "@/components/people/say-hi-button";
import { requireUser } from "@/server/auth";
import { timeAgo } from "@/lib/time";
import { cn } from "@/lib/cn";
import styles from "./profile.module.css";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireUser();
  const profile = await getPersonProfile(ctx, (await params).id);
  return { title: profile ? profile.person.displayName : "Person not found" };
}

/** Whole months between a start date and today (negative for a future start). */
function monthsSince(iso: string, today = new Date()): number {
  const [y, m, d] = iso.split("-").map(Number) as [number, number, number];
  let months = (today.getFullYear() - y) * 12 + (today.getMonth() + 1 - m);
  if (today.getDate() < d) months -= 1;
  return months;
}

export default async function PersonPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireUser();
  const { id } = await params;
  const profile = await getPersonProfile(ctx, id);
  if (!profile) notFound();
  const { person: p, manager, reports, peers, groups, greetings, isSelf, canEdit, canAdminEdit } = profile;
  const [managers, org] = await Promise.all([canAdminEdit ? listPeopleOptions() : Promise.resolve([]), getOrgSettings()]);
  const viewerTimezone = ctx.user.timezone || org.timezone || null;
  // The person's own colour (their avatar disc) tints the hero's ambient light.
  const aura = p.avatarUrl ? null : traitsFor(p.id).disc[1];
  const workingNow = isWorkingNow(p.timezone, p.workingHours) === true;
  const first = p.firstName || p.displayName.split(/\s+/)[0] || p.displayName;
  const joinedLabel = startLabel(p.startDate);
  const hours = formatWorkingHours(p.workingHours);
  const showSayHi = !isSelf && p.status === "active" && (isNewJoiner(p.startDate) || isUpcomingStarter(p.startDate));

  const status =
    p.status !== "active" ? (
      <Badge tone="danger" dot>
        Deactivated
      </Badge>
    ) : isUpcomingStarter(p.startDate) ? (
      <Badge tone="info" dot>
        Starting soon
      </Badge>
    ) : isNewJoiner(p.startDate) ? (
      <Badge tone="green" dot>
        New
      </Badge>
    ) : null;

  const actions = (
    <>
      {showSayHi ? <SayHiButton personId={p.id} firstName={first} greeted={profile.greetedByMe} variant="primary" /> : null}
      {canEdit ? (
        <EditProfileSheet
          isSelf={isSelf}
          admin={canAdminEdit}
          managers={managers.map((m) => ({ value: m.id, label: m.displayName, hint: m.title ?? undefined }))}
          profile={{
            id: p.id,
            displayName: p.displayName,
            pronouns: p.pronouns,
            bio: p.bio,
            skills: p.skills,
            timezone: p.timezone,
            workingHours: p.workingHours,
            phone: p.phone,
            avatarUrl: p.avatarUrl,
            title: p.title,
            department: p.department,
            location: p.location,
            managerId: p.managerId,
            startDate: p.startDate,
            endDate: p.endDate,
          }}
        />
      ) : null}
      {p.status === "active" ? (
        <Button asChild variant="secondary" size="sm">
          <Link href={`/org-chart?focus=${p.id}`}>
            <Network aria-hidden />
            View in org chart
          </Link>
        </Button>
      ) : null}
    </>
  );

  // The stat strip under the hero: four facts, the numbers count up on first load.
  const tenure = p.startDate ? monthsSince(p.startDate) : null;
  const days = p.startDate ? daysUntil(p.startDate) : null;
  const started: { value: React.ReactNode; hint: React.ReactNode } = !p.startDate
    ? { value: <span className="text-subtle">Not recorded</span>, hint: "Start date" }
    : days !== null && days > 0
      ? { value: <CountUp value={days} suffix={days === 1 ? " day" : " days"} duration={0.8} delay={0.3} />, hint: joinedLabel }
      : tenure !== null && tenure >= 12
        ? { value: <CountUp value={Math.floor(tenure / 12)} suffix={Math.floor(tenure / 12) === 1 ? " year" : " years"} duration={0.8} delay={0.3} />, hint: joinedLabel }
        : tenure !== null && tenure >= 1
          ? { value: <CountUp value={tenure} suffix={tenure === 1 ? " month" : " months"} duration={0.8} delay={0.3} />, hint: joinedLabel }
          : { value: days === 0 ? "Today" : `${-(days ?? 0)} days`, hint: joinedLabel };

  const peersTitle = manager ? `Also reports to ${manager.displayName.split(/\s+/)[0]}` : "Peers";

  return (
    <Page width="wide">
      <div className="mb-4 text-small text-muted">
        <Breadcrumb items={[{ label: "People", href: "/people" }, { label: p.displayName }]} />
      </div>

      <Reveal stagger={0.07} className="section-stack">
        {/* The lead: one hero panel with the face, the name as the page's only title, and the stat strip. */}
        <RevealItem from="up" duration={0.5}>
          <header className="panel relative isolate flex flex-col gap-6 overflow-hidden rounded-panel p-5 sm:p-6 md:gap-7 md:p-8" data-masthead style={aura ? { ["--aura" as string]: aura } : undefined}>
            {aura ? (
              <span aria-hidden className={styles.aura} />
            ) : null}
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:gap-6">
              <span className="relative inline-flex shrink-0 self-start sm:self-center">
                <Avatar
                  name={p.displayName}
                  seed={p.id}
                  src={p.avatarUrl}
                  size="xl"
                  className={cn("size-20 rounded-full sm:size-28", styles.face)}
                  aria-hidden
                />
                {workingNow ? (
                  <span className="absolute bottom-1 right-1 block size-5 rounded-full bg-cat-green ring-4 ring-surface sm:bottom-2 sm:right-2" role="img" aria-label="Working now" />
                ) : null}
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                  <h1 className="text-h2 font-medium tracking-[-0.025em] text-fg text-balance md:text-[44px] md:leading-[1.1]">{p.displayName}</h1>
                  {p.pronouns ? <span className="text-body text-muted">{p.pronouns}</span> : null}
                  {status}
                </div>
                <p className="text-body-lg text-fg">{p.title ?? <span className="text-muted">No title yet</span>}</p>
                {p.department || p.location ? (
                  <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-body text-muted" aria-label="Team and location">
                    {p.department ? (
                      <li className="inline-flex items-center gap-1.5">
                        <Building2 className="size-4 stroke-[1.5] text-subtle" aria-hidden />
                        <Link href={`/people?department=${encodeURIComponent(p.department)}`} className="focus-ring rounded-[3px] hover:text-fg hover:underline">
                          {p.department}
                        </Link>
                      </li>
                    ) : null}
                    {p.location ? (
                      <li className="inline-flex items-center gap-1.5">
                        <MapPin className="size-4 stroke-[1.5] text-subtle" aria-hidden />
                        <Link href={`/people?location=${encodeURIComponent(p.location)}`} className="focus-ring rounded-[3px] hover:text-fg hover:underline">
                          {p.location}
                        </Link>
                      </li>
                    ) : null}
                  </ul>
                ) : null}
              </div>
              <div className="flex flex-wrap items-center gap-2 sm:shrink-0 sm:self-start sm:justify-end">{actions}</div>
            </div>

            {/* The hero visual: this person's day on the reader's clock, then three facts. */}
            <Reveal stagger={0.06} delay={0.25} className="grid grid-cols-1 gap-2 sm:gap-3 lg:grid-cols-[minmax(0,1fr)_300px]">
              <RevealItem from="up" duration={0.45} className="cell flex min-w-0 flex-col justify-center rounded-card px-4 pb-4 pt-5 sm:px-5">
                <DayBand
                  timezone={p.timezone}
                  workingHours={p.workingHours}
                  viewerTimezone={viewerTimezone}
                  name={isSelf ? null : first}
                  avatar={{ id: p.id, name: p.displayName, src: p.avatarUrl }}
                />
              </RevealItem>
              <RevealItem from="up" duration={0.45} className="cell min-w-0 rounded-card px-4 py-1">
                <dl className="divide-y divide-border">
                  <HeroFact label={days !== null && days > 0 ? "Starts in" : "Here for"} hint={started.hint}>
                    {started.value}
                  </HeroFact>
                  <HeroFact label="Reports to" hint={manager?.title ?? undefined}>
                    {manager ? (
                      <Link href={`/people/${manager.id}`} className="focus-ring truncate rounded-[3px] hover:underline">
                        {manager.displayName}
                      </Link>
                    ) : (
                      <span className="text-subtle">{p.status === "active" ? "Top of the chart" : "Nobody"}</span>
                    )}
                  </HeroFact>
                  {reports.length ? (
                    <HeroFact label="Direct reports">
                      <CountUp value={reports.length} duration={0.8} delay={0.36} />
                    </HeroFact>
                  ) : null}
                  <HeroFact label="Skills" hint={p.skills.length ? `${p.skills.slice(0, 2).join(", ")}${p.skills.length > 2 ? ` +${p.skills.length - 2}` : ""}` : isSelf ? "Add a few below" : "None listed yet"}>
                    <CountUp value={p.skills.length} duration={0.8} delay={0.42} />
                  </HeroFact>
                </dl>
              </RevealItem>
            </Reveal>
          </header>
        </RevealItem>

        <RevealItem from="fade" duration={0.4}>
          <div className="grid grid-cols-1 gap-x-12 gap-y-10 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="section-stack min-w-0">
              <Section title="About">
                <div className="section-content">
                  {p.bio ? (
                    <p className="max-w-[68ch] whitespace-pre-line text-body-lg text-fg text-pretty">{p.bio}</p>
                  ) : (
                    <p className="text-body text-muted">
                      {isSelf ? "Add a short bio so people know what you work on and what to ask you about." : `${first} has not written a bio yet.`}
                    </p>
                  )}
                  {p.skills.length ? (
                    <ul className="flex flex-wrap gap-2" aria-label="Skills">
                      {p.skills.map((s) => (
                        <li key={s}>
                          <Link
                            href={`/people?q=${encodeURIComponent(s)}`}
                            className="focus-ring cell press inline-flex h-8 items-center rounded-full px-3 text-small font-medium text-fg hover:shadow-cell-hover"
                          >
                            {s}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  ) : isSelf ? (
                    <p className="text-body text-subtle">No skills listed yet. Add a few so people can find you by what you know.</p>
                  ) : null}
                </div>
              </Section>

              {manager || reports.length ? (
                <Section title="Reporting line">
                  <ReportingLine
                    isSelf={isSelf}
                    manager={manager ? { id: manager.id, displayName: manager.displayName, title: manager.title, avatarUrl: manager.avatarUrl } : null}
                    person={{ id: p.id, displayName: p.displayName, title: p.title, avatarUrl: p.avatarUrl }}
                    reports={reports.map((r) => ({ id: r.id, displayName: r.displayName, title: r.title, avatarUrl: r.avatarUrl }))}
                  />
                </Section>
              ) : p.status === "active" ? (
                <Section title="Reporting line">
                  <p className="text-body text-muted">No manager and no reports yet.</p>
                </Section>
              ) : null}
              {isSelf ? (
                <Section title="Greetings" id="greetings" count={greetings.length} className="scroll-mt-20">
                  {greetings.length ? (
                    <ul className="flex flex-col gap-2">
                      {greetings.map((g) => (
                        <li key={g.id} className="cell flex gap-3 rounded-card p-3 pr-4">
                          <Avatar name={g.from.displayName} seed={g.from.id} src={g.from.avatarUrl} size="md" className="mt-0.5" aria-hidden />
                          <div className="flex min-w-0 flex-col gap-0.5">
                            <p className="text-body">
                              <Link href={`/people/${g.from.id}`} className="focus-ring rounded-[3px] font-medium text-fg hover:underline">
                                {g.from.displayName}
                              </Link>{" "}
                              <span className="text-subtle">· {timeAgo(g.createdAt)}</span>
                            </p>
                            <p className="text-body text-fg">{g.message}</p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <EmptyState
                      compact
                      icon={<Hand />}
                      title="No greetings yet"
                      description="When colleagues say hi from the People page, their messages land here."
                    />
                  )}
                </Section>
              ) : null}

              {groups.length ? (
                <Section title="Groups" count={groups.length}>
                  <ul className="flex flex-wrap gap-2">
                    {groups.map((g) => (
                      <li key={g.id}>
                        <Badge tone="neutral">{g.displayName}</Badge>
                      </li>
                    ))}
                  </ul>
                </Section>
              ) : null}
            </div>

            <aside className="flex min-w-0 flex-col gap-8 lg:order-none" aria-label="Contact and reporting line">
              <Section tone="quiet" as="h2" title="Contact">
                <dl className="divide-y divide-border">
                  <Fact label="Email">
                    <a href={`mailto:${p.email}`} className="focus-ring inline-flex max-w-full min-w-0 items-center gap-1.5 rounded-[3px] text-accent-text hover:underline">
                      <Mail className="size-3.5 shrink-0 stroke-[1.5]" aria-hidden />
                      <span className="truncate">{p.email}</span>
                    </a>
                  </Fact>
                  <Fact label="Phone">
                    {p.phone ? (
                      <a href={`tel:${p.phone.replace(/[^\d+]/g, "")}`} className="focus-ring tabular inline-flex items-center gap-1.5 rounded-[3px] text-accent-text hover:underline">
                        <Phone className="size-3.5 shrink-0 stroke-[1.5]" aria-hidden />
                        {p.phone}
                      </a>
                    ) : (
                      <span className="text-subtle">Not shared</span>
                    )}
                  </Fact>
                  <Fact label="Hours">
                    {p.timezone ? (
                      <span className="flex flex-col">
                        <span className="text-fg">{hours ? `Works ${hours}` : "Not set"}</span>
                        <span className="text-small text-muted">{p.timezone.replace(/_/g, " ")}</span>
                      </span>
                    ) : (
                      <span className="text-subtle">Time zone not set</span>
                    )}
                  </Fact>
                </dl>
              </Section>

              {peers.length ? (
                <Section tone="quiet" as="h2" title={peersTitle} count={peers.length}>
                  <PersonLinkList people={peers} max={8} moreHref={manager ? `/people/${manager.id}` : undefined} />
                </Section>
              ) : null}
            </aside>
          </div>
        </RevealItem>
      </Reveal>
    </Page>
  );
}

/** One row of the hero's fact sheet: a quiet label on the left, the value and its hint on the right. */
function HeroFact({ label, hint, children }: { label: string; hint?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 items-baseline justify-between gap-3 py-2.5">
      <dt className="shrink-0 text-small text-muted">{label}</dt>
      <dd className="flex min-w-0 flex-col items-end text-right leading-tight">
        <span className="tabular max-w-full truncate text-body-lg font-medium text-fg">{children}</span>
        {hint ? <span className="max-w-full truncate text-caption text-subtle">{hint}</span> : null}
      </dd>
    </div>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5 py-2.5 first:pt-0">
      <dt className="text-caption font-medium text-subtle">{label}</dt>
      <dd className="min-w-0 text-body">{children}</dd>
    </div>
  );
}

/** The reporting line as person cells, the same object as the directory rows. */
function PersonLinkList({ people, max = 50, moreHref }: { people: PersonSummary[]; max?: number; moreHref?: string }) {
  const shown = people.slice(0, max);
  return (
    <ul className="flex flex-col gap-2">
      {shown.map((r) => (
        <li key={r.id} className={cn(personCellClass, "flex min-h-14 items-center gap-3 pl-2.5 pr-3 py-2")}>
          <SpotlightLayer />
          <Avatar name={r.displayName} seed={r.id} src={r.avatarUrl} size="lg" aria-hidden />
          <span className="flex min-w-0 flex-col leading-tight">
            <Link href={`/people/${r.id}`} className="-my-1 truncate py-1 text-body font-medium text-fg outline-none after:absolute after:inset-0 after:rounded-cell">
              {r.displayName}
            </Link>
            <span className="truncate text-small text-muted">{r.title ?? "No title yet"}</span>
          </span>
        </li>
      ))}
      {people.length > shown.length ? (
        <li className="px-1 pt-1 text-small text-muted">
          {moreHref ? (
            <Link href={moreHref} className="focus-ring rounded-[3px] hover:text-fg hover:underline">
              and {people.length - shown.length} more
            </Link>
          ) : (
            <>and {people.length - shown.length} more</>
          )}
        </li>
      ) : null}
    </ul>
  );
}
