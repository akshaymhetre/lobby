import Link from "next/link";
import { ArrowRight, Check, CircleCheck, ListChecks, ScrollText } from "lucide-react";
import { db, sql } from "@lobby/db";
import { getOrgSettings, SETUP_STEPS } from "@lobby/core";
import { adminHealth, recentAuditEvents } from "@lobby/core/admin";
import { Page } from "@/components/page";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { MastheadLink } from "@/components/ui/masthead";
import { CategoryBlock, CategoryChip } from "@/components/ui/category-block";
import { CellList, CellMeta, RowCell } from "@/components/ui/cells";
import { Section } from "@/components/ui/section";
import { STEPS } from "@/components/setup/steps";
import { describeAudit } from "@/components/admin/audit-labels";
import { type HealthTile } from "@/components/admin/health-tiles";
import { SystemMap, type HourBucket, type MapNode } from "@/components/admin/system-map";
import { Avatar } from "@/components/ui/avatar";
import { timeAgo } from "@/lib/time";
import { requireAdmin } from "@/server/auth";

export const metadata = { title: "Admin" };

export default async function AdminOverview() {
  await requireAdmin();
  const [org, health, events, buckets] = await Promise.all([getOrgSettings(), adminHealth(), recentAuditEvents(40), jobsByHour()]);
  const done = SETUP_STEPS.filter((k) => org.setupSteps[k]?.status === "done").length;
  const settled = SETUP_STEPS.filter((k) => org.setupSteps[k]).length;

  const tiles: HealthTile[] = [
    {
      label: "Single sign-on",
      value: health.identity.configured ? providerName(health.identity.provider) : "Not connected",
      detail: health.identity.testedAt ? `Tested ${timeAgo(health.identity.testedAt)}` : health.identity.configured ? "Never tested" : "Employees cannot sign in yet",
      tone: health.identity.testedAt ? "success" : health.identity.configured ? "warning" : "danger",
      status: health.identity.testedAt ? "Working" : health.identity.configured ? "Untested" : "Missing",
      href: "/admin/identity",
      attention: health.identity.testedAt ? undefined : health.identity.configured ? "single sign-on is untested" : "single sign-on is not connected",
    },
    {
      label: "Provisioning",
      value: health.scim.activeTokens ? health.scim.activeTokens : "Sign-in only",
      unit: health.scim.activeTokens ? (health.scim.activeTokens === 1 ? "SCIM token" : "SCIM tokens") : undefined,
      detail: health.scim.lastUsedAt ? `Last sync ${timeAgo(health.scim.lastUsedAt)}` : health.scim.activeTokens ? "Not used yet" : "Accounts appear at first sign-in",
      tone: health.scim.lastUsedAt ? "success" : "neutral",
      status: health.scim.lastUsedAt ? "Syncing" : health.scim.activeTokens ? "Waiting" : "Off",
      href: "/admin/identity#provisioning",
    },
    {
      label: "People",
      value: health.accounts.accounts,
      unit: health.accounts.accounts === 1 ? "account" : "accounts",
      detail: `${health.accounts.people} ${health.accounts.people === 1 ? "person" : "people"} and ${health.accounts.admin} admin ${health.accounts.admin === 1 ? "account" : "accounts"}`,
      tone: health.people > 1 ? "success" : "neutral",
      status: health.people > 1 ? "Active" : "Just you",
      href: "/admin/people",
    },
    {
      label: "Apps",
      value: health.apps === null ? "Not installed" : health.apps,
      unit: health.apps === null ? undefined : health.apps === 1 ? "app" : "apps",
      detail: "In the launcher",
      tone: health.apps ? "success" : "neutral",
      status: health.apps ? "Live" : "Empty",
      href: "/admin/apps",
    },
    {
      label: "AI assistant",
      value: health.ai.enabled ? modelName(health.ai.model) : "Off",
      detail: health.ai.keyConfigured ? "API key configured" : "No API key",
      tone: health.ai.enabled && health.ai.keyConfigured ? "success" : health.ai.enabled ? "danger" : "neutral",
      status: health.ai.enabled ? (health.ai.keyConfigured ? "On" : "No key") : "Off",
      href: "/admin/ai",
      attention: health.ai.enabled && !health.ai.keyConfigured ? "the assistant has no API key" : undefined,
    },
    {
      label: "Worker",
      value: !health.queue.available ? "No worker yet" : health.queue.status === "down" ? health.queue.stuck : health.queue.completed24h,
      unit: !health.queue.available ? undefined : health.queue.status === "down" ? "stuck" : "done today",
      detail: !health.queue.available
        ? "Start the worker to send email and run schedules"
        : health.queue.status === "down"
          ? `Oldest has waited ${health.queue.oldestWaitingMinutes} min. Is the worker running?`
          : health.queue.failed24h
            ? `${health.queue.failed24h} failed in the last 24 hours`
            : `${health.queue.waiting} waiting, ${health.queue.active} running`,
      tone: { healthy: "success", degraded: "warning", down: "danger", unknown: "neutral" }[health.queue.status] as HealthTile["tone"],
      status: { healthy: "Healthy", degraded: "Some failures", down: "Not running", unknown: "Unknown" }[health.queue.status],
      href: "/admin/audit",
      attention: health.queue.status === "down" ? "the worker is not running" : health.queue.status === "degraded" ? "some jobs failed" : undefined,
    },
  ];

  const ICON: MapNode["key"][] = ["sso", "scim", "people", "apps", "ai", "worker"];
  const FIX: Record<string, string> = { "Single sign-on": "Connect sign-on", "AI assistant": "Add the API key", Worker: "See the jobs" };
  const nodes: MapNode[] = tiles.map((t, i) => ({
    ...t,
    key: ICON[i]!,
    tone: (["success", "warning", "danger"].includes(t.tone) ? t.tone : "neutral") as MapNode["tone"],
    fix: FIX[t.label],
  }));
  const needs = tiles.filter((r) => r.attention);
  const changes = collapse(events).slice(0, 8);

  return (
    <Page
      width="wide"
      title="Admin"
      today={
        <>
          {health.people.toLocaleString("en-GB")} people and {health.apps ?? 0} apps in the catalogue on {org.productName}.{" "}
          {needs.length ? (
            <>
              Needs you:{" "}
              {needs.map((r, i) => (
                <span key={r.label}>
                  <MastheadLink href={r.href}>{r.attention}</MastheadLink>
                  {i < needs.length - 1 ? ", " : "."}
                </span>
              ))}
            </>
          ) : settled < SETUP_STEPS.length ? (
            <>
              <MastheadLink href="/setup">Finish setup</MastheadLink>, {SETUP_STEPS.length - settled} {SETUP_STEPS.length - settled === 1 ? "step" : "steps"} left.
            </>
          ) : (
            "Everything is working."
          )}
        </>
      }
    >
      <div className="section-stack">
      <SystemMap
        nodes={nodes}
        hours={hourly(buckets, org.timezone)}
        completed24h={health.queue.completed24h}
        failed24h={health.queue.failed24h}
        productName={org.productName}
        companyName={org.companyName}
        logoUrl={org.logoUrl ?? null}
      />
      <div className="grid gap-10 xl:grid-cols-[minmax(0,1fr)_340px] xl:gap-12">
        <Section
          title="Recent changes"
          description="Without sign-ins. Repeats by one person in an hour fold into one row; the log keeps every entry."
          action={
            <Button asChild variant="secondary" size="sm">
              <Link href="/admin/audit">
                Full audit log
                <ArrowRight aria-hidden />
              </Link>
            </Button>
          }
          className="min-w-0"
        >
          {changes.length ? (
            <CellList density="compact">
              {changes.map((e) => (
                <RowCell
                  key={e.key}
                  leading={<Avatar name={e.actor} seed={e.actorEmail ?? e.actor} size="md" />}
                  title={e.label}
                  meta={
                    <CellMeta
                      items={[
                        <span key="a" className="text-fg">{e.actor}</span>,
                        <time key="t" className="tabular" dateTime={e.latest.toISOString()}>
                          {timeAgo(e.latest)}
                        </time>,
                        e.count > 1 ? <span key="n">{e.count} times in that hour</span> : null,
                      ]}
                    />
                  }
                />
              ))}
            </CellList>
          ) : (
            <EmptyState compact icon={<ScrollText />} title="No admin changes yet" description="Every change to settings, roles and content shows up here." />
          )}
        </Section>

        {/* Setup as one state block: green when every step is done, amber while some wait. Each step is a chip that reopens it. */}
        <Section title="Setup" className="self-start">
          <CategoryBlock
            size="lg"
            tone={done === SETUP_STEPS.length ? "green" : "amber"}
            icon={done === SETUP_STEPS.length ? <CircleCheck /> : <ListChecks />}
            title={done === SETUP_STEPS.length ? "Every step is done" : `${done} of ${SETUP_STEPS.length} steps done`}
            subtitle={done === SETUP_STEPS.length ? "Open any step to change it." : "Skipped steps wait here until you come back to them."}
            status={{ label: `${done} of ${SETUP_STEPS.length}`, dot: true }}
          >
            <span className="flex flex-wrap gap-1.5">
              {STEPS.map((s) => {
                const st = org.setupSteps[s.key]?.status;
                return (
                  <CategoryChip key={s.key} tone={done === SETUP_STEPS.length ? "green" : "amber"} href={`/setup/${s.key}`}>
                    {st === "done" ? <Check className="mr-1 size-3.5 stroke-[2.5]" aria-hidden /> : null}
                    {s.label}
                    {st === "skipped" ? <span className="ml-1 opacity-80">(skipped)</span> : st !== "done" ? <span className="ml-1 opacity-80">(not started)</span> : null}
                  </CategoryChip>
                );
              })}
            </span>
          </CategoryBlock>
        </Section>
      </div>
      </div>
    </Page>
  );
}

