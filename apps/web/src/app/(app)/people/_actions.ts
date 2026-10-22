"use server";

import { revalidatePath } from "next/cache";
import { PeopleError, sendGreeting, updateProfile, type FieldErrors, type ProfilePatch } from "@lobby/core/people";
import { requireUser } from "@/server/auth";

export type ActionResult = { ok: true; message?: string } | { ok: false; error?: string; errors?: FieldErrors };

function fail(err: unknown): ActionResult {
  if (err instanceof PeopleError) return { ok: false, error: err.message };
  console.error("[people] action failed", err);
  return { ok: false, error: "Something went wrong and nothing was saved. Try again in a moment." };
}

/** "Say hi" to a new joiner. Stores one greeting per sender and notifies them. */
export async function sayHiAction(toUserId: string, message?: string): Promise<ActionResult> {
  const ctx = await requireUser();
  try {
    const { created } = await sendGreeting(ctx, toUserId, message);
    revalidatePath("/people");
    revalidatePath(`/people/${toUserId}`);
    return { ok: true, message: created ? "Said hi" : "You already said hi" };
  } catch (err) {
    return fail(err);
  }
}

/** Saves a profile edit. The core function re-checks who may edit which fields. */
export async function updateProfileAction(personId: string, patch: ProfilePatch): Promise<ActionResult> {
  const ctx = await requireUser();
  try {
    const result = await updateProfile(ctx, personId, patch);
    if (!result.ok) return { ok: false, errors: result.errors };
    revalidatePath(`/people/${personId}`);
    revalidatePath("/people");
    revalidatePath("/org-chart");
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}
