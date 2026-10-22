import { z } from "zod";
import type Anthropic from "@anthropic-ai/sdk";
import { and, db, eq, ilike, inArray, or, s, sql } from "@lobby/db";
import type { UserContext } from "@lobby/core";
import { search, type SearchHit } from "@lobby/core/search";

/** A numbered source the model can cite as [n]. */
export interface Source {
  n: number;
  title: string;
  url: string;
  sourceType: string;
}

export interface ToolRunContext {
  ctx: UserContext;
  /** Sources gathered so far in this assistant turn; tools append and number them. */
  sources: Source[];
}

interface ToolDef<I extends z.ZodType> {
  name: string;
  description: string;
  input: I;
  /** Actions change data and run only after the user confirms. */
  kind: "read" | "action";
  /** One-line, human description of a proposed action, shown on the confirm card. */
  summarize?: (input: z.infer<I>) => string;
  run: (input: z.infer<I>, rc: ToolRunContext) => Promise<string>;
}

const def = <I extends z.ZodType>(d: ToolDef<I>) => d;

const OPEN_TICKET = ["new", "open", "pending_approval", "waiting_on_requester"] as const;

function addSources(rc: ToolRunContext, hits: SearchHit[]) {
  return hits.map((h) => {
    const existing = rc.sources.find((x) => x.url === h.url);
    if (existing) return { n: existing.n, hit: h };
    const src: Source = { n: rc.sources.length + 1, title: h.title, url: h.url, sourceType: h.sourceType };
    rc.sources.push(src);
    return { n: src.n, hit: h };
  });
}

async function optional<T>(load: () => Promise<T>): Promise<T | null> {
  try {
    return await load();
  } catch {
    return null;
  }
}