type AuditEvent = Awaited<ReturnType<typeof recentAuditEvents>>[number];

/** One row per actor, action and hour: "Maya Chen · Helpdesk: ticket created · 6 times" instead of six identical rows (audit G6). */
function collapse(events: AuditEvent[]) {
  const out = new Map<string, { key: string; actor: string; actorEmail: string | null; label: string; count: number; latest: Date }>();
  for (const e of events) {
    const hour = Math.floor(e.createdAt.getTime() / 3_600_000);
    const actor = e.actorName ?? "System";
    const label = describeAudit(e.action, e.data);
    const key = `${actor}|${e.action}|${hour}`;
    const cur = out.get(key);
    if (cur) {
      cur.count += 1;
      if (e.createdAt > cur.latest) cur.latest = e.createdAt;
    } else out.set(key, { key, actor, actorEmail: e.actorEmail ?? null, label, count: 1, latest: e.createdAt });
  }
  return [...out.values()].sort((a, b) => b.latest.getTime() - a.latest.getTime());
}

function modelName(m: string | null) {
  return { "claude-opus-5-5": "Claude Opus 5.5", "claude-sonnet-5-5": "Claude Sonnet 5.5", "claude-haiku-5-5": "Claude Haiku 5.5" }[m ?? ""] ?? m ?? "On";
}

