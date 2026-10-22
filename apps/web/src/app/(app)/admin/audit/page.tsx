import Link from "next/link";
import { ChevronLeft, ChevronRight, ScrollText, SearchX } from "lucide-react";
import { auditFacets, auditWhere, listAuditEvents } from "@lobby/core/admin";
import { and, db, gte, s as schema, sql } from "@lobby/db";
import { AuditPulse, type PulseBucket, type PulseKind } from "@/components/admin/audit-pulse";
import { Page } from "@/components/page";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Table, TBody, TD, TH, THead, TRow } from "@/components/ui/table";
import { AuditDetails } from "@/components/admin/audit-details";
import { AuditFilters } from "@/components/admin/audit-filters";
import { CountUp } from "@/components/ui/motion";
import { Disclosure } from "@/components/ui/disclosure";
import { describeAudit } from "@/components/admin/audit-labels";
import { formatDateTime, timeAgo } from "@/lib/time";
import { requireAdmin } from "@/server/auth";

export const metadata = { title: "Audit log" };

type Params = { action?: string; actor?: string; from?: string; to?: string; page?: string };

export default async function AuditPage({ searchParams }: { searchParams: Promise<Params> }) {
  await requireAdmin();
  const p = await searchParams;
  const [result, facets, pulse] = await Promise.all([
    listAuditEvents({ action: p.action, actorId: p.actor, from: p.from, to: p.to, page: Number(p.page) || 1, pageSize: 25 }),
    auditFacets(),
    pulseBuckets({ action: p.action, actorId: p.actor }),
  ]);
  const filtered = !!(p.action || p.actor || p.from || p.to);
  const future = !!p.from && new Date(p.from).getTime() > Date.now();
  const href = (page: number) => {
    const q = new URLSearchParams();
    for (const k of ["action", "actor", "from", "to"] as const) if (p[k]) q.set(k, p[k]!);
    if (page > 1) q.set("page", String(page));
    const s = q.toString();
    return s ? `/admin/audit?${s}` : "/admin/audit";
  };
  const first = (result.page - 1) * result.pageSize + 1;
  const last = Math.min(result.total, result.page * result.pageSize);
  const n = (x: number) => x.toLocaleString("en-GB");

  return (
    <Page width="wide">
      <PageHeader
        title="Audit log"
        description={
          <>
            Every admin change, sign-in and AI action, newest first.{" "}
            <CountUp value={result.total} duration={0.9} className="font-medium text-fg" /> {result.total === 1 ? "entry" : "entries"}
            {filtered ? " match" : ""}. Nothing here can be edited or deleted.
          </>
        }
      />
      <div className="section-content">
        <AuditPulse buckets={pulse.buckets} totals={pulse.totals} />
        <AuditFilters
          values={{ action: p.action ?? "", actor: p.actor ?? "", from: p.from ?? "", to: p.to ?? "" }}
          actions={facets.actions.map((a) => ({ value: a.action, label: describeAudit(a.action), count: Number(a.n) }))}
          actors={facets.actors.map((a) => ({ value: a.id, label: a.name, hint: a.email }))}
        />
        {result.rows.length ? (
          <>
            {/* Phone: its own composition, a timeline grouped by day with sticky day headers. Each entry is a
                raised cell; the raw action key and the details fold away. */}
            <div className="flex flex-col gap-5 sm:hidden">
              {byDay(result.rows).map(([day, rows]) => (
                <section key={day} aria-label={day} className="flex flex-col gap-2.5">
                  <h3 className="sticky top-0 z-[1] -mx-1 flex items-center justify-between rounded-full bg-page/90 px-3 py-2 text-row font-medium text-fg backdrop-blur">
                    {day}
                    <span className="tabular text-caption font-normal text-muted">
                      {rows.length} {rows.length === 1 ? "entry" : "entries"}
                    </span>
                  </h3>
                  <ol className="flex flex-col gap-2">
                    {rows.map((r) => (
                      <li key={r.id} className="cell flex flex-col gap-1.5 rounded-card px-4 py-3">
                        <span className="flex items-start gap-3">
                          {r.actorName ? <Avatar name={r.actorName} seed={r.actorId} size="sm" /> : null}
                          <span className="flex min-w-0 flex-1 flex-col">
                            <span className="text-row font-medium text-fg">{describeAudit(r.action, r.data)}</span>
                            <span className="text-caption text-muted">
                              {r.actorName ?? "System"},{" "}
                              <time dateTime={r.createdAt.toISOString()}>{timeOfDay(r.createdAt)}</time>
                            </span>
                          </span>
                        </span>
                        {r.data && Object.keys(r.data).length ? (
                          <Disclosure variant="inline" title="Details" contentClassName="pt-1">
                            <AuditDetails data={r.data} targetType={r.targetType} targetId={r.targetId} open />
                          </Disclosure>
                        ) : null}
                      </li>
                    ))}
                  </ol>
                </section>
              ))}
            </div>
            <Table wrapperClassName="hidden sm:block">
              <THead>
                <tr>
                  <TH className="w-[150px]">When</TH>
                  <TH>Who</TH>
                  <TH>What</TH>
                  <TH className="hidden w-[360px] lg:table-cell">Details</TH>
                </tr>
              </THead>
              <TBody>
                {result.rows.map((r) => (
                  <TRow key={r.id}>
                    <TD className="whitespace-nowrap align-top">
                      <time dateTime={r.createdAt.toISOString()} title={r.createdAt.toISOString()} className="flex flex-col">
                        <span className="tabular text-fg">{formatDateTime(r.createdAt)}</span>
                        <span className="text-small text-subtle">{timeAgo(r.createdAt)}</span>
                      </time>
                    </TD>
                    <TD className="align-top">
                      {r.actorName ? (
                        <span className="flex min-w-0 items-center gap-2">
                          <Avatar name={r.actorName} seed={r.actorId} size="sm" />
                          <span className="flex min-w-0 flex-col">
                            <span className="truncate text-fg">{r.actorName}</span>
                            <span className="hidden truncate text-small text-subtle sm:block">{r.actorEmail}</span>
                          </span>
                        </span>
                      ) : (
                        <span className="text-muted">System</span>
                      )}
                    </TD>
                    <TD className="align-top">
                      <span className="flex min-w-0 flex-col">
                        <span className="text-fg">{describeAudit(r.action, r.data)}</span>
                        <code className="font-mono text-caption text-subtle">{r.action}</code>
                      </span>
                    </TD>
                    <TD className="hidden min-w-0 align-top lg:table-cell">
                      <AuditDetails data={r.data} targetType={r.targetType} targetId={r.targetId} />
                    </TD>
                  </TRow>
                ))}
              </TBody>
            </Table>
            <nav aria-label="Pages" className="flex flex-wrap items-center justify-between gap-3">
              <p className="tabular text-small text-muted">
                {n(first)} to {n(last)} of {n(result.total)}
              </p>
              <div className="flex items-center gap-2">
                {result.page > 1 ? (
                  <Button asChild variant="secondary" size="sm">
                    <Link href={href(result.page - 1)} rel="prev">
                      <ChevronLeft aria-hidden />
                      Newer
                    </Link>
                  </Button>
                ) : (
                  <Button variant="secondary" size="sm" disabled>
                    <ChevronLeft aria-hidden />
                    Newer
                  </Button>
                )}
                <span className="tabular text-small text-muted">
                  Page {result.page} of {result.pages}
                </span>
                {result.page < result.pages ? (
                  <Button asChild variant="secondary" size="sm">
                    <Link href={href(result.page + 1)} rel="next">
                      Older
                      <ChevronRight aria-hidden />
                    </Link>
                  </Button>
                ) : (
                  <Button variant="secondary" size="sm" disabled>
                    Older
                    <ChevronRight aria-hidden />
                  </Button>
                )}
              </div>
            </nav>
          </>
        ) : filtered ? (
          <EmptyState
            variant="filtered"
            icon={<SearchX />}
            title={future ? "That start date has not happened yet" : "Nothing matches these filters"}
            description={future ? `The log runs up to now, and ${p.from} is in the future. Pick an earlier start date.` : "Widen the date range or clear a filter."}
            action={
              <Button asChild variant="secondary">
                <Link href="/admin/audit">Clear filters</Link>
              </Button>
            }
          />
        ) : (
          <EmptyState icon={<ScrollText />} title="Nothing recorded yet" description="Sign-ins, admin changes and AI actions appear here as they happen." />
        )}
      </div>
    </Page>
  );
}

