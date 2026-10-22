import { eq, inArray } from "drizzle-orm";
import { db } from "../client";
import * as s from "../schema/index";
import type { JourneyAssignee, JourneyStepConfig, JourneyStepType } from "../schema/journeys";
// Pure helpers shared with the journeys engine, so seeded due dates and owners match what the
// engine would compute. Neither file touches the database or imports anything else.
import { dueDateFor, todayIn } from "../../../core/src/journeys/dates";
import { personalise, resolveAssignee } from "../../../core/src/journeys/rules";
import type { SeedContext } from "./util";

interface SeedStep {
  key: string;
  title: string;
  description?: string;
  type: JourneyStepType;
  dayOffset: number;
  assignee: JourneyAssignee;
  assigneeUser?: string;
  config?: JourneyStepConfig;
}

interface SeedJourney {
  key: string;
  name: string;
  description: string;
  kind: "onboarding" | "offboarding";
  departments?: string[];
  steps: SeedStep[];
}

const JOURNEYS: SeedJourney[] = [
  {
    key: "welcome",
    name: "Welcome to Northwind",
    description: "Everyone's first month: a laptop that works on day 1, the essentials, the people, and a proper check-in at 30 days.",
    kind: "onboarding",
    steps: [
      {
        key: "laptop",
        title: "Laptop, accounts and access",
        description: "IT orders the laptop, creates the Google Workspace and Slack accounts and ships it to arrive before day 1.",
        type: "create_ticket",
        dayOffset: -7,
        assignee: "it",
        config: {
          requestTypeSlug: "onboarding-equipment",
          ticketSubject: "Laptop and accounts for {name}",
          leadDays: 3,
          ticketFields: { laptop: "MacBook Pro 14\"", extras: "Google Workspace, Slack and 1Password accounts ready for day 1." },
        },
      },
      {
        key: "plan-week",
        title: "Plan {firstName}'s first week",
        description: "Block time for intros, a first small piece of work and a walk through how the team plans.",
        type: "task",
        dayOffset: -3,
        assignee: "manager",
      },
      {
        key: "welcome-note",
        title: "Send a welcome note",
        description: "A short personal note before day 1: what to expect, when to arrive, who to ask for.",
        type: "task",
        dayOffset: -2,
        assignee: "manager",
      },
      {
        key: "desk",
        title: "Desk, building pass and welcome pack",
        type: "task",
        dayOffset: -1,
        assignee: "people",
      },
      {
        key: "read-welcome",
        title: "Read the welcome guide",
        description: "How we work, who does what, and the handful of things everyone wishes they had known in week one.",
        type: "read_page",
        dayOffset: 0,
        assignee: "subject",
        config: { spaceSlug: "company", pageSlug: "welcome-to-northwind" },
      },
      {
        key: "ack-conduct",
        title: "Acknowledge the code of conduct",
        type: "acknowledge_page",
        dayOffset: 0,
        assignee: "subject",
        config: { spaceSlug: "people", pageSlug: "code-of-conduct" },
      },
      {
        key: "ack-security",
        title: "Acknowledge the security policy",
        type: "acknowledge_page",
        dayOffset: 0,
        assignee: "subject",
        config: { spaceSlug: "it", pageSlug: "security-policy" },
      },
      {
        key: "1password",
        title: "Set up 1Password",
        description: "Your vault for every work password. IT has already invited you.",
        type: "launch_app",
        dayOffset: 0,
        assignee: "subject",
        config: { appSlug: "1password" },
      },
      {
        key: "slack",
        title: "Join Slack and say hello in #general",
        type: "launch_app",
        dayOffset: 0,
        assignee: "subject",
        config: { appSlug: "slack" },
      },
      { key: "meet-manager", title: "Meet your manager", type: "meet_person", dayOffset: 0, assignee: "subject", config: { personRole: "manager" } },
      {
        key: "buddy-coffee",
        title: "Take {firstName} for coffee",
        description: "Show them around and be the person they can ask the small questions.",
        type: "task",
        dayOffset: 0,
        assignee: "buddy",
      },
      { key: "meet-buddy", title: "Meet your buddy", description: "Your go-to person for the small questions.", type: "meet_person", dayOffset: 1, assignee: "subject", config: { personRole: "buddy" } },
      {
        key: "holiday",
        title: "Read the holiday policy",
        type: "read_page",
        dayOffset: 3,
        assignee: "subject",
        config: { spaceSlug: "people", pageSlug: "holiday-policy" },
      },
      { key: "team-lunch", title: "Lunch with the team", description: "On the company. Your manager has booked somewhere close.", type: "task", dayOffset: 4, assignee: "subject" },
      { key: "one-to-one", title: "First proper 1:1 with {firstName}", description: "Agree goals for the first 90 days.", type: "task", dayOffset: 8, assignee: "manager" },
      {
        key: "checkin-form",
        title: "Your 30-day check-in",
        description: "Three quick questions. Your answers go to your manager and the People team.",
        type: "form",
        dayOffset: 29,
        assignee: "subject",
        config: {
          questions: [
            { key: "going-well", label: "What has gone well so far?", type: "textarea", required: true },
            { key: "unclear", label: "What is still unclear?", type: "textarea" },
            { key: "confidence", label: "How settled do you feel?", type: "select", options: ["Very settled", "Getting there", "Not yet"], required: true },
          ],
        },
      },
      { key: "checkin-chat", title: "30-day check-in conversation", type: "task", dayOffset: 29, assignee: "manager" },
    ],
  },
  {
    key: "engineering",
    name: "Engineering onboarding",
    description: "For engineers: access, a working dev environment, a first pull request in week 1 and on-call shadowing in month 1.",
    kind: "onboarding",
    departments: ["Engineering"],
    steps: [
      {
        key: "github-access",
        title: "GitHub access",
        type: "create_ticket",
        dayOffset: -5,
        assignee: "it",
        config: {
          requestTypeSlug: "app-access",
          ticketSubject: "GitHub organisation access for {name}",
          leadDays: 3,
          ticketFields: { app: "github", reason: "New engineer: needs the Northwind GitHub organisation from day 1." },
        },
      },
      {
        key: "first-issue",
        title: "Pick a first issue for {firstName}",
        description: "Small, real and shippable in a few days. Label it good-first-issue.",
        type: "task",
        dayOffset: -2,
        assignee: "manager",
      },
      {
        key: "dev-env",
        title: "Set up your dev environment",
        type: "read_page",
        dayOffset: 1,
        assignee: "subject",
        config: { spaceSlug: "engineering", pageSlug: "dev-environment" },
      },
      { key: "github", title: "Sign in to GitHub", type: "launch_app", dayOffset: 1, assignee: "subject", config: { appSlug: "github" } },
      { key: "pairing", title: "Pair on the first issue", type: "task", dayOffset: 2, assignee: "buddy" },
      { key: "first-pr", title: "Open your first pull request", description: "Small is perfect. Ask your buddy for a review.", type: "task", dayOffset: 4, assignee: "subject" },
      { key: "on-call-read", title: "Read how on-call works", type: "read_page", dayOffset: 9, assignee: "subject", config: { spaceSlug: "engineering", pageSlug: "on-call" } },
      {
        key: "meet-platform",
        title: "Meet the platform team",
        description: "Nikolai runs Platform: deploys, CI and the internal tooling you will lean on.",
        type: "meet_person",
        dayOffset: 10,
        assignee: "subject",
        config: { personId: "@nikolai.petrov" },
      },
      { key: "shadow", title: "Shadow an on-call shift", type: "task", dayOffset: 21, assignee: "subject" },
    ],
  },
  {
    key: "offboarding",
    name: "Offboarding",
    description: "A smooth last few weeks for someone leaving: handover, exit interview, equipment and access.",
    kind: "offboarding",
    steps: [
      { key: "handover-plan", title: "Plan the handover of open work", type: "task", dayOffset: -10, assignee: "manager" },
      {
        key: "handover-note",
        title: "Write a handover note",
        description: "What you own, where it lives, and who picks it up.",
        type: "task",
        dayOffset: -7,
        assignee: "subject",
      },
      { key: "knowledge", title: "Hand over the knowledge pages you own", description: "Reassign ownership so nothing goes stale.", type: "task", dayOffset: -5, assignee: "subject" },
      { key: "exit-interview", title: "Exit interview", type: "task", dayOffset: -3, assignee: "people", assigneeUser: "priya.raman" },
      {
        key: "leaver-survey",
        title: "Leaver survey",
        type: "form",
        dayOffset: -2,
        assignee: "subject",
        config: {
          questions: [
            { key: "reason", label: "What is the main reason you are leaving?", type: "select", options: ["New opportunity", "Relocation", "Career change", "Other"], required: true },
            { key: "improve", label: "One thing we should change", type: "textarea" },
          ],
        },
      },
      {
        key: "return",
        title: "Return laptop and equipment",
        type: "create_ticket",
        dayOffset: 0,
        assignee: "it",
        config: { requestTypeSlug: "offboarding-return", ticketSubject: "Equipment return for {name}", leadDays: 7, ticketFields: { return_method: "Dropped at an office" } },
      },
      { key: "access", title: "Remove access to every app", type: "task", dayOffset: 0, assignee: "it" },
    ],
  },
];

