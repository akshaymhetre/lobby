import { Reveal, RevealItem } from "@/components/ui/motion";
import styles from "./done-celebration.module.css";
import { STEP_ICONS } from "./step-icons";
import { STEPS, stepIndex } from "./steps";
import { ASIDE_SLOT } from "./aside-slot-id";
import type { SetupStep } from "@lobby/core/settings";

/**
 * One wizard step: the eyebrow, the title and the description build in, then the task below them
 * (the step's one authored moment). Pass the step's body as `children`; it arrives last. Steps
 * that keep their own header-only usage can leave `children` out.
 */
export function StepHeader({
  step,
  children,
  aside,
}: {
  step: SetupStep;
  children?: React.ReactNode;
  /**
   * The step's live preview, Stripe-style: from lg the step breaks out of the narrow column into a
   * two-pane layout, the task on the left and this pane, kept in view, on the right. Pass `"slot"`
   * to leave an empty pane that a client form fills through <AsideSlot> (a preview that follows
   * the form's own state). Phones keep the single column.
   */
  aside?: React.ReactNode | "slot";
}) {
  const i = stepIndex(step);
  const s = STEPS[i]!;
  const Icon = STEP_ICONS[step]!;
  const body = (
    <Reveal stagger={0.07} className="flex min-w-0 flex-col">
      <header className="flex flex-col gap-3 pb-8 md:pb-10" data-masthead>
        <RevealItem from="scale" className="mb-1 flex items-center gap-3">
          {/* The step's disc: the same one that flies into the company mark on the finish page. */}
          <span className={`${styles.disc} ${styles.discLg}`} data-state="done" aria-hidden>
            <Icon className="size-[22px] stroke-[1.75]" />
          </span>
          {/* The screen's one eyebrow, in sentence case. */}
          <p className="tabular text-small font-medium text-muted">
            Step {i + 1} of {STEPS.length}, about {s.minutes} min
          </p>
        </RevealItem>
        <RevealItem>
          <h1 className="text-balance text-title-sm font-medium text-fg md:text-title">{s.title}</h1>
        </RevealItem>
        <RevealItem>
          <p className="max-w-xl text-pretty text-body-lg text-muted">{s.description}</p>
        </RevealItem>
      </header>
      {children !== undefined ? <RevealItem duration={0.55}>{children}</RevealItem> : null}
    </Reveal>
  );
  if (aside === undefined) return body;
  return (
    <div
      className="lg:ml-[calc((100%-var(--split-w))/2)] lg:grid lg:w-(--split-w) lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-12 xl:grid-cols-[minmax(0,1fr)_440px] xl:gap-14"
      style={{ "--split-w": "min(1140px, calc(100vw - 9rem))" } as React.CSSProperties}
    >
      {body}
      <aside aria-label="Preview" className="hidden lg:block">
        <div className="sticky top-8 pt-2">{aside === "slot" ? <div id={ASIDE_SLOT} /> : aside}</div>
      </aside>
    </div>
  );
}