type AuditRow = Awaited<ReturnType<typeof listAuditEvents>>["rows"][number];
const dayFmt = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long" });
const timeFmt = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit" });
const timeOfDay = (d: Date) => timeFmt.format(d);

/** Rows grouped by calendar day, newest first, labelled "Today", "Yesterday" or the date. */
function byDay(rows: AuditRow[]): [string, AuditRow[]][] {
  const label = (d: Date) => {
    const days = Math.round((new Date().setHours(0, 0, 0, 0) - new Date(d).setHours(0, 0, 0, 0)) / 86_400_000);
    return days === 0 ? "Today" : days === 1 ? "Yesterday" : dayFmt.format(d);
  };
  const out = new Map<string, AuditRow[]>();
  for (const r of rows) out.set(label(r.createdAt), [...(out.get(label(r.createdAt)) ?? []), r]);
  return [...out.entries()];
}

const ADMIN = /^(config|identity|branding|scim|group|groups|role|roles|setup|ai|app|apps|people|home|journeys|knowledge)\b/;
const kindOf = (action: string): PulseKind => (action.startsWith("auth.") ? "auth" : action.startsWith("helpdesk.") ? "helpdesk" : ADMIN.test(action) ? "admin" : "other");

/** Hourly counts for the last 48 hours, by kind, honouring the action and person filters. */
async function pulseBuckets(f: { action?: string; actorId?: string }) {
  const since = new Date(Math.floor(Date.now() / 3_600_000) * 3_600_000 - 47 * 3_600_000);
  const where = and(gte(schema.auditLog.createdAt, since), auditWhere(f));
  const rows = await db
    .select({ h: sql<string>`date_trunc('hour', ${schema.auditLog.createdAt})`, action: schema.auditLog.action, n: sql<number>`count(*)::int` })
    .from(schema.auditLog)
    .where(where)
    .groupBy(sql`1`, schema.auditLog.action);
  const zero = (): Record<PulseKind, number> => ({ admin: 0, auth: 0, helpdesk: 0, other: 0 });
  const by = new Map<number, Record<PulseKind, number>>();
  const totals = zero();
  for (const r of rows) {
    const k = Math.floor(new Date(r.h).getTime() / 3_600_000);
    const c = by.get(k) ?? zero();
    const kind = kindOf(r.action);
    c[kind] += r.n;
    totals[kind] += r.n;
    by.set(k, c);
  }
  const start = Math.floor(since.getTime() / 3_600_000);
  const fmt = new Intl.DateTimeFormat("en-GB", { weekday: "short", hour: "2-digit", minute: "2-digit", timeZone: "UTC" });
  const dayFmt = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", timeZone: "UTC" });
  const buckets: PulseBucket[] = Array.from({ length: 48 }, (_, i) => {
    const d = new Date((start + i) * 3_600_000);
    return { label: fmt.format(d), counts: by.get(start + i) ?? zero(), now: i === 47, day: d.getUTCHours() === 0 ? dayFmt.format(d) : undefined };
  });
  return { buckets, totals };
}
