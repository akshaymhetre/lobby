import Link from "next/link";
import { Plus } from "lucide-react";
import { asc, db, s } from "@lobby/db";
import { allRuns, getJourneyForEdit, listJourneys } from "@lobby/core/journeys";
import { phaseFor } from "@lobby/core/journeys/dates";
import { Page } from "@/components/page";
import { Button } from "@/components/ui/button";
import { JourneyList, type JourneyShape } from "@/components/journeys/admin/journey-list";
import { requireJourneyManager } from "@/server/auth";

export const metadata = { title: "Journeys · Admin" };

export default async function AdminJourneysPage() {
  const ctx = await requireJourneyManager();
  const [journeys, groups, runs] = await Promise.all([
    listJourneys(ctx),
    db.select({ id: s.groups.id, name: s.groups.displayName }).from(s.groups).orderBy(asc(s.groups.displayName)),
    allRuns(ctx, { status: "active" }),
  ]);
  // Each journey's shape (steps per stage) and the faces of the people on it right now.
  const shapes: Record<string, JourneyShape> = {};
  await Promise.all(
    journeys.map(async (j) => {
      const full = await getJourneyForEdit(ctx, j.id);
      if (!full) return;
      const stages = new Map<string, { key: string; label: string; order: number; count: number }>();
      for (const st of full.steps) {
        const ph = phaseFor(st.dayOffset, j.kind);
        const cur = stages.get(ph.key) ?? { key: ph.key, label: ph.label, order: ph.order, count: 0 };
        cur.count++;
        stages.set(ph.key, cur);
      }
      shapes[j.id] = {
        stages: [...stages.values()].sort((a, b) => a.order - b.order).map(({ key, label, count }) => ({ key, label, count })),
        people: (runs ?? []).filter((r) => r.journeyId === j.id).map((r) => ({ id: r.subject.id, name: r.subject.name, avatarUrl: r.subject.avatarUrl })),
      };
    }),
  );
  const inProgress = runs ? new Set(runs.map((r) => r.subject.id)).size : journeys.reduce((n, j) => n + j.activeRuns, 0);
  const on = journeys.filter((j) => j.active).length;
  const today = journeys.length
    ? `${inProgress} ${inProgress === 1 ? "person is" : "people are"} on a journey right now. ${journeys.length} ${journeys.length === 1 ? "journey" : "journeys"}, ${on === journeys.length ? "all" : on} starting automatically.`
    : undefined;
  return (
    <Page
      width="wide"
      title="Journeys"
      today={today}
      description={today ? undefined : "Onboarding and offboarding plans. A journey that is on starts by itself two weeks before a matching person's first (or last) day."}
      inlineActions
      actions={
        <Button asChild aria-label="New journey" className="px-2.5 sm:px-3.5">
          <Link href="/admin/journeys/new">
            <Plus aria-hidden />
            <span className="hidden sm:inline">New journey</span>
          </Link>
        </Button>
      }
    >
      <JourneyList journeys={journeys} groups={groups} shapes={shapes} />
    </Page>
  );
}
