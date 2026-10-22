import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { completeStepAction, skipStepAction } from "@/app/setup/_actions";
import type { SetupStep } from "@lobby/core/settings";
import { STEPS, stepIndex } from "./steps";

/**
 * "Skip for now" inside another form via formAction. The enclosing form must carry a hidden
 * `_setupStep` input (React owns the button's own name/value for server actions).
 */
export function SkipButton() {
  return (
    <Button type="submit" variant="ghost" formAction={skipStepAction} formNoValidate>
      Skip for now
    </Button>
  );
}

/**
 * Where you are and what is next, as one raised bar: the step position and what follows on the
 * left, skip and the one primary action on the right. Phones stack it, Continue first under the thumb.
 */
export function StepBar({ step, children, note }: { step: SetupStep; children: React.ReactNode; note?: React.ReactNode }) {
  const i = stepIndex(step);
  const next = STEPS[i + 1];
  return (
    <div className="cell mt-10 flex flex-col gap-3 rounded-card p-3 sm:flex-row sm:items-center sm:gap-4 sm:py-2.5 sm:pl-5 sm:pr-2.5">
      <div className="flex min-w-0 flex-1 items-center gap-3 px-1 sm:px-0">
        {/* Six ticks: the steps behind you are lit, the current one is long. */}
        <span className="flex shrink-0 items-center gap-1" aria-hidden>
          {STEPS.map((s, k) => (
            <span key={s.key} className={k === i ? "h-1.5 w-5 rounded-full bg-accent" : k < i ? "size-1.5 rounded-full bg-accent/60" : "size-1.5 rounded-full bg-sunken shadow-inset"} />
          ))}
        </span>
        <span className="min-w-0 text-small text-muted">
          {note ?? (
            <>
              {/* The header already says which step this is; the bar says what comes next. */}
              <span className="sr-only">Step {i + 1} of {STEPS.length}. </span>
              {next ? (
                <>
                  Next: <span className="font-medium text-fg">{next.label}</span>
                </>
              ) : (
                <span className="font-medium text-fg">Last step</span>
              )}
            </>
          )}
        </span>
      </div>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center">{children}</div>
    </div>
  );
}

/** Footer for steps whose work happens in panels: skip, or mark done and continue. */
export function StepFooter({ step, canContinue = true, continueLabel = "Continue", note }: { step: SetupStep; canContinue?: boolean; continueLabel?: string; note?: React.ReactNode }) {
  return (
    <form>
      <input type="hidden" name="_setupStep" value={step} />
      <StepBar step={step} note={note}>
        <Button type="submit" variant="ghost" formAction={skipStepAction}>
          Skip for now
        </Button>
        <Button type="submit" formAction={completeStepAction} disabled={!canContinue}>
          {continueLabel}
          <ArrowRight aria-hidden />
        </Button>
      </StepBar>
    </form>
  );
}
