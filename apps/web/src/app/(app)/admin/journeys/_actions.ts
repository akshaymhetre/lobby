"use server";

import { revalidatePath } from "next/cache";
import { enqueue, QUEUES } from "@lobby/core/jobs";
import { JourneyError, deleteJourney, installStarterJourneys, saveJourney, setJourneyActive, startJourneyFor } from "@lobby/core/journeys";
import { isIsoDate } from "@lobby/core/journeys/dates";
import { audit } from "@lobby/core";
import { requireJourneyManager } from "@/server/auth";

export type ActionResult<T = object> = ({ ok: true } & T) | { ok: false; error: string; stepErrors?: Record<number, string> };

const isId = (v: unknown): v is string => typeof v === "string" && /^[0-9a-f-]{36}$/i.test(v);

function refresh() {
  revalidatePath("/admin/journeys", "layout");
  revalidatePath("/journeys", "layout");
}

async function guard<T extends object>(fn: () => Promise<ActionResult<T>>): Promise<ActionResult<T>> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof JourneyError) return { ok: false, error: err.message };
    console.error("[journeys admin]", err);
    return { ok: false, error: "That did not save. Try again in a moment." };
  }
}

export async function saveJourneyAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  const ctx = await requireJourneyManager();
  return guard(async () => {
    const res = await saveJourney(ctx, input);
    if (!res.ok) return res;
    refresh();
    return { ok: true, id: res.id };
  });
}

export async function setJourneyActiveAction(id: string, active: boolean): Promise<ActionResult> {
  const ctx = await requireJourneyManager();
  if (!isId(id)) return { ok: false, error: "That journey no longer exists." };
  return guard(async () => {
    await setJourneyActive(ctx, id, active === true);
    refresh();
    return { ok: true };
  });
}

export async function deleteJourneyAction(id: string): Promise<ActionResult> {
  const ctx = await requireJourneyManager();
  if (!isId(id)) return { ok: false, error: "That journey no longer exists." };
  return guard(async () => {
    await deleteJourney(ctx, id);
    refresh();
    return { ok: true };
  });
}

export async function installStarterJourneysAction(): Promise<ActionResult<{ created: string[] }>> {
  const ctx = await requireJourneyManager();
  return guard(async () => {
    const created = await installStarterJourneys();
    if (created.length) await audit(ctx.user.id, "journeys.starter_installed_by", undefined, { created });
    refresh();
    return { ok: true, created };
  });
}

/** Starts a journey for one person by hand, optionally with a different anchor date and a buddy. */
export async function startForPersonAction(input: {
  journeyId: string;
  userId: string;
  anchorDate?: string | null;
  buddyUserId?: string | null;
}): Promise<ActionResult<{ runId: string }>> {
  const ctx = await requireJourneyManager();
  if (!isId(input.journeyId) || !isId(input.userId)) return { ok: false, error: "Pick a person." };
  if (input.anchorDate && !isIsoDate(input.anchorDate)) return { ok: false, error: "That date does not look right." };
  if (input.buddyUserId && !isId(input.buddyUserId)) return { ok: false, error: "Pick a buddy from the list." };
  return guard<{ runId: string }>(async () => {
    const res = await startJourneyFor(input.userId, input.journeyId, {
      anchorDate: input.anchorDate || undefined,
      buddyUserId: input.buddyUserId || null,
      startedById: ctx.user.id,
    });
    const started = res.started[0];
    if (!started) return { ok: false as const, error: res.skipped[0]?.reason ?? "That journey could not be started." };
    // Raise any tickets that are already due straight away instead of waiting for the next tick.
    await enqueue(QUEUES.journeysTick, {}).catch(() => null);
    refresh();
    return { ok: true as const, runId: started.runId };
  });
}
