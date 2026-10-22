import { notFound, redirect } from "next/navigation";
import { getPersonRunViews, getRunView, listColleagues } from "@lobby/core/journeys";
import { formatDay, runTimingLabel } from "@lobby/core/journeys/dates";
import { Page } from "@/components/page";
import { Badge } from "@/components/ui/badge";
import { HeroLight } from "@/components/ui/hero-light";
import { Breadcrumb, PageHeader } from "@/components/ui/page-header";
import { TasksPill } from "@/components/journeys/tasks-pill";
import { appIconsFor } from "@/components/journeys/app-icons";
import { AvatarRing } from "@/components/journeys/avatar-ring";
import { PendingPersonCell, PersonCell } from "@/components/journeys/person-cell";
import { PhaseTrack } from "@/components/journeys/phase-track";
import { RunMatrix } from "@/components/journeys/run-matrix";
import { buildTrack } from "@/components/journeys/track";
import { AssignBuddyButton } from "@/components/journeys/buddy-picker";
import { CancelRunButton } from "@/components/journeys/cancel-run-button";
import { Timeline } from "@/components/journeys/timeline";
import { requireUser } from "@/server/auth";

export async function generateMetadata({ params }: { params: Promise<{ runId: string }> }) {
  const ctx = await requireUser();
  const view = await getRunView(ctx, (await params).runId);
  return { title: view ? `${view.subject.name} · ${view.journey.name}` : "Journey" };
}

const STATUS = {
  active: { tone: "accent", label: "In progress" },
  completed: { tone: "success", label: "Completed" },
  cancelled: { tone: "neutral", label: "Cancelled" },
} as const;

