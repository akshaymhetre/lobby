/**
 * Pure journey rules: who a journey applies to and who owns each step. No database access,
 * so they are unit-tested directly and safe to import from client components.
 */
import type { JourneyKind } from "./dates";

export interface Conditions {
  departments?: string[];
  locations?: string[];
  groupIds?: string[];
}

export interface MatchSubject {
  department: string | null;
  location: string | null;
  startDate: string | null;
  endDate: string | null;
  groupIds: string[];
}

/**
 * A journey matches when every condition that is set is satisfied (AND across dimensions,
 * OR within one). An empty condition list means everyone.
 */
export function matchesConditions(subject: MatchSubject, c: Conditions): boolean {
  const deps = c.departments?.filter(Boolean) ?? [];
  const locs = c.locations?.filter(Boolean) ?? [];
  const groups = c.groupIds?.filter(Boolean) ?? [];
  if (deps.length && !(subject.department && deps.some((d) => d.toLowerCase() === subject.department!.toLowerCase()))) return false;
  if (locs.length && !(subject.location && locs.some((l) => l.toLowerCase() === subject.location!.toLowerCase()))) return false;
  if (groups.length && !groups.some((g) => subject.groupIds.includes(g))) return false;
  return true;
}

/** Onboarding anchors on the start date, offboarding on the end date. Null when unset. */
export function anchorFor(subject: Pick<MatchSubject, "startDate" | "endDate">, kind: JourneyKind): string | null {
  return kind === "offboarding" ? subject.endDate : subject.startDate;
}

export function conditionsSummary(c: Conditions, groupName: (id: string) => string | undefined = () => undefined): string {
  const parts: string[] = [];
  if (c.departments?.length) parts.push(c.departments.join(", "));
  if (c.locations?.length) parts.push(c.locations.join(", "));
  if (c.groupIds?.length) parts.push(c.groupIds.map((g) => groupName(g) ?? "a group").join(", "));
  return parts.length ? parts.join(" in ") : "Everyone";
}

export type AssigneeKind = "subject" | "manager" | "buddy" | "it" | "people" | "specific";

export interface AssigneeInput {
  assignee: AssigneeKind;
  assigneeUserId: string | null;
}

export interface RunPeople {
  subjectUserId: string;
  managerId: string | null;
  buddyUserId: string | null;
}

export interface ResolvedAssignee {
  assigneeId: string | null;
  /** Set when the step sits in a team queue rather than with one person. */
  assigneeTeam: "it" | "people" | null;
  /** True for a buddy step while no buddy has been chosen yet. */
  awaitingBuddy: boolean;
}

/**
 * Who does a step for a particular person:
 *  - subject: the person themselves
 *  - manager: their manager (unowned when they have none)
 *  - buddy: the run's buddy, or nobody until the manager picks one
 *  - it / people: a named person when the template sets one, otherwise that team's queue
 *  - specific: the named person
 */
export function resolveAssignee(step: AssigneeInput, run: RunPeople): ResolvedAssignee {
  switch (step.assignee) {
    case "subject":
      return { assigneeId: run.subjectUserId, assigneeTeam: null, awaitingBuddy: false };
    case "manager":
      return { assigneeId: run.managerId, assigneeTeam: null, awaitingBuddy: false };
    case "buddy":
      return { assigneeId: run.buddyUserId, assigneeTeam: null, awaitingBuddy: !run.buddyUserId };
    case "it":
    case "people":
      return step.assigneeUserId
        ? { assigneeId: step.assigneeUserId, assigneeTeam: null, awaitingBuddy: false }
        : { assigneeId: null, assigneeTeam: step.assignee, awaitingBuddy: false };
    case "specific":
      return { assigneeId: step.assigneeUserId, assigneeTeam: null, awaitingBuddy: false };
  }
}

export const ASSIGNEE_LABELS: Record<AssigneeKind, string> = {
  subject: "New hire",
  manager: "Manager",
  buddy: "Buddy",
  it: "IT team",
  people: "People team",
  specific: "A specific person",
};

export const OFFBOARDING_ASSIGNEE_LABELS: Record<AssigneeKind, string> = {
  ...ASSIGNEE_LABELS,
  subject: "Person leaving",
};

/**
 * Who may tick a step off: the person it is assigned to, the subject's manager, an admin or a
 * People team member, or (for a team-queue step) a member of that team.
 */
export function canActOnStep(
  actor: { userId: string; isAdmin: boolean; teams: ("it" | "people")[] },
  step: { assigneeId: string | null; assigneeTeam: "it" | "people" | null; subjectManagerId: string | null },
): boolean {
  if (actor.isAdmin) return true;
  if (step.assigneeId === actor.userId) return true;
  if (step.subjectManagerId === actor.userId) return true;
  if (actor.teams.includes("people")) return true;
  if (step.assigneeTeam && actor.teams.includes(step.assigneeTeam)) return true;
  return false;
}

/**
 * Fills the placeholders a template can use in titles and descriptions:
 * {name}, {firstName}, {startDate}, {endDate}.
 */
export function personalise(
  text: string,
  subject: { displayName: string; firstName?: string | null; startDate?: string | null; endDate?: string | null },
): string {
  const first = subject.firstName || subject.displayName.split(" ")[0] || subject.displayName;
  return text
    .replaceAll("{name}", subject.displayName)
    .replaceAll("{firstName}", first)
    .replaceAll("{startDate}", subject.startDate ?? "")
    .replaceAll("{endDate}", subject.endDate ?? "");
}

export interface TicketFieldDef {
  key: string;
  type: string;
  required?: boolean;
  options?: string[];
  showIf?: { key: string; equals: string | boolean };
}

/**
 * Fills a request type's form for a journey ticket: template values first, then sensible
 * defaults for required fields (the person, their date, the step's text, the first option).
 */
export function ticketFieldValues(
  defs: TicketFieldDef[],
  given: Record<string, string | boolean>,
  ctx: { subjectId: string; anchor: string; text: string; appSlug?: string },
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...given };
  for (const f of defs) {
    if (out[f.key] !== undefined && out[f.key] !== "") continue;
    if (f.type === "user") out[f.key] = ctx.subjectId;
    else if (f.type === "date" && f.required && !f.showIf) out[f.key] = ctx.anchor;
    else if ((f.type === "text" || f.type === "textarea") && f.required && !f.showIf) out[f.key] = ctx.text;
    else if (f.type === "select" && f.required && !f.showIf && f.options?.length) out[f.key] = f.options[0];
    else if (f.type === "app" && ctx.appSlug) out[f.key] = ctx.appSlug;
  }
  return out;
}
