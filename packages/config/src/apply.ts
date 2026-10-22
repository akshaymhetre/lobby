import { and, db, eq, inArray, isNull, notInArray, s } from "@lobby/db";
import type { ApprovalRule, JourneyConditions, JourneyStepConfig } from "@lobby/db/schema";
import type { ConfigDoc } from "./schema";
import { loadLookups, STEP_REFS, toMinutes, type Lookups } from "./snapshot";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

const invert = (m: Map<string, string>) => new Map([...m].map(([id, k]) => [k, id]));

/**
 * Checks every cross-reference in the file (group names, team slugs, calendars, SLA policies,
 * people, journey step targets) against the database plus what the file itself creates.
 */
export async function checkReferences(doc: ConfigDoc, l?: Lookups): Promise<string[]> {
  l ??= await loadLookups();
  const errors: string[] = [];
  const groups = new Set([...l.groupName.values(), ...(doc.groups ?? []).map((g) => g.name)]);
  const users = new Set(l.userEmail.values());
  const calendars = new Set([...l.calendarName.values(), ...(doc.helpdesk?.calendars ?? []).map((c) => c.name)]);
  const slas = new Set([...l.slaName.values(), ...(doc.helpdesk?.slaPolicies ?? []).map((c) => c.name)]);
  const teams = new Set([...l.teamSlug.values(), ...(doc.helpdesk?.teams ?? []).map((t) => t.slug)]);
  const apps = new Set([...l.appSlug.values(), ...(doc.apps ?? []).map((a) => a.slug)]);
  const rts = new Set([...l.requestTypeSlug.values(), ...(doc.helpdesk?.requestTypes ?? []).map((r) => r.slug)]);
  const pages = new Set(l.pageRef.values());

  const needGroup = (where: string, name: string | null | undefined) => {
    if (name && !groups.has(name)) errors.push(`${where} refers to group "${name}", which does not exist. Add it under groups.`);
  };
  for (const a of doc.apps ?? []) {
    a.visibleTo.forEach((g) => needGroup(`App "${a.slug}"`, g));
    if (a.owner && !users.has(a.owner.toLowerCase())) errors.push(`App "${a.slug}" names owner ${a.owner}, who is not in Lobby.`);
  }
  for (const sp of doc.knowledgeSpaces ?? []) [...sp.editors, ...sp.visibleTo].forEach((g) => needGroup(`Space "${sp.slug}"`, g));
  for (const t of doc.helpdesk?.teams ?? []) {
    needGroup(`Team "${t.slug}"`, t.agentGroup);
    if (t.calendar && !calendars.has(t.calendar)) errors.push(`Team "${t.slug}" uses calendar "${t.calendar}", which does not exist.`);
  }
  for (const r of doc.helpdesk?.requestTypes ?? []) {
    if (!teams.has(r.team)) errors.push(`Request type "${r.slug}" belongs to team "${r.team}", which does not exist.`);
    if (r.slaPolicy && !slas.has(r.slaPolicy)) errors.push(`Request type "${r.slug}" uses SLA policy "${r.slaPolicy}", which does not exist.`);
    needGroup(`Request type "${r.slug}"`, r.approval.group);
  }
  for (const j of doc.journeys ?? []) {
    j.conditions.groups?.forEach((g) => needGroup(`Journey "${j.name}"`, g));
    j.steps.forEach((st, i) => {
      const where = `Journey "${j.name}" step ${i + 1}`;
      if (st.assigneeEmail && !users.has(st.assigneeEmail.toLowerCase())) errors.push(`${where} is assigned to ${st.assigneeEmail}, who is not in Lobby.`);
      const c = st.config;
      const page = typeof c.spaceSlug === "string" && typeof c.pageSlug === "string" ? `${c.spaceSlug}/${c.pageSlug}` : null;
      if (page && !pages.has(page)) errors.push(`${where} links page "${page}", which does not exist.`);
      if (typeof c.appSlug === "string" && !apps.has(c.appSlug)) errors.push(`${where} links app "${c.appSlug}", which does not exist.`);
      if (typeof c.requestTypeSlug === "string" && !rts.has(c.requestTypeSlug)) errors.push(`${where} uses request type "${c.requestTypeSlug}", which does not exist.`);
      if (typeof c.person === "string" && !users.has(c.person.toLowerCase())) errors.push(`${where} names ${c.person}, who is not in Lobby.`);
    });
  }
  return errors;
}

