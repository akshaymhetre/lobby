import { inArray, like, sql } from "drizzle-orm";
import { db } from "../client";
import * as s from "../schema/index";
import type { SeedContext } from "./util";
// Pure, dependency-free modules shared with @lobby/core, so the catalog and the SLA maths have one source.
import { STARTER_REQUEST_TYPES, STARTER_SLA_POLICIES, STARTER_TEAMS } from "../../../core/src/helpdesk/catalog-data";
import { addBusinessMinutes, type BusinessCalendar } from "../../../core/src/helpdesk/sla";

/** UK bank holidays (England), so the London calendar skips them. */
const UK_HOLIDAYS = [
  "2026-01-01", "2026-04-03", "2026-04-06", "2026-05-04", "2026-05-25", "2026-08-31", "2026-12-25", "2026-12-28",
  "2027-01-01", "2027-03-26", "2027-03-29", "2027-05-03", "2027-05-31", "2027-08-30", "2027-12-27", "2027-12-28",
];

type Priority = "low" | "normal" | "high" | "urgent";
type Status = (typeof s.TICKET_STATUSES)[number];
type EventKind = (typeof s.ticketEvents.$inferInsert)["kind"];

interface SeedEvent {
  at: number; // hours after creation
  kind: EventKind;
  actor?: string | null;
  body?: string;
  data?: Record<string, unknown>;
}

interface SeedApproval {
  approver?: string;
  group?: string;
  status: "waiting" | "pending" | "approved" | "rejected";
  decidedAt?: number; // hours after creation
  comment?: string;
}

interface SeedTicket {
  requester: string;
  raisedBy?: string;
  type: string;
  subject: string;
  description: string;
  fields?: Record<string, unknown>;
  status: Status;
  priority?: Priority;
  hoursAgo: number;
  assignee?: string;
  source?: "portal" | "ai" | "journey" | "email" | "access_request";
  /** Hours after creation that the SLA clock started (after approval). */
  slaStartAt?: number;
  firstResponseAt?: number;
  resolvedAt?: number;
  /** Override the due dates relative to now, in minutes, to stage "breaching soon" and "breached". */
  firstResponseDueInMinutes?: number;
  resolutionDueInMinutes?: number;
  approvals?: SeedApproval[];
  events?: SeedEvent[];
}

