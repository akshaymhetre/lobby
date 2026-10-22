"use client";

import { Check, LifeBuoy, ListChecks, LockKeyhole, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

export interface PendingAction {
  id: string;
  tool: string;
  summary: string;
  input: Record<string, unknown>;
  state: "waiting" | "working" | "confirmed" | "cancelled";
}

interface ToolPresentation {
  icon: LucideIcon;
  /** What the card is proposing, as a noun phrase. */
  title: string;
  /** The primary button names the outcome, never "Confirm". */
  verb: string;
  /** What will happen once the reader agrees, in one sentence. */
  consequence: string;
  /** Past tense, for the settled card. */
  done: string;
  /** Input keys worth showing, in order, with their labels. Anything else is hidden. */
  fields: [key: string, label: string][];
}

const TOOLS: Record<string, ToolPresentation> = {
  create_ticket: {
    icon: LifeBuoy,
    title: "Raise a request",
    verb: "Raise request",
    consequence: "A request is opened in Help with you as the requester. You can edit or cancel it there.",
    done: "Request raised",
    fields: [
      ["requestTypeSlug", "Request type"],
      ["subject", "Subject"],
      ["description", "Details"],
      ["priority", "Priority"],
    ],
  },
  request_app_access: {
    icon: LockKeyhole,
    title: "Request app access",
    verb: "Request access",
    consequence: "An access request goes to the app's approver. You will be told in Help when it is decided.",
    done: "Access requested",
    fields: [
      ["appSlug", "App"],
      ["reason", "Reason"],
    ],
  },
  complete_onboarding_step: {
    icon: ListChecks,
    title: "Mark an onboarding step as done",
    verb: "Mark as done",
    consequence: "The step is ticked off on your onboarding journey and your manager can see it.",
    done: "Step marked as done",
    fields: [["title", "Step"]],
  },
};

const FALLBACK: ToolPresentation = {
  icon: Check,
  title: "Action",
  verb: "Confirm",
  consequence: "Nothing happens until you confirm.",
  done: "Done",
  fields: [],
};

const humanise = (v: unknown) => String(v).replace(/[-_]/g, " ").replace(/^./, (c) => c.toUpperCase());

/**
 * The confirm-before-action card. Everything the assistant is about to do on the reader's behalf is
 * spelled out: what, with which values, and what happens next. The primary button names the outcome.
 */
export function ActionCard({
  action,
  onDecide,
  disabled,
}: {
  action: PendingAction;
  onDecide: (a: PendingAction, d: "confirm" | "cancel") => void;
  disabled: boolean;
}) {
  const t = TOOLS[action.tool] ?? FALLBACK;
  const Icon = t.icon;
  const known = t.fields
    .map(([key, label]) => [label, action.input[key]] as const)
    .filter(([, v]) => typeof v === "string" && v.trim());
  const details: (readonly [string, unknown])[] = known.length
    ? known.map(([label, v], i) => [label, i === 0 && t.fields[0]![0] === "requestTypeSlug" ? humanise(v) : v] as const)
    : Object.entries(action.input).filter(([k, v]) => typeof v === "string" && v && k !== "stepRunId");
  const settled = action.state === "confirmed" || action.state === "cancelled";

  return (
    <div
      className={cn(
        "rounded-card border bg-surface dark:bg-raised",
        settled ? "border-border" : "border-border-strong shadow-lift",
      )}
      data-action-state={action.state}
    >
      <div className="flex items-start gap-3 px-4 pt-3.5">
        <Icon className="mt-0.5 size-[18px] shrink-0 stroke-[1.5] text-muted" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-small font-medium text-muted">{settled ? (action.state === "confirmed" ? t.done : "Cancelled") : t.title}</p>
          <p className="mt-0.5 text-body font-medium text-fg text-pretty">{action.summary}</p>
        </div>
      </div>

      {details.length > 0 && (
        <dl className="mt-3 divide-y divide-border border-y border-border text-small">
          {details.map(([label, v]) => (
            <div key={label} className="grid grid-cols-[96px_minmax(0,1fr)] gap-3 px-4 py-2">
              <dt className="text-subtle">{label}</dt>
              <dd className="whitespace-pre-wrap break-words text-fg">{String(v)}</dd>
            </div>
          ))}
        </dl>
      )}

      {settled ? (
        <p className={cn("flex items-center gap-1.5 px-4 py-3 text-small font-medium", action.state === "confirmed" ? "text-success-text" : "text-muted")}>
          {action.state === "confirmed" ? <Check className="size-4 stroke-[2]" aria-hidden /> : null}
          {action.state === "confirmed" ? t.done : "Cancelled, nothing was sent"}
        </p>
      ) : (
        <div className="px-4 py-3">
          <p className="text-small text-muted text-pretty">{t.consequence}</p>
          <div className="mt-3 flex items-center gap-2">
            <Button size="sm" onClick={() => onDecide(action, "confirm")} loading={action.state === "working"} disabled={disabled}>
              {t.verb}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => onDecide(action, "cancel")} disabled={disabled || action.state === "working"}>
              Cancel
            </Button>
            <span className="ml-auto text-caption text-subtle">Nothing is sent until you agree.</span>
          </div>
        </div>
      )}
    </div>
  );
}
