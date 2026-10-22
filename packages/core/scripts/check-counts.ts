/**
 * Cross-screen consistency check against the seeded database:
 *   pnpm --filter @lobby/core check:counts
 *
 * For each canonical count (src/counts.ts) it asserts three things agree:
 *   1. the canonical function,
 *   2. the read models the screens actually render from (directory, Help list, Today, launcher,
 *      knowledge spaces, content health, navigator, team view, all journeys),
 *   3. an INDEPENDENT raw SQL count written from the definition in words, so a definition broken
 *      in one shared place cannot make every screen agree on a wrong number.
 * Exits 1 on any mismatch. Read-only: it writes nothing.
 */
import { pg } from "@lobby/db";
import { loadUserContext, type UserContext } from "../src/identity/context";
import {
  accountCounts,
  appCounts,
  directoryPeopleCount,
  journeyLength,
  newHireProgress,
  openRequestCount,
  pageCounts,
  runProgress,
} from "../src/counts";
import { listDirectory, listPeopleForAdmin } from "../src/people/index";
import { listMyTickets } from "../src/helpdesk/tickets";
import { getToday } from "../src/home/index";
import { listVisibleApps } from "../src/apps/index";
import { contentHealth, listSpaces } from "../src/knowledge/index";
import { allRuns, getPersonRunViews, groupRunsByPerson, myJourneys, teamRuns } from "../src/journeys/views";
import { listJourneys } from "../src/journeys/admin";
import { adminHealth } from "../src/admin/health";

let failures = 0;
let passes = 0;
function same(label: string, values: Record<string, unknown>) {
  const entries = Object.entries(values);
  const first = JSON.stringify(entries[0]![1]);
  const ok = entries.every(([, v]) => JSON.stringify(v) === first);
  if (ok) passes++;
  else failures++;
  const shown = entries.map(([k, v]) => `${k}=${JSON.stringify(v)}`).join("  ");
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}\n      ${shown}`);
}
function check(label: string, ok: boolean, detail: string) {
  if (ok) passes++;
  else failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}\n      ${detail}`);
}

const one = async <T>(q: Promise<T[]>): Promise<T> => (await q)[0]!;
const n = async (text: TemplateStringsArray, ...args: unknown[]) =>
  Number((await one(pg(text, ...(args as never[])) as unknown as Promise<{ n: string }[]>)).n);

async function ctxFor(email: string): Promise<UserContext> {
  const row = await one(pg<{ id: string }[]>`select id from users where email = ${email}`);
  const ctx = row && (await loadUserContext(row.id));
  if (!ctx) throw new Error(`no active user ${email}; is the demo seed loaded?`);
  return ctx;
}

const maya = await ctxFor("maya.chen@northwind.example");
const sam = await ctxFor("sam.okafor@northwind.example");
const admin = await ctxFor("admin@northwind.example");
const samManagerId = (await one(pg<{ manager_id: string }[]>`select manager_id from users where id = ${sam.user.id}`)).manager_id;
const samManager = (await loadUserContext(samManagerId))!;

// ---------------------------------------------------------------- People and accounts
{
  const sqlPeople = await n`select count(*) as n from users where status = 'active' and not is_break_glass`;
  const sqlActiveAccounts = await n`select count(*) as n from users where status = 'active'`;
  const sqlAdminAccounts = await n`select count(*) as n from users where status = 'active' and is_break_glass`;
  const sqlDeactivated = await n`select count(*) as n from users where status <> 'active'`;
  const accounts = (await accountCounts(admin))!;
  same("People = active people minus the admin account", {
    canonical: await directoryPeopleCount(),
    directoryPage: (await listDirectory(maya)).everyone,
    adminOverview: (await adminHealth()).people,
    accountCounts: accounts.people,
    sql: sqlPeople,
    "sql(active - admin)": sqlActiveAccounts - sqlAdminAccounts,
  });
  const adminPeople = await listPeopleForAdmin(admin, { status: "all" });
  same("Accounts = people + admin accounts (admin people page)", {
    canonical: accounts.accounts,
    "people+admin": accounts.people + accounts.admin,
    adminPeoplePage: adminPeople.counts.active,
    sql: sqlActiveAccounts,
  });
  same("Deactivated accounts", { canonical: accounts.deactivated, adminPeoplePage: adminPeople.counts.deactivated, sql: sqlDeactivated });
  check("Account counts are admin-only", (await accountCounts(maya)) === null, "accountCounts(maya) is null");
}

