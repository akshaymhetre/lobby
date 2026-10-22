import { asc, db, isNull, s } from "@lobby/db";
import { configDoc, type ConfigDoc, type JourneyItem } from "./schema";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const minutes = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
export const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h! * 60 + m!;
};

/** Journey step config keys that hold ids, and the natural key each is written as in the file. */
/** Most step references are already slugs (spaceSlug, pageSlug, appSlug, requestTypeSlug); only people are ids. */
export const STEP_REFS = { personId: "person" } as const;

export interface Lookups {
  groupName: Map<string, string>;
  userEmail: Map<string, string>;
  calendarName: Map<string, string>;
  slaName: Map<string, string>;
  teamSlug: Map<string, string>;
  appSlug: Map<string, string>;
  requestTypeSlug: Map<string, string>;
  pageRef: Map<string, string>;
}

/** id -> natural key maps for everything the file refers to. */
export async function loadLookups(): Promise<Lookups> {
  const [groups, users, calendars, slas, teams, apps, rts, pages, spaces] = await Promise.all([
    db.select({ id: s.groups.id, k: s.groups.name }).from(s.groups),
    db.select({ id: s.users.id, k: s.users.email }).from(s.users),
    db.select({ id: s.businessCalendars.id, k: s.businessCalendars.name }).from(s.businessCalendars),
    db.select({ id: s.slaPolicies.id, k: s.slaPolicies.name }).from(s.slaPolicies),
    db.select({ id: s.teams.id, k: s.teams.slug }).from(s.teams),
    db.select({ id: s.apps.id, k: s.apps.slug }).from(s.apps),
    db.select({ id: s.requestTypes.id, k: s.requestTypes.slug }).from(s.requestTypes),
    db.select({ id: s.pages.id, slug: s.pages.slug, spaceId: s.pages.spaceId }).from(s.pages),
    db.select({ id: s.spaces.id, slug: s.spaces.slug }).from(s.spaces),
  ]);
  const m = (rows: { id: string; k: string }[]) => new Map(rows.map((r) => [r.id, r.k]));
  const spaceSlug = new Map(spaces.map((sp) => [sp.id, sp.slug]));
  return {
    groupName: m(groups),
    userEmail: m(users),
    calendarName: m(calendars),
    slaName: m(slas),
    teamSlug: m(teams),
    appSlug: m(apps),
    requestTypeSlug: m(rts),
    pageRef: new Map(pages.map((p) => [p.id, `${spaceSlug.get(p.spaceId)}/${p.slug}`])),
  };
}

const names = (ids: string[] | null | undefined, map: Map<string, string>) =>
  (ids ?? []).map((id) => map.get(id)).filter((x): x is string => !!x).sort();

export function stepConfigToFile(config: Record<string, unknown>, l: Lookups): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(config ?? {})) {
    const ref = STEP_REFS[k as keyof typeof STEP_REFS];
    if (ref && typeof v === "string" && UUID.test(v)) {
      const natural = l.userEmail.get(v);
      if (natural) {
        out[ref] = natural;
        continue;
      }
    }
    out[k] = v;
  }
  return out;
}