/** Seeds the helpdesk for the Northwind Labs demo. Idempotent: removes its own rows first. */
export async function seedHelpdesk(ctx: SeedContext): Promise<void> {
  // 1. Clear everything this module owns.
  await db.delete(s.connectorLinks);
  await db.delete(s.connectors);
  await db.delete(s.approvals);
  await db.delete(s.ticketEvents);
  await db.delete(s.tickets);
  await db.delete(s.cannedReplies);
  await db.delete(s.requestTypes);
  await db.delete(s.slaPolicies);
  await db.delete(s.teams);
  await db.delete(s.businessCalendars);
  await db.delete(s.searchChunks).where(inArray(s.searchChunks.sourceType, ["request_type", "ticket"]));
  await db.delete(s.notifications).where(like(s.notifications.kind, "helpdesk.%"));
  // Ticket numbers start at 1041 so the demo looks like a desk that has been running a while.
  await db.execute(sql`select setval(pg_get_serial_sequence('tickets', 'number'), 1040, true)`);

  // 2. Calendar, SLA policies, teams.
  const calendarDef: BusinessCalendar = { timezone: "Europe/London", workDays: [1, 2, 3, 4, 5], startMinute: 9 * 60, endMinute: 17 * 60 + 30, holidays: UK_HOLIDAYS };
  const [calendar] = await db.insert(s.businessCalendars).values({ name: "London office hours", ...calendarDef }).returning();
  await db.insert(s.businessCalendars).values({ name: "Around the clock", timezone: "UTC", workDays: [1, 2, 3, 4, 5, 6, 7], startMinute: 0, endMinute: 1440, holidays: [] });

  const policyRows = await db
    .insert(s.slaPolicies)
    .values(Object.values(STARTER_SLA_POLICIES).map((p) => ({ name: p.name, targets: p.targets })))
    .returning();
  const policyId = { standard: policyRows[0]!.id, people: policyRows[1]!.id };
  const policyTargets = { standard: STARTER_SLA_POLICIES.standard.targets, people: STARTER_SLA_POLICIES.people.targets };

  const teamRows = await db
    .insert(s.teams)
    .values(
      STARTER_TEAMS.map((t) => ({
        slug: t.slug,
        name: t.name,
        description: t.description,
        icon: t.icon,
        agentGroupId: ctx.group(t.agentGroup),
        calendarId: calendar!.id,
        roundRobin: t.slug === "workplace",
        sortOrder: t.sortOrder,
      })),
    )
    .returning();
  const team = new Map(teamRows.map((t) => [t.slug, t]));

  const rtRows = await db
    .insert(s.requestTypes)
    .values(
      STARTER_REQUEST_TYPES.map((rt, i) => {
        const tm = team.get(rt.team)!;
        const groupId = rt.approval.group ? ctx.group(rt.approval.group) : (tm.agentGroupId ?? undefined);
        return {
          slug: rt.slug,
          teamId: tm.id,
          name: rt.name,
          description: rt.description,
          icon: rt.icon,
          fields: rt.fields,
          approval: rt.approval.mode === "group" || rt.approval.mode === "manager_then_group" ? { mode: rt.approval.mode, groupId } : { mode: rt.approval.mode },
          slaPolicyId: policyId[rt.sla],
          defaultPriority: rt.defaultPriority,
          sortOrder: i,
        };
      }),
    )
    .returning();
  const rtBySlug = new Map(rtRows.map((r) => [r.slug, r]));
  const slaOf = new Map(STARTER_REQUEST_TYPES.map((r) => [r.slug, r.sla]));

  // 3. Canned replies.
  await db.insert(s.cannedReplies).values([
    { teamId: team.get("it")!.id, title: "Restart and try again", body: "Thanks for the detail. Could you restart your laptop, reconnect, and tell us if it happens again? If it does, a screenshot of the error helps a lot." },
    { teamId: team.get("it")!.id, title: "Access granted", body: "You're in. Sign out and back in to the app and it should appear in your launcher. Shout if it doesn't." },
    { teamId: team.get("it")!.id, title: "Laptop is on its way", body: "Your new laptop is set up and on its way. It'll be at the London office front desk, or with the courier if you asked for delivery. Bring the old one back within two weeks." },
    { teamId: team.get("people")!.id, title: "Payslip explained", body: "Thanks for asking. Your payslip is in BambooHR under Documents. Bonuses are paid the month after they're approved, so a September bonus shows on the October payslip." },
    { teamId: team.get("workplace")!.id, title: "Guest pass ready", body: "Your guest is on the visitor list. They should sign in at reception with photo ID, and we'll call you when they arrive." },
    { teamId: null, title: "Closing as resolved", body: "Glad that's sorted. I'll mark this as resolved. If anything comes back, just reply here and it reopens." },
    { teamId: null, title: "Need more detail", body: "Thanks for raising this. Could you tell us a bit more: when did it start, and what were you doing when it happened?" },
  ]);

  // 4. Tickets.
  const appId = async (slug: string) => {
    const row = await db.query.apps.findFirst({ where: (a, { eq }) => eq(a.slug, slug), columns: { id: true } });
    return row?.id;
  };
  const day = (n: number) => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
  };

  const tickets: SeedTicket[] = [
    // Waiting on Grace Okoye (manager approval).
    {
      requester: "chloe.martin",
      type: "app-access",
      subject: "Salesforce access for customer interviews",
      description: "I'm running the onboarding research with Sales next month and need to read account notes before each interview.",
      fields: { app: await appId("salesforce"), access_level: "Standard", reason: "Read account history before customer interviews for the onboarding research.", temporary: true, until: day(45) },
      status: "pending_approval",
      hoursAgo: 5,
      source: "access_request",
      approvals: [{ approver: "grace.okoye", status: "pending" }, { group: "it-team", status: "waiting" }],
    },
    {
      requester: "arjun.iyer",
      type: "new-laptop",
      subject: "MacBook Pro 14 to replace my 2021 Air",
      description: "Builds of the mobile app take 9 minutes on my Air and it throttles during calls. A 14-inch Pro would cut that a lot.",
      fields: { model: 'MacBook Pro 14"', keyboard_layout: "UK", needed_by: day(14), replacement: true, old_asset_tag: "NW-0871" },
      status: "pending_approval",
      hoursAgo: 26,
      approvals: [{ approver: "grace.okoye", status: "pending" }],
    },
    {
      requester: "lucy.zhang",
      type: "software-request",
      subject: "TestRail licence for regression runs",
      description: "We track release regression in spreadsheets today. TestRail would let the whole QA rota see what has been run.",
      fields: { software: "TestRail", seats: 4, yearly_cost: 1800, reason: "Track regression runs across the QA rota instead of spreadsheets." },
      status: "pending_approval",
      priority: "low",
      hoursAgo: 3,
      approvals: [{ approver: "grace.okoye", status: "pending" }],
    },
    // Manager approved, waiting on the IT team.
    {
      requester: "isabel.duarte",
      type: "app-access",
      subject: "Grafana admin for the on-call dashboards",
      description: "I'm joining the on-call rota next week and need to edit the payments dashboards.",
      fields: { app: await appId("grafana"), access_level: "Admin", reason: "Edit the payments dashboards for my on-call rotation." },
      status: "pending_approval",
      hoursAgo: 30,
      approvals: [
        { approver: "nikolai.petrov", status: "approved", decidedAt: 2, comment: "Yes, she's on the rota from Monday." },
        { group: "it-team", status: "pending" },
      ],
      events: [{ at: 2, kind: "approval", actor: "nikolai.petrov", body: "Yes, she's on the rota from Monday.", data: { decision: "approved", step: 1, steps: 2, final: false } }],
    },
    {
      requester: "maya.chen",
      type: "app-access",
      subject: "Linear for the platform roadmap",
      description: "The platform team plans in Linear now and I can't see the roadmap.",
      fields: { app: await appId("linear"), access_level: "Standard", reason: "Follow and update the platform roadmap." },
      status: "pending_approval",
      hoursAgo: 20,
      source: "access_request",
      approvals: [
        { approver: "nikolai.petrov", status: "approved", decidedAt: 1 },
        { group: "it-team", status: "pending" },
      ],
      events: [{ at: 1, kind: "approval", actor: "nikolai.petrov", data: { decision: "approved", step: 1, steps: 2, final: false } }],
    },
    // In the queue.
    {
      requester: "maya.chen",
      type: "vpn-issue",
      subject: "VPN drops every 20 minutes in the Berlin office",
      description: "Since Monday the VPN disconnects roughly every 20 minutes when I'm on the office wifi. At home it's fine.",
      fields: { where: "An office", error: "Connection to gateway lost (code 809)", internet_ok: true },
      status: "open",
      hoursAgo: 50,
      assignee: "jordan.blake",
      firstResponseAt: 1.5,
      events: [
        { at: 0.6, kind: "assignment", actor: "jordan.blake", data: { from: null, to: "jordan.blake" } },
        { at: 1.5, kind: "reply", actor: "jordan.blake", body: "Thanks Maya. Code 809 usually means the office firewall is closing idle UDP sessions. Could you try switching the VPN client to TCP in Settings > Advanced and tell me if it still drops?" },
        { at: 1.5, kind: "status", actor: "jordan.blake", data: { from: "new", to: "open" } },
        { at: 20, kind: "reply", actor: "maya.chen", body: "Switched to TCP this morning. It's better but it still dropped twice before lunch." },
        { at: 22, kind: "internal_note", actor: "jordan.blake", body: "Berlin office firewall has a 15 minute UDP idle timeout since the firmware update. Asked Leila to check the keepalive setting on the gateway." },
        { at: 23, kind: "internal_note", actor: "leila.haddad", body: "Confirmed. Changing the timeout tonight in the maintenance window." },
      ],
    },
    {
      requester: "kenji.watanabe",
      type: "password-mfa-reset",
      subject: "New phone, locked out of Google",
      description: "Traded in my old phone and forgot to move the authenticator. I can't sign in to Google or Slack.",
      fields: { account: "Google Workspace", problem: "Lost or replaced my phone", blocked: true },
      status: "new",
      priority: "urgent",
      hoursAgo: 0.3,
      firstResponseDueInMinutes: 12,
      resolutionDueInMinutes: 220,
    },
    {
      requester: "omar.farouk",
      type: "something-else",
      subject: "PagerDuty alerts not reaching my phone",
      description: "I was on call last night and two alerts never arrived. Push notifications are on and the test alert works.",
      status: "new",
      priority: "high",
      hoursAgo: 6,
      firstResponseDueInMinutes: -185,
      resolutionDueInMinutes: 300,
      events: [{ at: 6 - 185 / 60, kind: "sla", data: { clock: "first_response", breached: true } }],
    },
    {
      requester: "sam.okafor",
      raisedBy: "grace.okoye",
      type: "onboarding-equipment",
      subject: "Kit for Sam Okafor, starting tomorrow",
      description: "Sam joins Product Engineering tomorrow. Standard engineering setup please, plus a second monitor.",
      fields: { new_starter: ctx.user("sam.okafor"), start_date: day(1), laptop: 'MacBook Pro 14"', extras: "Second monitor and a headset for pairing." },
      status: "open",
      hoursAgo: 30,
      assignee: "leila.haddad",
      firstResponseAt: 2,
      source: "journey",
      events: [
        { at: 0.5, kind: "assignment", actor: "alex.morgan", data: { from: null, to: "leila.haddad" } },
        { at: 2, kind: "reply", actor: "leila.haddad", body: "Laptop is imaged and the accounts are ready. The monitor arrives tomorrow morning, so it'll be on Sam's desk by 10." },
        { at: 2, kind: "status", actor: "leila.haddad", data: { from: "new", to: "open" } },
      ],
    },
    {
      requester: "kenji.watanabe",
      type: "expense-question",
      subject: "Conference ticket claim still not paid",
      description: "I claimed my KubeCon ticket in August and it still shows as approved but unpaid.",
      fields: { topic: "Claim not paid yet", claim_reference: "EXP-20418", amount: 1199 },
      status: "open",
      hoursAgo: 120,
      assignee: "ben.carter",
      firstResponseAt: 3,
      resolutionDueInMinutes: -1440,
      events: [
        { at: 3, kind: "reply", actor: "ben.carter", body: "Thanks Kenji, I can see it. It was approved after the August pay run cut-off. I'm checking whether we can pay it outside the run." },
        { at: 3, kind: "status", actor: "ben.carter", data: { from: "new", to: "open" } },
        { at: 120 - 24, kind: "sla", data: { clock: "resolution", breached: true } },
      ],
    },
    {
      requester: "maya.chen",
      type: "payroll-question",
      subject: "Bonus missing from my September payslip",
      description: "My Q2 bonus was confirmed in August but it isn't on the September payslip.",
      fields: { topic: "Bonus or commission", pay_period: "September 2026" },
      status: "open",
      hoursAgo: 28,
      assignee: "priya.raman",
      firstResponseAt: 4,
      events: [
        { at: 4, kind: "reply", actor: "priya.raman", body: "Hi Maya, bonuses approved in August are paid in the October run, on the 28th. I'll confirm yours is in the batch." },
        { at: 4, kind: "status", actor: "priya.raman", data: { from: "new", to: "open" } },
        { at: 5, kind: "internal_note", actor: "priya.raman", body: "Checked with payroll: Maya's bonus is in the October batch. Waiting for the batch file to confirm the amount before I reply." },
      ],
    },
    {
      requester: "lucy.zhang",
      type: "leave-question",
      subject: "Carrying unused holiday into next year",
      description: "I have 7 days left and won't use them all before December. How many can I carry over?",
      fields: { leave_type: "Annual leave" },
      status: "waiting_on_requester",
      hoursAgo: 52,
      assignee: "sofia.lindqvist",
      firstResponseAt: 6,
      events: [
        { at: 6, kind: "reply", actor: "sofia.lindqvist", body: "You can carry up to 5 days into next year. Could you confirm which 2 days you'd like to book before December so I can update your balance?" },
        { at: 6, kind: "status", actor: "sofia.lindqvist", data: { from: "new", to: "waiting_on_requester" } },
      ],
    },
    {
      requester: "chloe.martin",
      type: "desk-booking",
      subject: "Standing desk near the design team",
      description: "Could I move to one of the standing desks on the second floor, near the designers I pair with?",
      fields: { office: "London", need: "Standing desk", from_date: day(7) },
      status: "open",
      priority: "low",
      hoursAgo: 24,
      assignee: "carlos.mendes",
      firstResponseAt: 5,
      events: [
        { at: 0, kind: "assignment", data: { from: null, to: "carlos.mendes", auto: true } },
        { at: 5, kind: "reply", actor: "carlos.mendes", body: "Two standing desks free up on the second floor next Monday. I've pencilled you in for the one by the window." },
        { at: 5, kind: "status", actor: "carlos.mendes", data: { from: "new", to: "open" } },
      ],
    },
    {
      requester: "daniel.osei",
      type: "building-access",
      subject: "Guest access for the external auditor",
      description: "Our auditor is visiting the London office for two days next week.",
      fields: { need: "Guest access", office: "London", guest_name: "Hannah Pierce", visit_date: day(6) },
      status: "waiting_on_requester",
      hoursAgo: 10,
      assignee: "emily.ross",
      firstResponseAt: 1,
      events: [
        { at: 0, kind: "assignment", data: { from: null, to: "emily.ross", auto: true } },
        { at: 1, kind: "reply", actor: "emily.ross", body: "Happy to set that up. Is it both Tuesday and Wednesday, and will she need access to the finance room?" },
        { at: 1, kind: "status", actor: "emily.ross", data: { from: "new", to: "waiting_on_requester" } },
      ],
    },
    // Done.
    {
      requester: "maya.chen",
      type: "hardware-problem",
      subject: "Dock stops charging my laptop",
      description: "The desk dock at my Berlin desk charges for a few minutes, then stops.",
      fields: { device: "Dock or cable", asset_tag: "NW-2210" },
      status: "resolved",
      hoursAgo: 140,
      assignee: "leila.haddad",
      firstResponseAt: 2,
      resolvedAt: 26,
      events: [
        { at: 2, kind: "reply", actor: "leila.haddad", body: "Sounds like the dock's power supply. I've left a replacement at your desk, could you swap it and let me know?" },
        { at: 2, kind: "status", actor: "leila.haddad", data: { from: "new", to: "open" } },
        { at: 25, kind: "reply", actor: "maya.chen", body: "Swapped, it's been charging all morning. Thank you!" },
        { at: 26, kind: "status", actor: "leila.haddad", data: { from: "open", to: "resolved" } },
      ],
    },
    {
      requester: "ravi.shankar",
      type: "app-access",
      subject: "GitHub access for the data pipelines repo",
      description: "New on the data team and need the pipelines repository.",
      fields: { app: await appId("github"), access_level: "Standard", reason: "Work on the data pipelines repository." },
      status: "resolved",
      hoursAgo: 150,
      assignee: "jordan.blake",
      slaStartAt: 4,
      firstResponseAt: 5,
      resolvedAt: 5,
      approvals: [
        { approver: "nikolai.petrov", status: "approved", decidedAt: 1 },
        { group: "it-team", status: "approved", decidedAt: 4 },
      ],
      events: [
        { at: 1, kind: "approval", actor: "nikolai.petrov", data: { decision: "approved", step: 1, steps: 2, final: false } },
        { at: 4, kind: "approval", actor: "alex.morgan", data: { decision: "approved", step: 2, steps: 2, final: true } },
        { at: 4, kind: "status", actor: "alex.morgan", data: { from: "pending_approval", to: "open" } },
        { at: 4.2, kind: "assignment", actor: "jordan.blake", data: { from: null, to: "jordan.blake" } },
        { at: 5, kind: "reply", actor: "jordan.blake", body: "You're in. Sign out and back in to GitHub and the pipelines repo will show up." },
        { at: 5, kind: "status", actor: "jordan.blake", data: { from: "open", to: "resolved" } },
      ],
    },
    {
      requester: "isabel.duarte",
      type: "update-personal-details",
      subject: "New home address in Berlin",
      description: "I moved to Prenzlauer Berg on the 1st.",
      fields: { what: "Home address", effective_from: day(-14) },
      status: "closed",
      priority: "low",
      hoursAgo: 300,
      assignee: "sofia.lindqvist",
      firstResponseAt: 20,
      resolvedAt: 20,
      events: [
        { at: 20, kind: "reply", actor: "sofia.lindqvist", body: "Updated in BambooHR. Your next payslip will show the new address." },
        { at: 20, kind: "status", actor: "sofia.lindqvist", data: { from: "new", to: "resolved" } },
        { at: 140, kind: "status", data: { from: "resolved", to: "closed" } },
      ],
    },
    {
      requester: "omar.farouk",
      type: "software-request",
      subject: "Paid Postman licence",
      description: "The free Postman plan limits shared collections and the team keeps hitting it.",
      fields: { software: "Postman Professional", seats: 1, yearly_cost: 180, reason: "Share API collections with the SRE team." },
      status: "rejected",
      priority: "low",
      hoursAgo: 96,
      resolvedAt: 8,
      approvals: [{ approver: "nikolai.petrov", status: "rejected", decidedAt: 8, comment: "We're moving the team to Bruno, which is free. Let's talk on Thursday." }],
      events: [
        { at: 8, kind: "approval", actor: "nikolai.petrov", body: "We're moving the team to Bruno, which is free. Let's talk on Thursday.", data: { decision: "rejected", step: 1, steps: 1, final: false } },
        { at: 8, kind: "status", actor: "nikolai.petrov", data: { from: "pending_approval", to: "rejected" } },
      ],
    },
  ];

  const now = Date.now();
  const H = 3600_000;
  for (const t of tickets) {
    const rt = rtBySlug.get(t.type)!;
    const tm = teamRows.find((x) => x.id === rt.teamId)!;
    const created = new Date(now - t.hoursAgo * H);
    const at = (h: number) => new Date(created.getTime() + h * H);
    const priority = t.priority ?? rt.defaultPriority;
    const targets = policyTargets[slaOf.get(t.type)!][priority];
    const slaRuns = t.status !== "pending_approval" && t.status !== "rejected";
    const start = at(t.slaStartAt ?? 0);
    let frDue = slaRuns ? addBusinessMinutes(start, targets.firstResponse, calendarDef) : null;
    let resDue = slaRuns ? addBusinessMinutes(start, targets.resolution, calendarDef) : null;
    if (t.firstResponseDueInMinutes !== undefined) frDue = new Date(now + t.firstResponseDueInMinutes * 60_000);
    if (t.resolutionDueInMinutes !== undefined) resDue = new Date(now + t.resolutionDueInMinutes * 60_000);
    const firstRespondedAt = t.firstResponseAt !== undefined ? at(t.firstResponseAt) : null;
    const resolvedAt = t.resolvedAt !== undefined ? at(t.resolvedAt) : null;
    const lastEvent = Math.max(0, ...(t.events ?? []).map((e) => e.at));

    const [row] = await db
      .insert(s.tickets)
      .values({
        requestTypeId: rt.id,
        teamId: tm.id,
        requesterId: ctx.user(t.requester),
        assigneeId: t.assignee ? ctx.user(t.assignee) : null,
        subject: t.subject,
        description: t.description,
        fields: Object.fromEntries(Object.entries(t.fields ?? {}).filter(([, v]) => v !== undefined)),
        status: t.status,
        priority,
        source: t.source ?? "portal",
        firstResponseDueAt: frDue,
        resolutionDueAt: resDue,
        firstRespondedAt,
        resolvedAt,
        firstResponseBreachedAt: frDue && !firstRespondedAt && frDue.getTime() < now ? frDue : firstRespondedAt && frDue && firstRespondedAt > frDue ? frDue : null,
        resolutionBreachedAt: resDue && !resolvedAt && resDue.getTime() < now ? resDue : null,
        createdAt: created,
        updatedAt: at(lastEvent),
      })
      .returning();
    const ticketId = row!.id;
    const actorOf = (u?: string | null) => (u ? ctx.user(u) : null);

    const events: (typeof s.ticketEvents.$inferInsert)[] = [
      { ticketId, actorId: actorOf(t.raisedBy ?? t.requester), kind: "system", data: { action: "created", source: t.source ?? "portal", ...(t.raisedBy ? { onBehalfOf: ctx.user(t.requester) } : {}) }, createdAt: created },
    ];
    for (const e of t.events ?? []) {
      const data = { ...(e.data ?? {}) };
      for (const k of ["to", "from"]) if (typeof data[k] === "string" && (data[k] as string).includes(".")) data[k] = ctx.user(data[k] as string);
      events.push({ ticketId, actorId: actorOf(e.actor), kind: e.kind, body: e.body ?? null, data, createdAt: at(e.at) });
    }
    await db.insert(s.ticketEvents).values(events);

    if (t.approvals?.length) {
      await db.insert(s.approvals).values(
        t.approvals.map((a, i) => ({
          ticketId,
          step: i + 1,
          approverId: a.approver ? ctx.user(a.approver) : null,
          groupId: a.group ? ctx.group(a.group) : null,
          status: a.status,
          decidedById: a.status === "approved" || a.status === "rejected" ? (a.approver ? ctx.user(a.approver) : ctx.user("alex.morgan")) : null,
          decidedAt: a.decidedAt !== undefined ? at(a.decidedAt) : null,
          comment: a.comment ?? null,
          createdAt: created,
        })),
      );
      for (const a of t.approvals) {
        if (a.status !== "pending" || !a.approver) continue;
        await db.insert(s.notifications).values({
          userId: ctx.user(a.approver),
          kind: "helpdesk.approval_requested",
          title: `${displayNameOf(t.requester)} needs your approval`,
          body: `${rt.name}: ${t.subject}`,
          href: "/approvals",
          createdAt: created,
        });
      }
    }
  }
}

const displayNameOf = (username: string) =>
  username
    .split(".")
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");