function providerName(p: string | null) {
  return { okta: "Okta", entra: "Microsoft Entra ID", google: "Google Workspace", keycloak: "Keycloak", authentik: "Authentik", oidc: "OpenID Connect" }[p ?? ""] ?? "Connected";
}

/** Background jobs that finished in each of the last 24 hours, from pg-boss's own table. */
async function jobsByHour(): Promise<{ h: Date; done: number; failed: number }[]> {
  try {
    const rows = await db.execute<{ h: Date | string; done: number; failed: number }>(sql`
      select date_trunc('hour', completed_on) as h,
        count(*) filter (where state = 'completed')::int as done,
        count(*) filter (where state = 'failed')::int as failed
      from pgboss.job
      where completed_on > now() - interval '24 hours' and state in ('completed', 'failed')
      group by 1`);
    return rows.map((r) => ({ h: new Date(r.h), done: r.done, failed: r.failed }));
  } catch {
    return [];
  }
}

/** Twenty-four buckets ending with the current hour, labelled in the company's timezone. */
function hourly(rows: { h: Date; done: number; failed: number }[], tz: string): HourBucket[] {
  const fmt = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: tz || "UTC" });
  const byHour = new Map(rows.map((r) => [Math.floor(r.h.getTime() / 3_600_000), r]));
  const nowH = Math.floor(Date.now() / 3_600_000);
  return Array.from({ length: 24 }, (_, k) => {
    const hk = nowH - 23 + k;
    const r = byHour.get(hk);
    return { label: fmt.format(new Date(hk * 3_600_000)), done: r?.done ?? 0, failed: r?.failed ?? 0, now: k === 23 };
  });
}
