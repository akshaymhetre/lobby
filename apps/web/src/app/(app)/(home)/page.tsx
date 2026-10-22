import { db, inArray, s } from "@lobby/db";
import { getOrgSettings } from "@lobby/core";
import {
  canAuthorPosts, daysUntil, getToday, greetingFor, hourIn, listAnnouncementsFor, listDrafts, listFeed, listHomeCards,
  listNewJoiners, nextPayday, startPhrase, type TodayData,
} from "@lobby/core/home";
import { Page } from "@/components/page";
import { Masthead, MastheadLink } from "@/components/ui/masthead";
import { Reveal, RevealItem } from "@/components/ui/motion";
import { SectionSwitcher } from "@/components/ui/section-switcher";
import { loadPinnedApps } from "@/components/apps/load";
import { Announcements } from "@/components/home/announcements";
import { AssistantCard } from "@/components/home/assistant-card";
import { NewsFeed } from "@/components/home/feed";
import { HomeApps } from "@/components/home/home-apps";
import { HomeCards } from "@/components/home/home-cards";
import type { JoinerItem } from "@/components/home/new-joiners";
import { OnboardingCard } from "@/components/home/onboarding-card";
import { Planner, PlannerError } from "@/components/home/planner";
import { formatDate } from "@/lib/time";
import { requireUser } from "@/server/auth";
import { getOnboardingCard, getPlanner } from "@/server/planner";

export const metadata = { title: "Home" };

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/**
 * The "Today" line under the greeting: one sentence of facts. The parts that are for the reader
 * are accent links (the only place accent links appear with plain text); company facts stay plain.
 */
function TodayLine({
  today,
  joiners,
  payday,
  company,
}: {
  today: TodayData;
  joiners: JoinerItem[];
  payday: Date | null;
  company: string;
}) {
  const mine: { text: string; href: string }[] = [];
  if (today.taskCount) mine.push({ text: plural(today.taskCount, "thing to do", "things to do"), href: "/journeys" });
  if (today.approvalCount) mine.push({ text: `${plural(today.approvalCount, "approval", "approvals")} waiting`, href: "/approvals" });
  if (today.ticketCount) mine.push({ text: plural(today.ticketCount, "open request", "open requests"), href: "/help" });

  const facts: string[] = [];
  const soon = joiners.filter((j) => j.upcoming && j.daysUntil <= 7);
  const started = joiners.filter((j) => !j.upcoming && j.daysUntil >= -7);
  if (soon.length === 1) facts.push(`${soon[0]!.firstName} ${soon[0]!.phrase.toLowerCase()}`);
  else if (soon.length > 1) facts.push(`${soon.length} people start this week`);
  else if (started.length === 1) facts.push(`${started[0]!.firstName} ${started[0]!.phrase.toLowerCase()}`);
  else if (started.length > 1) facts.push(`${started.length} people started this week`);
  if (payday) {
    const days = daysUntil(payday.toISOString().slice(0, 10));
    facts.push(days === 0 ? "today is payday" : `payday is ${formatDate(payday, { weekday: "short", day: "numeric", month: "short" })}`);
  }
  const factSentence = facts.length
    ? facts.map((f, i) => (i === 0 ? f[0]!.toUpperCase() + f.slice(1) : f)).join(facts.length === 2 ? ", and " : ", ") + "."
    : null;

  if (!mine.length) {
    return (
      <>
        Nothing needs you right now. {factSentence ?? `Here is what is happening at ${company}.`}
      </>
    );
  }
  return (
    <>
      You have{" "}
      {mine.map((m, i) => (
        <span key={m.href}>
          {i > 0 ? (i === mine.length - 1 ? " and " : ", ") : ""}
          <MastheadLink href={m.href}>{m.text}</MastheadLink>
        </span>
      ))}
      .{factSentence ? ` ${factSentence}` : ""}
    </>
  );
}