/** Writes the document. Call only after planImport reported no errors. Runs in one transaction. */
export async function writeDoc(doc: ConfigDoc, sectionsToWrite: Set<string>) {
  await db.transaction(async (tx) => {
    if (doc.org && sectionsToWrite.has("org")) {
      const o = doc.org;
      await tx
        .update(s.orgSettings)
        .set({
          companyName: o.companyName,
          productName: o.productName,
          accentColor: o.accentColor.toUpperCase(),
          timezone: o.timezone,
          workingDays: o.workingDays,
          emailDomain: o.emailDomain,
          logoUrl: o.logoUrl,
        })
        .where(eq(s.orgSettings.id, 1));
    }
    if (doc.groups && sectionsToWrite.has("groups")) {
      for (const g of doc.groups) {
        await tx
          .insert(s.groups)
          .values({ name: g.name, displayName: g.displayName, source: "local" })
          .onConflictDoUpdate({ target: s.groups.name, set: { displayName: g.displayName } });
      }
    }
    if (doc.roleMappings && sectionsToWrite.has("roleMappings")) {
      await tx.delete(s.roleMappings);
      if (doc.roleMappings.length)
        await tx.insert(s.roleMappings).values(doc.roleMappings.map((m) => ({ groupName: m.group, role: m.role }))).onConflictDoNothing();
    }

    // Lookups are re-read inside the transaction so groups created above resolve.
    const l = await lookupsTx(tx);
    const gid = invert(l.groupName);
    const uid = invert(l.userEmail);
    const groupIds = (ns: string[]) => ns.map((n) => gid.get(n)).filter((x): x is string => !!x);

    if (doc.apps && sectionsToWrite.has("apps")) {
      for (const a of doc.apps) {
        const values = {
          slug: a.slug, name: a.name, description: a.description, category: a.category, icon: a.icon, color: a.color,
          launchUrl: a.launchUrl, launchType: a.launchType, presetKey: a.presetKey,
          ownerId: a.owner ? (uid.get(a.owner.toLowerCase()) ?? null) : null,
          requestAccessEnabled: a.requestAccessEnabled, sortOrder: a.sortOrder,
        };
        const [row] = await tx.insert(s.apps).values(values).onConflictDoUpdate({ target: s.apps.slug, set: values }).returning({ id: s.apps.id });
        const vis = groupIds(a.visibleTo);
        await tx.delete(s.appVisibility).where(vis.length ? and(eq(s.appVisibility.appId, row!.id), notInArray(s.appVisibility.groupId, vis)) : eq(s.appVisibility.appId, row!.id));
        if (vis.length) await tx.insert(s.appVisibility).values(vis.map((groupId) => ({ appId: row!.id, groupId }))).onConflictDoNothing();
      }
    }
    if (doc.knowledgeSpaces && sectionsToWrite.has("knowledgeSpaces")) {
      for (const sp of doc.knowledgeSpaces) {
        const values = {
          slug: sp.slug, name: sp.name, description: sp.description, icon: sp.icon, sortOrder: sp.sortOrder,
          editorGroupIds: groupIds(sp.editors), visibilityGroupIds: groupIds(sp.visibleTo),
        };
        await tx.insert(s.spaces).values(values).onConflictDoUpdate({ target: s.spaces.slug, set: values });
      }
    }
    const h = doc.helpdesk;
    if (h?.calendars && sectionsToWrite.has("calendars")) {
      for (const c of h.calendars) {
        const values = { name: c.name, timezone: c.timezone, workDays: c.workDays, startMinute: toMinutes(c.start), endMinute: toMinutes(c.end), holidays: c.holidays };
        const existing = await tx.select({ id: s.businessCalendars.id }).from(s.businessCalendars).where(eq(s.businessCalendars.name, c.name)).limit(1);
        if (existing[0]) await tx.update(s.businessCalendars).set(values).where(eq(s.businessCalendars.id, existing[0].id));
        else await tx.insert(s.businessCalendars).values(values);
      }
    }
    if (h?.slaPolicies && sectionsToWrite.has("slaPolicies")) {
      for (const p of h.slaPolicies) {
        const existing = await tx.select({ id: s.slaPolicies.id }).from(s.slaPolicies).where(eq(s.slaPolicies.name, p.name)).limit(1);
        if (existing[0]) await tx.update(s.slaPolicies).set({ targets: p.targets }).where(eq(s.slaPolicies.id, existing[0].id));
        else await tx.insert(s.slaPolicies).values({ name: p.name, targets: p.targets });
      }
    }
    const l2 = await lookupsTx(tx);
    const calId = invert(l2.calendarName);
    const slaId = invert(l2.slaName);
    if (h?.teams && sectionsToWrite.has("teams")) {
      for (const t of h.teams) {
        const values = {
          slug: t.slug, name: t.name, description: t.description, icon: t.icon,
          agentGroupId: t.agentGroup ? (gid.get(t.agentGroup) ?? null) : null,
          calendarId: t.calendar ? (calId.get(t.calendar) ?? null) : null,
          roundRobin: t.roundRobin, sortOrder: t.sortOrder,
        };
        await tx.insert(s.teams).values(values).onConflictDoUpdate({ target: s.teams.slug, set: values });
      }
    }
    const teamId = invert((await lookupsTx(tx)).teamSlug);
    if (h?.requestTypes && sectionsToWrite.has("requestTypes")) {
      for (const r of h.requestTypes) {
        const approval: ApprovalRule = { mode: r.approval.mode };
        if (r.approval.group) approval.groupId = gid.get(r.approval.group);
        const values = {
          slug: r.slug, teamId: teamId.get(r.team)!, name: r.name, description: r.description, icon: r.icon, fields: r.fields,
          approval, slaPolicyId: r.slaPolicy ? (slaId.get(r.slaPolicy) ?? null) : null,
          defaultPriority: r.defaultPriority, active: r.active, sortOrder: r.sortOrder,
        };
        await tx.insert(s.requestTypes).values(values).onConflictDoUpdate({ target: s.requestTypes.slug, set: values });
      }
    }
    if (doc.journeys && sectionsToWrite.has("journeys")) {
      const l3 = await lookupsTx(tx);
      const personIds = invert(l3.userEmail);
      for (const j of doc.journeys) {
        const conditions: JourneyConditions = {};
        if (j.conditions.departments) conditions.departments = j.conditions.departments;
        if (j.conditions.locations) conditions.locations = j.conditions.locations;
        if (j.conditions.groups) conditions.groupIds = groupIds(j.conditions.groups);
        const values = { name: j.name, description: j.description, kind: j.kind, active: j.active, conditions };
        const existing = await tx.select({ id: s.journeys.id }).from(s.journeys).where(eq(s.journeys.name, j.name)).limit(1);
        let journeyId: string;
        if (existing[0]) {
          journeyId = existing[0].id;
          await tx.update(s.journeys).set(values).where(eq(s.journeys.id, journeyId));
        } else {
          const [row] = await tx.insert(s.journeys).values(values).returning({ id: s.journeys.id });
          journeyId = row!.id;
        }
        // Steps are matched by order so runs already in progress keep their step history.
        const current = await tx
          .select({ id: s.journeySteps.id, position: s.journeySteps.position })
          .from(s.journeySteps)
          .where(and(eq(s.journeySteps.journeyId, journeyId), isNull(s.journeySteps.archivedAt)));
        current.sort((a, b) => a.position - b.position);
        for (const [i, st] of j.steps.entries()) {
          const config: Record<string, unknown> = {};
          for (const [k, v] of Object.entries(st.config)) {
            if (k === STEP_REFS.personId && typeof v === "string") config.personId = personIds.get(v.toLowerCase()) ?? v;
            else config[k] = v;
          }
          const stepValues = {
            journeyId, position: i, title: st.title, description: st.description, type: st.type, dayOffset: st.dayOffset,
            assignee: st.assignee, assigneeUserId: st.assigneeEmail ? (uid.get(st.assigneeEmail.toLowerCase()) ?? null) : null,
            config: config as JourneyStepConfig,
          };
          const id = current[i]?.id;
          if (id) await tx.update(s.journeySteps).set(stepValues).where(eq(s.journeySteps.id, id));
          else await tx.insert(s.journeySteps).values(stepValues);
        }
        const extra = current.slice(j.steps.length).map((c) => c.id);
        // Removed steps are archived, not deleted, so runs in progress keep their history.
        if (extra.length) await tx.update(s.journeySteps).set({ archivedAt: new Date() }).where(inArray(s.journeySteps.id, extra));
      }
    }
  });
}