export const TOOLS = [
  def({
    name: "search_knowledge",
    kind: "read",
    description:
      "Search the company knowledge base (policies, handbooks, how-to guides, IT and HR help topics). " +
      "Returns numbered sources you must cite as [n]. Always search before answering a question about how the company works.",
    input: z.object({ query: z.string().min(2).describe("What to look for, in plain words") }),
    async run({ query }, rc) {
      const hits = await search({ principals: rc.ctx.principals, query, types: ["page", "request_type"], limit: 6 });
      if (!hits.length) return "No matching pages. Say you could not find it in the knowledge base; do not guess.";
      return addSources(rc, hits)
        .map(({ n, hit }) => {
          const freshness = hit.freshness < 0.6 ? " (this page is overdue for review; mention it may be out of date)" : "";
          return `[${n}] ${hit.title}${freshness}\nURL: ${hit.url}\n${hit.text.slice(0, 1800)}`;
        })
        .join("\n\n---\n\n");
    },
  }),
  def({
    name: "find_person",
    kind: "read",
    description: "Find colleagues by name, role, team, skill or location. Returns name, title, team, location, manager and profile link.",
    input: z.object({ query: z.string().min(1) }),
    async run({ query }, rc) {
      const people = await optional(async () => {
        const mod = await import("@lobby/core/people");
        return (await mod.findPeople(rc.ctx, query, 6)) as { id: string; displayName: string; title: string | null; department: string | null; location: string | null }[];
      });
      const rows =
        people ??
        (await db
          .select({ id: s.users.id, displayName: s.users.displayName, title: s.users.title, department: s.users.department, location: s.users.location })
          .from(s.users)
          .where(and(eq(s.users.status, "active"), or(
            ilike(s.users.displayName, `%${query}%`), ilike(s.users.title, `%${query}%`), ilike(s.users.department, `%${query}%`),
          )))
          .limit(6));
      if (!rows.length) return "Nobody matched.";
      return rows
        .map((p) => {
          const url = `/people/${p.id}`;
          const n = addSources(rc, [{ sourceType: "person", sourceId: p.id, title: p.displayName, snippet: "", text: "", url, freshness: 1, score: 1 }])[0]!.n;
          return `[${n}] ${p.displayName}, ${p.title ?? "no title"}, ${p.department ?? ""} (${p.location ?? ""}). Profile: ${url}`;
        })
        .join("\n");
    },
  }),
  def({
    name: "find_app",
    kind: "read",
    description: "Find internal apps in the company app launcher the user can open, with their launch links.",
    input: z.object({ query: z.string().describe("App name or what it is for; empty for all").default("") }),
    async run({ query }, rc) {
      const visible = await optional(async () => {
        const mod = await import("@lobby/core/apps");
        return (await mod.listVisibleApps(rc.ctx)) as { slug: string; name: string; description: string | null; category: string }[];
      });
      const apps = visible ?? (await db.select().from(s.apps));
      const q = query.toLowerCase();
      const hits = apps.filter((a) => !q || `${a.name} ${a.description ?? ""} ${a.category}`.toLowerCase().includes(q)).slice(0, 8);
      if (!hits.length) return "No visible app matched. The user may need to request access from the Apps page.";
      return hits.map((a) => `${a.name} (${a.category}): ${a.description ?? ""}. Open: /apps/launch/${a.slug}`).join("\n");
    },
  }),
  def({
    name: "list_my_tickets",
    kind: "read",
    description: "List the user's own helpdesk requests with number, subject, status and team.",
    input: z.object({ openOnly: z.boolean().default(true) }),
    async run({ openOnly }, rc) {
      const rows = await db
        .select({ number: s.tickets.number, subject: s.tickets.subject, status: s.tickets.status, team: s.teams.name, createdAt: s.tickets.createdAt })
        .from(s.tickets)
        .innerJoin(s.teams, eq(s.teams.id, s.tickets.teamId))
        .where(and(eq(s.tickets.requesterId, rc.ctx.user.id), openOnly ? inArray(s.tickets.status, [...OPEN_TICKET]) : undefined))
        .orderBy(sql`${s.tickets.createdAt} desc`)
        .limit(10);
      if (!rows.length) return openOnly ? "The user has no open requests." : "The user has no requests.";
      return rows.map((t) => `#${t.number} "${t.subject}" - ${t.status.replace(/_/g, " ")} (${t.team}). Link: /help/${t.number}`).join("\n");
    },
  }),
  def({
    name: "list_request_types",
    kind: "read",
    description: "List the helpdesk request types (service catalog) with their slugs, to pick the right one before creating a ticket.",
    input: z.object({}),
    async run() {
      const rows = await db
        .select({ slug: s.requestTypes.slug, name: s.requestTypes.name, description: s.requestTypes.description, team: s.teams.name })
        .from(s.requestTypes)
        .innerJoin(s.teams, eq(s.teams.id, s.requestTypes.teamId))
        .where(eq(s.requestTypes.active, true));
      return rows.map((r) => `${r.slug}: ${r.name} (${r.team}) - ${r.description ?? ""}`).join("\n") || "No request types configured.";
    },
  }),
  def({
    name: "my_onboarding_tasks",
    kind: "read",
    description: "List onboarding or offboarding steps currently assigned to the user, with due dates and step ids.",
    input: z.object({}),
    async run(_input, rc) {
      const rows = await db
        .select({ id: s.journeyStepRuns.id, title: s.journeySteps.title, due: s.journeyStepRuns.dueDate, journey: s.journeys.name })
        .from(s.journeyStepRuns)
        .innerJoin(s.journeySteps, eq(s.journeySteps.id, s.journeyStepRuns.stepId))
        .innerJoin(s.journeyRuns, eq(s.journeyRuns.id, s.journeyStepRuns.runId))
        .innerJoin(s.journeys, eq(s.journeys.id, s.journeyRuns.journeyId))
        .where(and(eq(s.journeyStepRuns.assigneeId, rc.ctx.user.id), eq(s.journeyStepRuns.status, "pending"), eq(s.journeyRuns.status, "active")))
        .orderBy(s.journeyStepRuns.dueDate)
        .limit(15);
      if (!rows.length) return "The user has no open onboarding tasks.";
      return rows.map((r) => `step ${r.id}: "${r.title}" due ${r.due} (${r.journey})`).join("\n");
    },
  }),
  def({
    name: "create_ticket",
    kind: "action",
    description:
      "Raise a helpdesk request for the user. Use list_request_types first to choose requestTypeSlug. " +
      "The user will see a confirmation card and must approve before anything is submitted.",
    input: z.object({
      requestTypeSlug: z.string(),
      subject: z.string().min(4).max(140),
      description: z.string().max(4000).default(""),
      priority: z.enum(["low", "normal", "high", "urgent"]).default("normal"),
    }),
    summarize: (i) => `Raise a "${i.requestTypeSlug.replace(/-/g, " ")}" request: ${i.subject}`,
    async run(input, rc) {
      const mod = await import("@lobby/core/helpdesk");
      const t = await mod.createTicket(rc.ctx, { ...input, source: "ai" });
      return `Created request #${t.number}. Link: /help/${t.number}`;
    },
  }),
  def({
    name: "request_app_access",
    kind: "action",
    description: "Request access to an app the user cannot see yet. Goes through the access-request approval flow. Requires user confirmation.",
    input: z.object({ appSlug: z.string(), reason: z.string().min(3).max(1000) }),
    summarize: (i) => `Request access to ${i.appSlug}: ${i.reason}`,
    async run({ appSlug, reason }, rc) {
      const app = await db.query.apps.findFirst({ where: eq(s.apps.slug, appSlug) });
      if (!app) return `There is no app with slug ${appSlug}.`;
      const mod = await import("@lobby/core/helpdesk");
      const t = await mod.createTicket(rc.ctx, {
        requestTypeSlug: "app-access",
        subject: `Access to ${app.name}`,
        description: reason,
        fields: { app: app.slug, reason },
        source: "access_request",
      });
      return `Access requested as #${t.number}; it needs approval. Link: /help/${t.number}`;
    },
  }),
  def({
    name: "complete_onboarding_step",
    kind: "action",
    description: "Mark one of the user's onboarding steps as done (use the step id from my_onboarding_tasks). Requires user confirmation.",
    input: z.object({ stepRunId: z.string().uuid(), title: z.string().describe("The step title, for the confirmation card") }),
    summarize: (i) => `Mark "${i.title}" as done`,
    async run({ stepRunId }, rc) {
      const mod = await import("@lobby/core/journeys");
      await mod.completeStep(rc.ctx, stepRunId);
      return "Step marked as done.";
    },
  }),
] as const;

export type ToolName = (typeof TOOLS)[number]["name"];
export const toolByName = (name: string) => TOOLS.find((t) => t.name === name);

/** Tool definitions in the shape the Messages API expects. */
export function apiTools(): Anthropic.Beta.BetaTool[] {
  return TOOLS.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: z.toJSONSchema(t.input, { target: "draft-7", io: "input" }) as Anthropic.Beta.BetaTool.InputSchema,
  }));
}
