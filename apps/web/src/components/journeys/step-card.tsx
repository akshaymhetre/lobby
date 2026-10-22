"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  BookOpen,
  Check,
  ExternalLink,
  LifeBuoy,
  MoreHorizontal,
  SkipForward,
  UserRoundPlus,
} from "lucide-react";
import type { StepTarget, TimelineStep } from "@lobby/core/journeys";
import { dueLabel, formatDay } from "@lobby/core/journeys/dates";
import { AppIcon, type AppIconData } from "@/components/apps/app-icon";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import styles from "./timeline.module.css";
import { completeStepAction, reopenStepAction } from "@/app/(app)/journeys/_actions";
import { AcknowledgeDialog, FormDialog, SkipDialog } from "./step-dialogs";

/** The step fields every surface (navigator, run detail, task list) shares. */
export type StepCardData = Pick<
  TimelineStep,
  | "id"
  | "runId"
  | "title"
  | "description"
  | "type"
  | "dueDate"
  | "status"
  | "overdue"
  | "dueToday"
  | "target"
  | "action"
  | "canAct"
  | "canSkip"
  | "note"
  | "completedBy"
> & {
  assignee?: TimelineStep["assignee"];
  completedAt?: string | null;
};

export interface StepCardProps {
  step: StepCardData;
  today: string;
  /** navigator = the new hire's own view; detail = someone looking at a whole journey; task = a row in a task list. */
  mode: "navigator" | "detail" | "task";
  appIcons?: Record<string, AppIconData>;
  /** Shown in task mode: who the step is for. */
  forPerson?: { id: string; name: string; avatarUrl: string | null };
  journeyName?: string;
  /** First name of the person the journey is for, used in copy. */
  subjectFirstName?: string;
  /** The viewer is the person the journey is for (acknowledgements are theirs alone). */
  viewerIsSubject?: boolean;
  /** The viewer's display name: a step they completed themselves says "Done Thu 15 Oct", not "by <them>". */
  viewerName?: string;
  /** Manager or People team: can pick the buddy for a buddy step still waiting. */
  onAssignBuddy?: () => void;
  /** The first open step in the viewer's own timeline: marked "Up next" so there is a place to start. */
  isNext?: boolean;
  /** A step in a later stage: title, due date and the tick only, so the page reads what is near first. */
  compact?: boolean;
  /** The new hire's "Up next" step, drawn as a filled violet category block (navigator only). */
  filled?: boolean;
  className?: string;
}

const NEEDS_DIALOG = new Set(["acknowledge_page", "form"]);

/* A done checkbox in the success tone, so a finished step reads as finished rather than selected. */
const doneCheckbox =
  "size-6 rounded-[6px] sm:size-[18px] sm:rounded-[5px] data-[state=checked]:border-success data-[state=checked]:bg-success data-[state=checked]:text-success-fg";

