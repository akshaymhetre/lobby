"use server";

import { revalidatePath } from "next/cache";
import { JourneyError, assignBuddy, cancelRun, completeStep, reopenStep, skipStep } from "@lobby/core/journeys";
import { KnowledgeError } from "@lobby/core/knowledge";
import { requireUser } from "@/server/auth";

export type ActionResult<T = object> = ({ ok: true } & T) | { ok: false; error: string };

async function run<T extends object>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    const out = await fn();
    revalidatePath("/journeys", "layout");
    revalidatePath("/", "layout");
    return { ok: true, ...out };
  } catch (err) {
    if (err instanceof JourneyError || err instanceof KnowledgeError) return { ok: false, error: err.message };
    console.error("[journeys]", err);
    return { ok: false, error: "That did not save. Try again in a moment." };
  }
}

const isId = (v: unknown): v is string => typeof v === "string" && /^[0-9a-f-]{36}$/i.test(v);

export async function completeStepAction(stepRunId: string, answers?: Record<string, string>): Promise<ActionResult<{ runCompleted: boolean }>> {
  const ctx = await requireUser();
  if (!isId(stepRunId)) return { ok: false, error: "That step no longer exists." };
  const clean = answers && typeof answers === "object" ? Object.fromEntries(Object.entries(answers).filter(([, v]) => typeof v === "string")) : undefined;
  return run(async () => {
    const r = await completeStep(ctx, stepRunId, { answers: clean });
    return { runCompleted: "runCompleted" in r ? !!r.runCompleted : false };
  });
}

export async function reopenStepAction(stepRunId: string): Promise<ActionResult> {
  const ctx = await requireUser();
  if (!isId(stepRunId)) return { ok: false, error: "That step no longer exists." };
  return run(async () => {
    await reopenStep(ctx, stepRunId);
    return {};
  });
}

export async function skipStepAction(stepRunId: string, reason?: string): Promise<ActionResult> {
  const ctx = await requireUser();
  if (!isId(stepRunId)) return { ok: false, error: "That step no longer exists." };
  return run(async () => {
    await skipStep(ctx, stepRunId, typeof reason === "string" ? reason : undefined);
    return {};
  });
}

export async function assignBuddyAction(runId: string, buddyUserId: string | null): Promise<ActionResult> {
  const ctx = await requireUser();
  if (!isId(runId) || (buddyUserId !== null && !isId(buddyUserId))) return { ok: false, error: "Pick a colleague from the list." };
  return run(async () => {
    await assignBuddy(ctx, runId, buddyUserId);
    return {};
  });
}

export async function cancelRunAction(runId: string): Promise<ActionResult> {
  const ctx = await requireUser();
  if (!isId(runId)) return { ok: false, error: "That journey no longer exists." };
  return run(async () => {
    await cancelRun(ctx, runId);
    return {};
  });
}
