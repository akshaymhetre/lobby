/**
 * The two ways to count a journey's steps. Pure, so every read model (navigator, run page, team
 * view, all journeys) and the canonical counts in `../counts` share one definition.
 *
 * - New-hire progress: steps assigned to the person the journey is for (assignee "subject").
 *   This is the one number shown as "their progress" on every screen.
 * - Run progress: every step on the run, whoever it is assigned to. Any screen showing it says
 *   so, e.g. "26 steps across everyone, 3 done".
 *
 * A step counts as done when it is not pending (done or skipped).
 */
export interface StepTally {
  done: number;
  total: number;
}

type CountableStep = { status: string; assignee: string };

export const isStepDone = (st: { status: string }) => st.status !== "pending";
export const isNewHireStep = (st: { assignee: string }) => st.assignee === "subject";

/** Steps assigned to the new hire (or leaver) themself, as done of total. */
export function tallyNewHireSteps(steps: readonly CountableStep[]): StepTally {
  const own = steps.filter(isNewHireStep);
  return { done: own.filter(isStepDone).length, total: own.length };
}

/** Every step on the run, whoever it is assigned to, as done of total. */
export function tallyRunSteps(steps: readonly { status: string }[]): StepTally {
  return { done: steps.filter(isStepDone).length, total: steps.length };
}

export function addTallies(a: StepTally, b: StepTally): StepTally {
  return { done: a.done + b.done, total: a.total + b.total };
}

export const pctOf = (t: StepTally) => (t.total ? Math.round((t.done / t.total) * 100) : 100);