// ---------------------------------------------------------------- Open requests (Maya)
{
  const sqlOpen = await n`select count(*) as n from tickets where requester_id = ${maya.user.id}
    and status not in ('resolved', 'closed', 'rejected')`;
  same("Maya's open requests = her tickets not resolved, closed or rejected", {
    canonical: await openRequestCount(maya),
    homeSentence: (await getToday(maya)).ticketCount,
    helpPage: (await listMyTickets(maya, { open: true, limit: 200 })).length,
    sql: sqlOpen,
  });
}

// ---------------------------------------------------------------- Apps
{
  const sqlTotal = await n`select count(*) as n from apps`;
  const sqlVisibleMaya = await n`select count(*) as n from apps a where not exists (select 1 from app_visibility v where v.app_id = a.id)
    or exists (select 1 from app_visibility v where v.app_id = a.id and v.group_id = any(${maya.groupIds}::uuid[]))`;
  const mayaApps = await appCounts(maya);
  same("Apps visible to Maya", { canonical: mayaApps.visible, launcher: (await listVisibleApps(maya)).length, sql: sqlVisibleMaya });
  same("Apps in the catalogue", { canonical: mayaApps.total, adminCanonical: (await appCounts(admin)).total, adminOverview: (await adminHealth()).apps, sql: sqlTotal });
}

// ---------------------------------------------------------------- Knowledge pages
{
  const sqlPublished = await n`select count(*) as n from pages where status = 'published'`;
  const sqlRestricted = await n`select count(*) as n from pages p join spaces sp on sp.id = p.space_id
    where p.status = 'published' and (cardinality(p.visibility_group_ids) > 0 or cardinality(sp.visibility_group_ids) > 0)`;
  const sqlVisibleMaya = await n`select count(*) as n from pages p join spaces sp on sp.id = p.space_id
    where p.status = 'published'
      and (cardinality(sp.visibility_group_ids) = 0 or sp.visibility_group_ids && ${maya.groupIds}::uuid[])
      and (cardinality(p.visibility_group_ids) = 0 or p.visibility_group_ids && ${maya.groupIds}::uuid[])`;
  const mine = await pageCounts(maya);
  const health = await contentHealth(admin);
  same("Pages Maya can read (published, visible)", {
    canonical: mine.visible,
    spacesSum: (await listSpaces(maya)).reduce((t, sp) => t + sp.pageCount, 0),
    sql: sqlVisibleMaya,
  });
  const adm = await pageCounts(admin);
  same("Published pages (content health)", { canonical: adm.published, contentHealth: health.length, sql: sqlPublished });
  same("Published pages in restricted spaces", { canonical: adm.restricted, contentHealth: health.filter((r) => r.restricted).length, sql: sqlRestricted });
  check("Published and restricted totals are hidden from readers", mine.published === null && mine.restricted === null, JSON.stringify(mine));
}