interface SeedRun {
  username: string;
  journeys: string[];
  buddy?: string;
  /** Step keys left pending even though their due date has passed (the rest of the past is done). */
  pendingPast?: string[];
}

const RUNS: SeedRun[] = [
  // Starts tomorrow: most prep done, the team lunch booking slipped.
  { username: "sam.okafor", journeys: ["welcome", "engineering"], buddy: "chloe.martin", pendingPast: ["laptop", "welcome-note", "github-access"] },
  // Two weeks in: nearly everything done, two things slipped.
  { username: "ravi.shankar", journeys: ["welcome", "engineering"], buddy: "kenji.watanabe", pendingPast: ["holiday", "first-pr"] },
  // One week in, no buddy picked yet.
  { username: "carlos.mendes", journeys: ["welcome"], pendingPast: ["ack-security", "team-lunch"] },
  // Starts in two weeks: nothing done yet.
  { username: "felix.wagner", journeys: ["welcome"] },
];

/** Seeds the journeys module for the Northwind Labs demo. Owned by the journeys module. Idempotent. */
export async function seedJourneys(ctx: SeedContext): Promise<void> {
  // Remove our own rows; runs, steps and step runs cascade from journeys.
  await db.delete(s.journeys);

  const org = await db.query.orgSettings.findFirst();
  const today = todayIn(org?.timezone ?? "UTC");
  const workingDays = org?.workingDays ?? [1, 2, 3, 4, 5];

  // Warn about references other modules have not seeded yet. Steps keep their slugs either way.
  const allConfigs = JOURNEYS.flatMap((j) => j.steps.map((st) => st.config ?? {}));
  const want = {
    pages: [...new Set(allConfigs.filter((c) => c.pageSlug).map((c) => `${c.spaceSlug}/${c.pageSlug}`))],
    apps: [...new Set(allConfigs.map((c) => c.appSlug).filter((x): x is string => !!x))],
    requestTypes: [...new Set(allConfigs.map((c) => c.requestTypeSlug).filter((x): x is string => !!x))],
  };
  const [pages, apps, rts] = await Promise.all([
    db.select({ space: s.spaces.slug, slug: s.pages.slug }).from(s.pages).innerJoin(s.spaces, eq(s.spaces.id, s.pages.spaceId)),
    db.select({ slug: s.apps.slug }).from(s.apps).where(inArray(s.apps.slug, want.apps)),
    db.select({ slug: s.requestTypes.slug }).from(s.requestTypes).where(inArray(s.requestTypes.slug, want.requestTypes)),
  ]);
  const havePages = new Set(pages.map((p) => `${p.space}/${p.slug}`));
  const missing = [
    ...want.pages.filter((p) => !havePages.has(p)).map((p) => `page ${p}`),
    ...want.apps.filter((a) => !apps.some((x) => x.slug === a)).map((a) => `app ${a}`),
    ...want.requestTypes.filter((r) => !rts.some((x) => x.slug === r)).map((r) => `request type ${r}`),
  ];
  if (missing.length) {
    console.warn(`[seed:journeys] not seeded yet (steps keep the slug and resolve once they exist): ${missing.join(", ")}`);
  }

  const stepIds = new Map<string, Map<string, { id: string; step: SeedStep }>>();
  const journeyIds = new Map<string, string>();
  for (const j of JOURNEYS) {
    const [row] = await db
      .insert(s.journeys)
      .values({ name: j.name, description: j.description, kind: j.kind, conditions: j.departments ? { departments: j.departments } : {} })
      .returning({ id: s.journeys.id });
    journeyIds.set(j.key, row!.id);
    const inserted = await db
      .insert(s.journeySteps)
      .values(
        j.steps.map((st, position) => {
          const config = { ...(st.config ?? {}) };
          if (config.personId?.startsWith("@")) config.personId = ctx.user(config.personId.slice(1));
          return {
            journeyId: row!.id,
            position,
            title: st.title,
            description: st.description ?? null,
            type: st.type,
            dayOffset: st.dayOffset,
            assignee: st.assignee,
            assigneeUserId: st.assigneeUser ? ctx.user(st.assigneeUser) : null,
            config,
          };
        }),
      )
      .returning({ id: s.journeySteps.id, position: s.journeySteps.position });
    stepIds.set(j.key, new Map(inserted.map((r) => [j.steps[r.position]!.key, { id: r.id, step: j.steps[r.position]! }])));
  }

  const now = new Date();
  let runCount = 0;
  let stepRunCount = 0;
  for (const r of RUNS) {
    const subjectId = ctx.userIdByUsername.get(r.username);
    if (!subjectId) {
      console.warn(`[seed:journeys] ${r.username} not found, skipping their journeys`);
      continue;
    }
    const subject = await db.query.users.findFirst({ where: eq(s.users.id, subjectId) });
    if (!subject?.startDate) continue;
    const buddyId = r.buddy ? ctx.user(r.buddy) : null;
    for (const jKey of r.journeys) {
      const [run] = await db
        .insert(s.journeyRuns)
        .values({ journeyId: journeyIds.get(jKey)!, subjectUserId: subjectId, buddyUserId: buddyId, anchorDate: subject.startDate, startedAt: new Date(`${subject.startDate}T09:00:00Z`) })
        .returning({ id: s.journeyRuns.id });
      runCount++;
      const rows = [...stepIds.get(jKey)!.values()].map(({ id, step }) => {
        const who = resolveAssignee(
          { assignee: step.assignee, assigneeUserId: step.assigneeUser ? ctx.user(step.assigneeUser) : null },
          { subjectUserId: subjectId, managerId: subject.managerId, buddyUserId: buddyId },
        );
        const dueDate = dueDateFor(subject.startDate!, step.dayOffset, workingDays);
        const past = dueDate < today;
        const done = past && !(r.pendingPast ?? []).includes(step.key) && step.type !== "acknowledge_page";
        // Acknowledgements in the past were made by the person; record them as done unless left pending on purpose.
        const ackDone = past && step.type === "acknowledge_page" && !(r.pendingPast ?? []).includes(step.key);
        // Buddy work waits for a buddy: without one it stays pending, whatever the date.
        const needsBuddy = !buddyId && (step.assignee === "buddy" || step.config?.personRole === "buddy");
        const isDone = (done || ackDone) && !needsBuddy;
        return {
          runId: run!.id,
          stepId: id,
          assigneeId: who.assigneeId,
          assigneeTeam: who.assigneeTeam,
          dueDate,
          status: isDone ? ("done" as const) : ("pending" as const),
          completedAt: isDone ? new Date(`${dueDate}T15:00:00Z`) : null,
          completedById: isDone ? (who.assigneeId ?? subject.managerId) : null,
          formAnswers: null,
          // Past reminders count as already sent, so re-seeding does not flood inboxes.
          dueNotifiedAt: past ? now : null,
          overdueNotifiedAt: past ? now : null,
        };
      });
      const inserted = await db.insert(s.journeyStepRuns).values(rows).returning({ id: s.journeyStepRuns.id, stepId: s.journeyStepRuns.stepId, status: s.journeyStepRuns.status });
      stepRunCount += rows.length;
      // Re-seeding must not make the worker raise the same ticket twice: re-link journey tickets
      // already raised for this person (matched by subject), and finish steps whose ticket is resolved.
      for (const sr of inserted) {
        const step = [...stepIds.get(jKey)!.values()].find((x) => x.id === sr.stepId)?.step;
        if (step?.type !== "create_ticket" || sr.status !== "pending") continue;
        const subjectLine = personalise(step.config?.ticketSubject || step.title, subject);
        const ticket = await db.query.tickets.findFirst({
          where: (tk, { and, eq }) => and(eq(tk.source, "journey"), eq(tk.subject, subjectLine)),
          orderBy: (tk, { desc }) => [desc(tk.number)],
        });
        if (!ticket) continue;
        const resolved = ticket.status === "resolved" || ticket.status === "closed";
        await db
          .update(s.journeyStepRuns)
          .set({ ticketId: ticket.id, ...(resolved ? { status: "done" as const, completedAt: ticket.resolvedAt ?? now } : {}) })
          .where(eq(s.journeyStepRuns.id, sr.id));
      }
    }
  }
  console.log(`[seed:journeys] ${JOURNEYS.length} journeys, ${runCount} runs, ${stepRunCount} steps (today ${today}); the worker tick raises their tickets`);
}