export function StepCard({
  step,
  today,
  mode,
  appIcons,
  forPerson,
  journeyName,
  subjectFirstName,
  viewerIsSubject = false,
  viewerName,
  onAssignBuddy,
  isNext = false,
  compact = false,
  filled = false,
  className,
}: StepCardProps) {
  const [status, setStatus] = React.useState(step.status);
  const [pending, startTransition] = React.useTransition();
  const [dialog, setDialog] = React.useState<"ack" | "form" | "skip" | null>(null);
  React.useEffect(() => setStatus(step.status), [step.status]);

  const done = status !== "pending";
  const overdue = !done && step.overdue;
  const ackOnlySubject = step.type === "acknowledge_page" && !viewerIsSubject;
  const tickable = step.canAct && !NEEDS_DIALOG.has(step.type);
  const canUntick = step.canAct && done && !(step.type === "acknowledge_page" && status === "done");
  const showsCheckbox = tickable || (step.canAct && done);

  const complete = (answers?: Record<string, string>, after?: () => void) =>
    startTransition(async () => {
      const prev = status;
      setStatus("done");
      const res = await completeStepAction(step.id, answers);
      if (!res.ok) {
        setStatus(prev);
        toast.error(res.error);
        return;
      }
      after?.();
      if (res.runCompleted) toast.success("That was the last step. Journey complete.");
      else
        toast.success(`Done: ${step.title}`, {
          action:
            step.type === "acknowledge_page"
              ? undefined
              : { label: "Undo", onClick: () => reopen() },
        });
    });

  const reopen = () =>
    startTransition(async () => {
      const prev = status;
      setStatus("pending");
      const res = await reopenStepAction(step.id);
      if (!res.ok) {
        setStatus(prev);
        toast.error(res.error);
      }
    });

  const onCheck = (checked: boolean) => (checked ? complete() : reopen());
  const titleId = `step-${step.id}-title`;

  /*
   * A finished step collapses to a 44px row: the check, the title struck through, when it was done.
   * The group then shows what is left, not what was done. (Audit F2, F3, F4.)
   */
  if (done) {
    const when = step.completedAt ? formatDay(step.completedAt.slice(0, 10)) : null;
    const byOther = step.completedBy && step.completedBy !== viewerName ? step.completedBy : null;
    const caption =
      status === "skipped" ? "Skipped" : `Done${when ? ` ${when}` : ""}${byOther ? ` by ${byOther}` : ""}`;
    return (
      <article
        id={`step-${step.id}`}
        aria-labelledby={titleId}
        className={cn(
          "group/step relative flex min-h-11 scroll-mt-24 items-center gap-3 px-1",
          mode === "task" && "border-b border-border last:border-b-0 sm:px-2",
          className,
        )}
      >
        {showsCheckbox ? (
          <Checkbox
            checked
            disabled={pending || !canUntick}
            onCheckedChange={(v) => onCheck(v === true)}
            aria-label={`Mark "${step.title}" as not done`}
            className={doneCheckbox}
          />
        ) : (
          <span className="inline-flex size-6 shrink-0 items-center justify-center text-success-text sm:size-[18px]" aria-hidden>
            <Check className="size-4 stroke-[2]" />
          </span>
        )}
        {forPerson ? <Avatar name={forPerson.name} seed={forPerson.id} src={forPerson.avatarUrl} size="xs" /> : null}
        <div className="flex min-w-0 flex-1 flex-col py-2">
          <div className="flex min-w-0 items-baseline gap-1.5 text-body text-muted">
            <h3
              id={titleId}
              className={cn("min-w-0 truncate font-normal", status === "done" && "line-through decoration-border-strong decoration-1")}
            >
              {step.title}
            </h3>
            {forPerson ? <span className="hidden shrink-0 text-caption text-subtle sm:inline">for {forPerson.name}</span> : null}
          </div>
          {status === "skipped" && step.note ? <p className="truncate text-caption text-muted">Skipped: {step.note}</p> : null}
        </div>
        <span className="tabular shrink-0 text-caption text-muted">{caption}</span>
      </article>
    );
  }

  const due = dueLabel(step.dueDate, today);
  // On the new hire's own page, today's stage header and the today line already say "due today".
  const quietDue = mode !== "task" && step.dueToday && !overdue;
  const wide = mode !== "task" && !compact;
  const moreMenu = step.canSkip ? (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`More actions for "${step.title}"`}
          className="text-muted"
        >
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuItem onSelect={() => setDialog("skip")}>
          <SkipForward />
          Skip this step
        </DropdownMenuItem>
        {mode === "task" ? (
          <DropdownMenuItem asChild>
            <Link href={`/journeys/runs/${step.runId}`}>
              <ArrowUpRight />
              View whole journey
            </Link>
          </DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  ) : null;

  const showPrimary =
    mode === "task"
      ? NEEDS_DIALOG.has(step.type) || primaryActionVisible(step, mode, viewerIsSubject)
      : step.canAct || step.canSkip || primaryActionVisible(step, mode, viewerIsSubject);

  return (
    <article
      id={`step-${step.id}`}
      aria-labelledby={titleId}
      className={cn(
        "group/step relative flex scroll-mt-24 gap-3 rounded-card p-4 transition-[box-shadow,background-color] duration-160 ease-standard",
        mode === "task" ? "cell px-3 py-3.5 sm:px-4" : filled && !overdue ? cn(styles.filled, "isolate p-5") : compact ? "cell py-3" : "cell",
        mode !== "task" && overdue && styles.lateCell,
        mode !== "task" && !overdue && isNext && !filled && styles.nextCell,
        className,
      )}
      data-next={isNext || undefined}
      data-overdue={overdue || undefined}
    >
      {tickable ? (
        <div className="flex pt-0.5">
          <Checkbox
            checked={false}
            disabled={pending}
            onCheckedChange={(v) => onCheck(v === true)}
            aria-label={`Mark "${step.title}" as done`}
            className="size-6 rounded-[6px] sm:size-[18px] sm:rounded-[5px]"
          />
        </div>
      ) : mode !== "task" ? (
        <div className="w-6 shrink-0 sm:w-[18px]" aria-hidden />
      ) : null}

      {/* Wide screens: what to do on the left, the thing to open and the button on the right, so a card is never a left-hand column of text with an empty right. */}
      <div className={cn("flex min-w-0 flex-1 flex-col gap-2", wide && "xl:grid xl:grid-cols-[minmax(0,1fr)_minmax(0,300px)] xl:items-center xl:gap-x-8")}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-0.5">
            {isNext || forPerson || journeyName ? (
              <p className="flex min-w-0 items-center gap-1.5 text-caption text-muted">
                {isNext ? (
                  filled ? (
                    <span className="inline-flex h-6 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-white px-2.5 font-medium text-[var(--lb-cat-violet-to)]">
                      <span className="size-1.5 rounded-full bg-[var(--lb-cat-violet-to)]" aria-hidden />
                      Up next
                    </span>
                  ) : (
                    <span className="font-medium text-cat-violet-text">Up next</span>
                  )
                ) : null}
                {isNext && (forPerson || journeyName) ? <span aria-hidden>·</span> : null}
                {forPerson ? (
                  <>
                    <Avatar name={forPerson.name} seed={forPerson.id} src={forPerson.avatarUrl} size="xs" />
                    <span className="truncate">For {forPerson.name}</span>
                  </>
                ) : null}
                {forPerson && journeyName ? <span aria-hidden>·</span> : null}
                {journeyName ? <span className="truncate">{journeyName}</span> : null}
              </p>
            ) : null}
            <h3 id={titleId} className={cn("font-medium text-fg text-pretty", filled ? "text-h3" : "text-row")}>
              {step.title}
            </h3>
            {/* Below sm the due line sits under the title; the menu stays pinned top-right. */}
            {quietDue ? null : (
              <div className="pt-1 sm:hidden">
                <DueLine step={step} due={due} overdue={overdue} />
              </div>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {quietDue ? null : (
              <span className="hidden sm:inline-flex">
                <DueLine step={step} due={due} overdue={overdue} />
              </span>
            )}
            {moreMenu}
          </div>
        </div>

        {step.description && !compact ? <p className={cn("max-w-[68ch] text-muted text-pretty", filled ? "text-body" : "text-small")}>{step.description}</p> : null}

        {mode === "detail" && step.assignee ? <AssigneeLine assignee={step.assignee} onAssignBuddy={onAssignBuddy} /> : null}

        {compact ? null : (
          <div className={cn("flex min-w-0 flex-col gap-2", wide && "xl:col-start-2 xl:row-span-4 xl:row-start-1 xl:items-end")}>
            <TargetBlock target={step.target} appIcons={appIcons} mode={mode} subjectFirstName={subjectFirstName} />
        {showPrimary ? (
          <div className="flex flex-wrap items-center gap-2 pt-0.5">
            <PrimaryAction
              step={step}
              mode={mode}
              lead={isNext || mode === "task"}
              viewerIsSubject={viewerIsSubject}
              ackOnlySubject={ackOnlySubject}
              onAcknowledge={() => setDialog("ack")}
              onAnswer={() => setDialog("form")}
              pending={pending}
            />
          </div>
        ) : null}
          </div>
        )}
      </div>

      {step.type === "acknowledge_page" && step.target?.kind === "page" ? (
        <AcknowledgeDialog
          open={dialog === "ack"}
          onOpenChange={(o) => setDialog(o ? "ack" : null)}
          page={step.target}
          pending={pending}
          onConfirm={() => complete(undefined, () => setDialog(null))}
        />
      ) : null}
      {step.type === "form" && step.target?.kind === "form" ? (
        <FormDialog
          open={dialog === "form"}
          onOpenChange={(o) => setDialog(o ? "form" : null)}
          title={step.title}
          description={step.description}
          questions={step.target.questions}
          pending={pending}
          onSubmit={(answers) => complete(answers, () => setDialog(null))}
        />
      ) : null}
      <SkipDialog
        open={dialog === "skip"}
        onOpenChange={(o) => setDialog(o ? "skip" : null)}
        stepId={step.id}
        title={step.title}
        onSkipped={() => {
          setStatus("skipped");
          setDialog(null);
        }}
      />
    </article>
  );
}

function primaryActionVisible(
  step: StepCardData,
  mode: StepCardProps["mode"],
  viewerIsSubject: boolean,
) {
  if (step.type === "launch_app") return mode === "navigator" || viewerIsSubject;
  return false;
}

function DueLine({ step, due, overdue }: { step: StepCardData; due: string; overdue: boolean }) {
  if (overdue) {
    return (
      <Badge tone="danger" dot size="sm" className="self-start">
        {due}
      </Badge>
    );
  }
  if (step.dueToday) {
    return (
      <span className="inline-flex shrink-0 items-center gap-1.5 text-caption font-medium text-now-text">
        <span className="size-1.5 rounded-full bg-now" aria-hidden />
        {due}
      </span>
    );
  }
  return <span className="tabular shrink-0 text-caption text-muted">{due}</span>;
}

function AssigneeLine({
  assignee,
  onAssignBuddy,
}: {
  assignee: NonNullable<StepCardData["assignee"]>;
  onAssignBuddy?: () => void;
}) {
  if (assignee.awaitingBuddy) {
    return (
      <div className="flex flex-wrap items-center gap-2 text-small text-muted">
        <span>Buddy not chosen yet</span>
        {onAssignBuddy ? (
          <Button variant="link" size="sm" onClick={onAssignBuddy} className="text-small">
            <UserRoundPlus className="size-3.5" aria-hidden />
            Assign a buddy
          </Button>
        ) : null}
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2 text-small text-muted">
      {assignee.person ? (
        <>
          <Avatar name={assignee.person.name} seed={assignee.person.id} src={assignee.person.avatarUrl} size="xs" />
          <span className="truncate text-fg">{assignee.person.name}</span>
          <span className="inline-flex h-6 shrink-0 items-center rounded-full bg-sunken px-2 text-caption text-muted dark:bg-surface/60">{assignee.label}</span>
        </>
      ) : assignee.team ? (
        <Badge tone="info" size="sm">
          {assignee.team === "it" ? "IT queue" : "People team queue"}
        </Badge>
      ) : (
        <span>{assignee.label}, nobody set</span>
      )}
    </div>
  );
}

function PrimaryAction({
  step,
  mode,
  lead,
  viewerIsSubject,
  ackOnlySubject,
  onAcknowledge,
  onAnswer,
  pending,
}: {
  step: StepCardData;
  mode: StepCardProps["mode"];
  /** The one step that gets the primary (filled) button; the rest are raised white pills. */
  lead: boolean;
  viewerIsSubject: boolean;
  ackOnlySubject: boolean;
  onAcknowledge: () => void;
  onAnswer: () => void;
  pending: boolean;
}) {
  const t = step.target;
  if (step.type === "acknowledge_page") {
    if (ackOnlySubject)
      return <span className="text-small text-muted">Waiting for them to acknowledge</span>;
    return step.canAct ? (
      <Button size="sm" variant={lead ? "primary" : "secondary"} onClick={onAcknowledge} disabled={pending}>
        Read and acknowledge
      </Button>
    ) : null;
  }
  if (step.type === "form") {
    return step.canAct ? (
      <Button size="sm" variant={lead ? "primary" : "secondary"} onClick={onAnswer} disabled={pending}>
        {viewerIsSubject ? "Answer" : "Fill in"}
      </Button>
    ) : null;
  }
  const showLinks = mode === "navigator" || viewerIsSubject;
  if (!showLinks) return null;
  if (t?.kind === "app") {
    return (
      <Button asChild size="sm" variant="secondary">
        <a href={t.href} target="_blank" rel="noopener">
          Open {t.name}
          <ExternalLink aria-hidden />
        </a>
      </Button>
    );
  }
  return null;
}

function TargetBlock({
  target,
  appIcons,
  mode,
  subjectFirstName,
}: {
  target: StepTarget;
  appIcons?: Record<string, AppIconData>;
  mode: StepCardProps["mode"];
  subjectFirstName?: string;
}) {
  if (!target) return null;
  switch (target.kind) {
    case "page":
      return (
        <Link
          href={target.href}
          className="focus-ring press group/link flex min-w-0 max-w-full items-center gap-2.5 self-start rounded-cell bg-sunken py-2 pl-2.5 pr-3 hover:bg-hover dark:bg-raised dark:shadow-cell"
        >
          <BookOpen className="size-4 shrink-0 stroke-[1.5] text-muted" aria-hidden />
          <span className="flex min-w-0 flex-col">
            <span className="truncate text-small font-medium text-fg group-hover/link:underline group-hover/link:underline-offset-2">
              {target.title}
            </span>
            <span className="truncate text-caption text-muted">
              {target.found ? `Knowledge · ${target.space}` : `${target.space} · not published yet`}
            </span>
          </span>
        </Link>
      );
    case "app": {
      const icon = appIcons?.[target.href.split("/").pop() ?? ""];
      if (mode !== "navigator") {
        return (
          <span className="flex items-center gap-2 text-small text-muted">
            {icon ? <AppIcon icon={icon} size="sm" /> : null}
            {target.name}
          </span>
        );
      }
      return icon ? (
        <span className="flex items-center gap-2 text-small text-muted">
          <AppIcon icon={icon} size="sm" />
          Signs you in with your work account
        </span>
      ) : null;
    }
    case "person":
      if (!target.person) {
        return (
          <p className="text-small text-muted">
            {target.role === "buddy"
              ? mode === "navigator"
                ? "Your buddy will be introduced here soon."
                : `${subjectFirstName ? `${subjectFirstName}'s` : "Their"} buddy has not been chosen yet.`
              : "Nobody to meet yet."}
          </p>
        );
      }
      return (
        <Link
          href={`/people/${target.person.id}`}
          className="focus-ring press group/link flex min-w-0 max-w-full items-center gap-3 self-start rounded-cell bg-sunken py-2 pl-2 pr-3 hover:bg-hover dark:bg-raised dark:shadow-cell"
        >
          <Avatar name={target.person.name} seed={target.person.id} src={target.person.avatarUrl} size="md" />
          <span className="flex min-w-0 flex-col">
            <span className="truncate text-small font-medium text-fg group-hover/link:underline group-hover/link:underline-offset-2">
              {target.person.name}
            </span>
            <span className="truncate text-caption text-muted">
              {target.role === "manager" ? "Manager" : target.role === "buddy" ? "Buddy" : null}
              {target.role && target.person.title ? " · " : null}
              {target.person.title}
            </span>
          </span>
        </Link>
      );
    case "ticket":
      return (
        <div className="flex flex-wrap items-center gap-2 text-small text-muted">
          <LifeBuoy className="size-4 shrink-0 stroke-[1.5] text-subtle" aria-hidden />
          <span>{target.requestTypeName}</span>
          {target.ticket ? (
            <Badge
              tone={["resolved", "closed"].includes(target.ticket.status) ? "success" : "info"}
              dot
              size="sm"
            >
              <span className="tabular">#{target.ticket.number}</span>{" "}
              {ticketStatus(target.ticket.status)}
            </Badge>
          ) : (
            <span className="text-subtle">
              {mode === "navigator"
                ? "Already in hand"
                : `Raised automatically ${target.leadDays === 1 ? "1 day" : `${target.leadDays} days`} before it is due`}
            </span>
          )}
        </div>
      );
    case "form":
      if (!target.answers || !Object.keys(target.answers).length) return null;
      return (
        <dl className="grid gap-2 rounded-cell bg-sunken p-3 text-small dark:bg-raised">
          {target.questions
            .filter((q) => target.answers?.[q.key])
            .map((q) => (
              <div key={q.key} className="flex flex-col gap-0.5">
                <dt className="text-caption text-muted">{q.label}</dt>
                <dd className="whitespace-pre-wrap text-fg">{target.answers?.[q.key]}</dd>
              </div>
            ))}
        </dl>
      );
    case "link":
      return (
        <a
          href={target.href}
          target={target.href.startsWith("/") ? undefined : "_blank"}
          rel="noopener"
          className="focus-ring inline-flex items-center gap-1 self-start rounded-[4px] text-small font-medium text-accent-text hover:underline"
        >
          {target.label}
          <ArrowUpRight className="size-3.5" aria-hidden />
        </a>
      );
  }
}

function ticketStatus(s: string) {
  return (
    (
      {
        new: "New",
        open: "Open",
        pending_approval: "Awaiting approval",
        waiting_on_requester: "Waiting on requester",
        resolved: "Resolved",
        closed: "Closed",
        rejected: "Rejected",
      } as Record<string, string>
    )[s] ?? s
  );
}
