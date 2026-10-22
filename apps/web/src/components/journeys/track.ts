import { daysBetween, type Phase } from "@lobby/core/journeys/dates";

/** One step as a dot on the month track. */
export interface TrackDot {
  id: string;
  status: "pending" | "done" | "skipped";
  overdue: boolean;
  next: boolean;
}

/** One phase of a journey (Before day 1, Day 1, Week 1...) as a block on the month track. */
export interface TrackPhase {
  key: string;
  label: string;
  first: string;
  last: string;
  /** Day 1: drawn in the first-day green. */
  anchor: boolean;
  /** Today falls inside this phase's dates (or it is the next phase to start). */
  current: boolean;
  dots: TrackDot[];
  done: number;
  /** The first open step in the phase, for the block's one-line preview. */
  nextTitle: string | null;
}

export interface Track {
  phases: TrackPhase[];
  /** Where today sits, in phase units: 1.5 is halfway through the second phase. */
  todayAt: number;
}

/** Green means a first day and nothing else, so only Day 1 is an anchor block. */
const ANCHORS = new Set(["day-1"]);

/**
 * Folds a journey's steps into the month track: one block per phase in order, one dot per step,
 * and today's position along the track. Pure, so server pages and client components share it.
 */
export function buildTrack(
  steps: { id: string; title?: string; phase: Phase; dueDate: string; status: "pending" | "done" | "skipped"; overdue: boolean }[],
  today: string,
  nextId?: string,
): Track {
  const map = new Map<string, { phase: Phase; steps: typeof steps }>();
  for (const s of steps) {
    const g = map.get(s.phase.key) ?? { phase: s.phase, steps: [] };
    g.steps.push(s);
    map.set(s.phase.key, g);
  }
  const groups = [...map.values()].sort((a, b) => a.phase.order - b.phase.order);

  let todayAt = groups.length;
  for (let i = 0; i < groups.length; i++) {
    const dates = groups[i]!.steps.map((s) => s.dueDate).sort();
    const first = dates[0]!;
    const last = dates[dates.length - 1]!;
    if (daysBetween(today, first) > 0) {
      todayAt = i;
      break;
    }
    if (daysBetween(today, last) >= 0) {
      const span = daysBetween(first, last) + 1;
      todayAt = i + Math.min(0.9, (daysBetween(first, today) + 0.5) / span);
      break;
    }
  }
  const currentIndex = Math.min(groups.length - 1, Math.floor(todayAt));

  const phases = groups.map((g, i) => {
    const dates = g.steps.map((s) => s.dueDate).sort();
    const dots = [...g.steps]
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
      .map((s) => ({ id: s.id, status: s.status, overdue: s.status === "pending" && s.overdue, next: s.id === nextId }));
    return {
      key: g.phase.key,
      label: g.phase.label,
      first: dates[0]!,
      last: dates[dates.length - 1]!,
      anchor: ANCHORS.has(g.phase.key),
      current: i === currentIndex,
      dots,
      done: dots.filter((d) => d.status !== "pending").length,
      nextTitle: [...g.steps].sort((a, b) => a.dueDate.localeCompare(b.dueDate)).find((s) => s.status === "pending")?.title ?? null,
    };
  });
  return { phases, todayAt };
}