export default async function HomePage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const ctx = await requireUser();
  const sp = await searchParams;
  const canAuthor = canAuthorPosts(ctx);
  const view = sp.view === "saved" ? "saved" : sp.view === "drafts" && canAuthor ? "drafts" : "latest";
  const org = await getOrgSettings();
  const [today, announcements, posts, apps, joinerRows, cards, drafts, planner, onboarding] = await Promise.all([
    getToday(ctx),
    listAnnouncementsFor(ctx),
    listFeed(ctx, { limit: 8, savedOnly: view === "saved" }),
    loadPinnedApps(ctx),
    listNewJoiners(ctx),
    listHomeCards(ctx),
    listDrafts(ctx),
    getPlanner(ctx, org).catch((err: unknown) => {
      console.error("[home] planner failed", err);
      return null;
    }),
    getOnboardingCard(ctx).catch((err: unknown) => {
      console.error("[home] onboarding card failed", err);
      return [] as Awaited<ReturnType<typeof getOnboardingCard>>;
    }),
  ]);

  const authorIds = [...new Set(announcements.map((a) => a.authorId).filter((x): x is string => !!x))];
  const authors = authorIds.length
    ? await db.select({ id: s.users.id, name: s.users.displayName }).from(s.users).where(inArray(s.users.id, authorIds))
    : [];
  const authorName = new Map(authors.map((a) => [a.id, a.name]));

  const tz = ctx.user.timezone || org.timezone;
  const now = new Date();
  const firstName = ctx.user.firstName || ctx.user.displayName.split(" ")[0]!;
  const joiners: JoinerItem[] = joinerRows.map((j) => ({
    id: j.id,
    name: j.name,
    firstName: j.firstName,
    title: j.title,
    location: j.location,
    avatarUrl: j.avatarUrl,
    phrase: startPhrase(j.startDate),
    daysUntil: daysUntil(j.startDate),
    upcoming: daysUntil(j.startDate) > 0,
    greeted: j.greeted,
  }));
  const payday = cards.some((c) => c.type === "kpi" && (c.config as { compute?: string }).compute === "next-payday")
    ? nextPayday(now, org.workingDays)
    : null;
  const announcementItems = announcements.map((a) => ({
    id: a.id,
    title: a.title,
    body: a.body,
    severity: a.severity,
    mustAcknowledge: a.mustAcknowledge,
    authorName: a.authorId ? (authorName.get(a.authorId) ?? null) : null,
    endsAt: a.endsAt?.toISOString() ?? null,
  }));

  return (
    <Page width="wide">
      {/* The first load is one staggered build: greeting, planner, then the cards, finished in about 900ms. */}
      <Reveal stagger={0.06} className="flex flex-col gap-4 md:gap-5">
        <RevealItem from="fade" duration={0.4}>
          <Masthead
            size="display"
            className="pb-1 md:pb-2"
            title={`${greetingFor(hourIn(tz, now))}, ${firstName}`}
            today={<TodayLine today={today} joiners={joiners} payday={payday} company={org.companyName} />}
          />
        </RevealItem>

        {/* Phones: a sticky switcher over Home's sections, so the page reads as five short sections. */}
        <SectionSwitcher
          label="Home sections"
          items={[
            { id: "planner", label: "Coming up" },
            { id: "announcements", label: "Announcements", count: announcementItems.length || undefined },
            { id: "onboarding", label: "Onboarding", count: onboarding.length || undefined },
            { id: "news", label: "News" },
            { id: "home-apps", label: "Apps" },
          ]}
        />

        <RevealItem duration={0.45}>
          {planner ? <Planner data={planner} /> : <PlannerError />}
        </RevealItem>

        <div className="grid items-start gap-4 md:gap-5 lg:grid-cols-3">
          <RevealItem duration={0.45} className="order-last lg:order-none lg:col-start-3">
            <AssistantCard firstName={firstName} />
          </RevealItem>
          <RevealItem duration={0.45} className="lg:col-start-1 lg:row-start-1">
            <Announcements items={announcementItems} />
          </RevealItem>
          <RevealItem duration={0.45} className="lg:col-start-2 lg:row-start-1">
            <OnboardingCard people={onboarding} />
          </RevealItem>
        </div>

        <RevealItem duration={0.45} className="min-w-0">
          <NewsFeed posts={posts} view={view} canAuthor={canAuthor} drafts={drafts} />
        </RevealItem>

        {/* The utility row: your apps beside the company's figures and links. */}
        <div className="grid items-stretch gap-4 md:gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
          <RevealItem duration={0.45} className="min-w-0">
            <HomeApps apps={apps} className="h-full" />
          </RevealItem>
          {cards.length ? (
            <RevealItem duration={0.45} className="min-w-0">
              <section aria-label="At a glance" className="h-full rounded-panel panel p-5">
                <HomeCards cards={cards} workingDays={org.workingDays} />
              </section>
            </RevealItem>
          ) : null}
        </div>
      </Reveal>
    </Page>
  );
}