/** Reads the live configuration into the file shape (normalised through the schema). */
export async function snapshot(): Promise<ConfigDoc> {
  const l = await loadLookups();
  const [org, roleMappings, groups, apps, visibility, spaces, calendars, slas, teams, rts, journeys, steps] = await Promise.all([
    db.query.orgSettings.findFirst(),
    db.select().from(s.roleMappings),
    db.select().from(s.groups).orderBy(asc(s.groups.name)),
    db.select().from(s.apps).orderBy(asc(s.apps.sortOrder), asc(s.apps.slug)),
    db.select().from(s.appVisibility),
    db.select().from(s.spaces).orderBy(asc(s.spaces.sortOrder), asc(s.spaces.slug)),
    db.select().from(s.businessCalendars).orderBy(asc(s.businessCalendars.name)),
    db.select().from(s.slaPolicies).orderBy(asc(s.slaPolicies.name)),
    db.select().from(s.teams).orderBy(asc(s.teams.sortOrder), asc(s.teams.slug)),
    db.select().from(s.requestTypes).orderBy(asc(s.requestTypes.sortOrder), asc(s.requestTypes.slug)),
    db.select().from(s.journeys).orderBy(asc(s.journeys.name)),
    db.select().from(s.journeySteps).where(isNull(s.journeySteps.archivedAt)).orderBy(asc(s.journeySteps.journeyId), asc(s.journeySteps.position)),
  ]);

  const visByApp = new Map<string, string[]>();
  for (const v of visibility) visByApp.set(v.appId, [...(visByApp.get(v.appId) ?? []), v.groupId]);
  const stepsByJourney = new Map<string, typeof steps>();
  for (const st of steps) stepsByJourney.set(st.journeyId, [...(stepsByJourney.get(st.journeyId) ?? []), st]);

  const doc = {
    version: 1 as const,
    org: org
      ? {
          companyName: org.companyName,
          productName: org.productName,
          accentColor: org.accentColor.toUpperCase(),
          timezone: org.timezone,
          workingDays: [...org.workingDays].sort(),
          emailDomain: org.emailDomain,
          logoUrl: org.logoUrl,
        }
      : undefined,
    roleMappings: roleMappings
      .filter((m) => m.role === "admin" || m.role === "agent" || m.role === "content-editor")
      .map((m) => ({ group: m.groupName, role: m.role as "admin" | "agent" | "content-editor" }))
      .sort((a, b) => `${a.role}${a.group}`.localeCompare(`${b.role}${b.group}`)),
    groups: groups.map((g) => ({ name: g.name, displayName: g.displayName })),
    apps: apps.map((a) => ({
      slug: a.slug,
      name: a.name,
      description: a.description,
      category: a.category,
      icon: a.icon,
      color: a.color,
      launchUrl: a.launchUrl,
      launchType: a.launchType,
      presetKey: a.presetKey,
      owner: a.ownerId ? (l.userEmail.get(a.ownerId) ?? null) : null,
      requestAccessEnabled: a.requestAccessEnabled,
      sortOrder: a.sortOrder,
      visibleTo: names(visByApp.get(a.id), l.groupName),
    })),
    knowledgeSpaces: spaces.map((sp) => ({
      slug: sp.slug,
      name: sp.name,
      description: sp.description,
      icon: sp.icon,
      sortOrder: sp.sortOrder,
      editors: names(sp.editorGroupIds, l.groupName),
      visibleTo: names(sp.visibilityGroupIds, l.groupName),
    })),
    helpdesk: {
      calendars: calendars.map((c) => ({
        name: c.name,
        timezone: c.timezone,
        workDays: [...c.workDays].sort(),
        start: minutes(c.startMinute),
        end: minutes(c.endMinute),
        holidays: [...c.holidays].sort(),
      })),
      slaPolicies: slas.map((p) => ({ name: p.name, targets: p.targets })),
      teams: teams.map((t) => ({
        slug: t.slug,
        name: t.name,
        description: t.description,
        icon: t.icon,
        agentGroup: t.agentGroupId ? (l.groupName.get(t.agentGroupId) ?? null) : null,
        calendar: t.calendarId ? (l.calendarName.get(t.calendarId) ?? null) : null,
        roundRobin: t.roundRobin,
        sortOrder: t.sortOrder,
      })),
      requestTypes: rts.map((r) => ({
        slug: r.slug,
        team: l.teamSlug.get(r.teamId) ?? r.teamId,
        name: r.name,
        description: r.description,
        icon: r.icon,
        fields: r.fields,
        approval: r.approval.groupId
          ? { mode: r.approval.mode, group: l.groupName.get(r.approval.groupId) ?? r.approval.groupId }
          : { mode: r.approval.mode },
        slaPolicy: r.slaPolicyId ? (l.slaName.get(r.slaPolicyId) ?? null) : null,
        defaultPriority: r.defaultPriority,
        active: r.active,
        sortOrder: r.sortOrder,
      })),
    },
    journeys: journeys.map((j): JourneyItem => {
      const conditions: JourneyItem["conditions"] = {};
      if (j.conditions.departments?.length) conditions.departments = [...j.conditions.departments].sort();
      if (j.conditions.locations?.length) conditions.locations = [...j.conditions.locations].sort();
      if (j.conditions.groupIds?.length) conditions.groups = names(j.conditions.groupIds, l.groupName);
      return {
        name: j.name,
        description: j.description,
        kind: j.kind,
        active: j.active,
        conditions,
        steps: (stepsByJourney.get(j.id) ?? []).map((st) => ({
          title: st.title,
          description: st.description,
          type: st.type,
          dayOffset: st.dayOffset,
          assignee: st.assignee,
          assigneeEmail: st.assigneeUserId ? (l.userEmail.get(st.assigneeUserId) ?? null) : null,
          config: stepConfigToFile(st.config as Record<string, unknown>, l),
        })),
      };
    }),
  };
  return configDoc.parse(doc);
}