async function lookupsTx(tx: Tx): Promise<Lookups> {
  const [groups, users, calendars, slas, teams, apps, rts, pages, spaces] = await Promise.all([
    tx.select({ id: s.groups.id, k: s.groups.name }).from(s.groups),
    tx.select({ id: s.users.id, k: s.users.email }).from(s.users),
    tx.select({ id: s.businessCalendars.id, k: s.businessCalendars.name }).from(s.businessCalendars),
    tx.select({ id: s.slaPolicies.id, k: s.slaPolicies.name }).from(s.slaPolicies),
    tx.select({ id: s.teams.id, k: s.teams.slug }).from(s.teams),
    tx.select({ id: s.apps.id, k: s.apps.slug }).from(s.apps),
    tx.select({ id: s.requestTypes.id, k: s.requestTypes.slug }).from(s.requestTypes),
    tx.select({ id: s.pages.id, slug: s.pages.slug, spaceId: s.pages.spaceId }).from(s.pages),
    tx.select({ id: s.spaces.id, slug: s.spaces.slug }).from(s.spaces),
  ]);
  const m = (rows: { id: string; k: string }[]) => new Map(rows.map((r) => [r.id, r.k]));
  const spaceSlug = new Map(spaces.map((sp) => [sp.id, sp.slug]));
  return {
    groupName: m(groups), userEmail: m(users), calendarName: m(calendars), slaName: m(slas), teamSlug: m(teams),
    appSlug: m(apps), requestTypeSlug: m(rts), pageRef: new Map(pages.map((p) => [p.id, `${spaceSlug.get(p.spaceId)}/${p.slug}`])),
  };
}