export default async function RunPage({ params }: { params: Promise<{ runId: string }> }) {
  const ctx = await requireUser();
  const { runId } = await params;
  const views = await getPersonRunViews(ctx, runId);
  if (!views) notFound();
  const view = views[0]!;
  const multi = views.length > 1;
  const steps = views
    .flatMap((v) => v.steps.map((s) => ({ ...s, journeyName: v.journey.name })))
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.position - b.position);
  const done = steps.filter((s) => s.status !== "pending").length;
  const overdue = steps.filter((s) => s.overdue).length;
  // The new hire's own steps: the one "their progress" number every screen shows.
  const mine = views.reduce((a, v) => ({ done: a.done + v.progress.newHire.done, total: a.total + v.progress.newHire.total }), { done: 0, total: 0 });
  if (view.viewer.isSubject && view.run.status === "active") {
    // The person themselves gets the navigator.
    redirect("/journeys");
  }
  const colleagues = view.viewer.canAssignBuddy ? await listColleagues() : [];
  const { subject, journey, manager, buddy, today } = view;
  const status = STATUS[view.run.status as keyof typeof STATUS] ?? STATUS.active;
  const anchorLabel = journey.kind === "offboarding" ? "Last day" : "First day";

  return (
    <Page width="wide">
      <PageHeader
        breadcrumb={<Breadcrumb items={[{ label: "Onboarding", href: "/journeys" }, { label: subject.name }]} />}
        title={subject.name}
        description={[subject.title, views.map((v) => v.journey.name).join(" + ")].filter(Boolean).join(" · ")}
        actions={view.viewer.canManage && view.run.status === "active" ? <CancelRunButton runId={view.run.id} subjectName={subject.name} journeyName={journey.name} /> : null}
      />

      {/* The hero: their face in their progress, and the whole journey as one track. */}
      <section aria-labelledby="track-heading" className="panel relative isolate mb-10 grid gap-6 overflow-hidden rounded-panel p-4 sm:p-6 lg:mb-12">
        {/* Red while something is late, violet (onboarding) otherwise. */}
        <HeroLight tone={overdue ? "red" : journey.kind === "offboarding" ? "blue" : "violet"} position="top-left" />
        {/* The portrait runs across the top, so the matrix below gets the card's full width. */}
        <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
          <AvatarRing person={subject} done={mine.done} total={mine.total} size={96} className="max-sm:size-[80px]" />
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-10 gap-y-3">
            <span className="flex flex-wrap items-center gap-1.5">
              <TasksPill done={mine.done} total={mine.total} count />
              <Badge tone={status.tone} dot size="sm">
                {status.label}
              </Badge>
            </span>
            <dl className="grid grid-cols-3 gap-x-8 gap-y-3 text-body">
              <div className="flex flex-col">
                <dt className="text-caption text-muted">{anchorLabel}</dt>
                <dd className="tabular font-medium text-fg">{formatDay(view.run.anchorDate)}</dd>
              </div>
              <div className="flex flex-col">
                <dt className="text-caption text-muted">Timing</dt>
                <dd className="font-medium text-fg">{runTimingLabel(view.run.anchorDate, today, journey.kind)}</dd>
              </div>
              <div className="flex flex-col">
                <dt className="text-caption text-muted">Late, all steps</dt>
                <dd className={overdue ? "tabular font-medium text-danger-text" : "tabular font-medium text-fg"}>{overdue}</dd>
              </div>
            </dl>
          </div>
        </div>
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
            <div className="flex min-w-0 flex-col gap-0.5">
              <h2 id="track-heading" className="text-h2 font-medium text-fg md:text-hero">
                Who does what, when
              </h2>
              <p className="text-body text-muted">
                {done} of {steps.length} steps across everyone{overdue ? `, ${overdue} late` : ""}. {subject.firstName}&apos;s own: {mine.done} of {mine.total}.
              </p>
            </div>
            <ul className="flex flex-wrap items-center gap-x-3 gap-y-1 text-caption text-muted" aria-label="Key">
              <li className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-cat-violet" aria-hidden />
                Onboarding step
              </li>
              {journey.kind === "onboarding" ? (
                <li className="flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-cat-green" aria-hidden />
                  First day
                </li>
              ) : null}
              <li className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-danger" aria-hidden />
                Late
              </li>
            </ul>
          </div>
          <div className="mt-4 hidden md:block">
            <RunMatrix steps={steps} today={today} subject={{ id: subject.id, firstName: subject.firstName }} />
          </div>
          <PhaseTrack track={buildTrack(steps, today)} today={today} label={`${subject.firstName}'s journey, phase by phase`} linkPhases className="md:hidden" />
        </div>
      </section>

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-12">
        <aside className="section-content lg:sticky lg:top-24 lg:order-2 lg:self-start" aria-label="Journey summary">
          <section aria-labelledby="people-heading" className="flex flex-col gap-3">
            <h2 id="people-heading" className="text-small font-medium text-muted">
              Their people
            </h2>
            <ul className="grid grid-cols-2 gap-2">
              {manager ? (
                <PersonCell person={manager} role="Manager" />
              ) : (
                <PendingPersonCell role="Manager" note="No manager set" />
              )}
              {buddy ? (
                <PersonCell
                  person={buddy}
                  role="Buddy"
                  footer={
                    view.viewer.canAssignBuddy ? (
                      <AssignBuddyButton
                        runId={view.run.id}
                        subject={{ id: subject.id, name: subject.name, firstName: subject.firstName, department: subject.department }}
                        currentBuddyId={buddy.id}
                        colleagues={colleagues}
                        variant="secondary"
                      />
                    ) : null
                  }
                />
              ) : (
                <PendingPersonCell
                  role="Buddy"
                  note={view.hasBuddySteps ? "Not chosen yet" : "Not needed for this journey"}
                  footer={
                    view.viewer.canAssignBuddy && view.hasBuddySteps ? (
                      <AssignBuddyButton
                        runId={view.run.id}
                        subject={{ id: subject.id, name: subject.name, firstName: subject.firstName, department: subject.department }}
                        currentBuddyId={null}
                        colleagues={colleagues}
                        label="Pick"
                      />
                    ) : null
                  }
                />
              )}
            </ul>
          </section>
          {!multi && journey.description ? <p className="px-1 text-small text-muted">{journey.description}</p> : null}
        </aside>

        <section aria-label="Every step" className="min-w-0 lg:order-1">
          <Timeline
            steps={steps}
            showJourney={multi}
            today={today}
            mode="detail"
            viewerName={ctx.user.displayName}
            appIcons={appIconsFor(steps.map((s) => s.target))}
            subject={{ id: subject.id, name: subject.name, firstName: subject.firstName, department: subject.department }}
            buddy={view.viewer.canAssignBuddy ? { runId: view.run.id, currentBuddyId: buddy?.id ?? null, colleagues } : null}
          />
        </section>
      </div>
    </Page>
  );
}