// ---------------------------------------------------------------- Sam's onboarding progress
{
  const sqlSam = await one(
    pg<{ done: string; total: string }[]>`select count(*) filter (where sr.status <> 'pending') as done, count(*) as total
      from journey_step_runs sr join journey_steps js on js.id = sr.step_id join journey_runs r on r.id = sr.run_id
      where r.subject_user_id = ${sam.user.id} and r.status = 'active' and js.assignee = 'subject'`,
  );
  const sqlSamAll = await one(
    pg<{ done: string; total: string }[]>`select count(*) filter (where sr.status <> 'pending') as done, count(*) as total
      from journey_step_runs sr join journey_runs r on r.id = sr.run_id
      where r.subject_user_id = ${sam.user.id} and r.status = 'active'`,
  );
  const sum = (xs: { done: number; total: number }[]) => xs.reduce((a, b) => ({ done: a.done + b.done, total: a.total + b.total }), { done: 0, total: 0 });
  const tally = (p: { done: number; total: number }) => ({ done: p.done, total: p.total });

  const navigatorRuns = await myJourneys(sam);
  const navigatorOwn = navigatorRuns.flatMap((r) => r.steps.filter((st) => st.forSubject));
  const peopleTeam = groupRunsByPerson((await allRuns(admin))!).find((r) => r.subject.id === sam.user.id)!;
  const teamView = groupRunsByPerson(await teamRuns(samManager)).find((r) => r.subject.id === sam.user.id)!;
  const managerRunPage = (await getPersonRunViews(samManager, navigatorRuns[0]!.run.id))!;

  same("Sam's progress (his own steps), from every entry point", {
    canonical: await newHireProgress(sam, { userId: sam.user.id }),
    asManager: await newHireProgress(samManager, { userId: sam.user.id }),
    asAdmin: await newHireProgress(admin, { userId: sam.user.id }),
    navigatorHero: { done: navigatorOwn.filter((st) => st.status !== "pending").length, total: navigatorOwn.length },
    navigatorRail: sum(navigatorRuns.map((r) => r.progress.newHire)),
    teamView: teamView.progress.newHire,
    allJourneys: peopleTeam.progress.newHire,
    managerRunPage: sum(managerRunPage.map((v) => v.progress.newHire)),
    sql: { done: Number(sqlSam.done), total: Number(sqlSam.total) },
  });
  same("Sam's run progress across everyone (labelled as such)", {
    canonical: await runProgress(sam, { userId: sam.user.id }),
    allJourneys: tally(peopleTeam.progress),
    teamView: tally(teamView.progress),
    managerRunPage: sum(managerRunPage.map((v) => tally(v.progress))),
    sql: { done: Number(sqlSamAll.done), total: Number(sqlSamAll.total) },
  });
  for (const r of navigatorRuns) {
    same(`Sam's ${r.journey.name} run (one journey)`, {
      canonical: await newHireProgress(sam, { runId: r.run.id }),
      navigatorRail: r.progress.newHire,
      lengthForNewHire: { done: r.progress.newHire.done, total: (await journeyLength(r.journey.id)).forNewHire },
    });
  }
  const stranger = await ctxFor("maya.chen@northwind.example");
  if (stranger.user.id !== samManagerId) {
    check("Progress is hidden from people with no reason to see the run", (await newHireProgress(stranger, { userId: sam.user.id })) === null, "newHireProgress(maya, sam) is null");
  }
}

// ---------------------------------------------------------------- Journey length
{
  const rows = await pg<{ id: string; name: string; total: string; subject: string }[]>`select j.id, j.name, count(js.id) as total,
    count(js.id) filter (where js.assignee = 'subject') as subject from journeys j
    left join journey_steps js on js.journey_id = j.id and js.archived_at is null group by j.id, j.name`;
  const list = await listJourneys(admin);
  for (const j of rows) {
    const item = list.find((x) => x.id === j.id)!;
    same(`Journey length: ${j.name}`, {
      canonical: await journeyLength(j.id),
      journeyList: { total: item.stepCount, forNewHire: item.newHireStepCount },
      sql: { total: Number(j.total), forNewHire: Number(j.subject) },
    });
  }
  const drift = await pg<{ name: string; who: string; run_steps: string; tmpl: string }[]>`select j.name, u.display_name as who,
      (select count(*) from journey_step_runs sr where sr.run_id = r.id) as run_steps,
      (select count(*) from journey_steps js where js.journey_id = j.id) as tmpl
    from journey_runs r join journeys j on j.id = r.journey_id join users u on u.id = r.subject_user_id where r.status = 'active'`;
  const off = drift.filter((d) => d.run_steps !== d.tmpl);
  check("Every active run has exactly its journey's steps", off.length === 0, off.length ? JSON.stringify(off) : `${drift.length} runs checked`);
}

// ---------------------------------------------------------------- Seed realism
{
  const recent = await n`select count(*) as n from pages where status = 'published' and updated_at > now() - interval '24 hours'`;
  const days = await n`select count(distinct updated_at::date) as n from pages where status = 'published'`;
  const published = await n`select count(*) as n from pages where status = 'published'`;
  check("At most one published page edited in the last 24 hours", recent <= 1, `${recent} edited in the last 24 hours`);
  check("Page update ages are spread out (distinct days >= 80% of pages)", days >= Math.ceil(published * 0.8), `${days} distinct days across ${published} pages`);
  const staleButFresh = await n`select count(*) as n from pages where status = 'published' and review_by < current_date and updated_at > now() - interval '30 days'`;
  check("No stale page claims a recent edit", staleButFresh === 0, `${staleButFresh} stale pages edited in the last 30 days`);
  const typed = await pg<{ title: string }[]>`select title from announcements where ends_at is not null and body ~* '\\m(january|february|march|april|may|june|july|august|september|october|november|december)\\M'`;
  check("Announcement bodies never type a date (deadline comes from ends_at)", typed.length === 0, typed.length ? typed.map((t) => t.title).join("; ") : "no month names in bodies with a deadline");
}

console.log(`\n${passes} passed, ${failures} failed`);
await pg.end();
process.exit(failures ? 1 : 0);
