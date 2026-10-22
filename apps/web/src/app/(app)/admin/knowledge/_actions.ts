"use server";

import { revalidatePath } from "next/cache";
import { KnowledgeError, remindOwners } from "@lobby/core/knowledge";
import { requireAdmin } from "@/server/auth";

export async function remindOwnersAction(pageIds: string[]): Promise<{ ok: true; owners: number } | { ok: false; error: string }> {
  const ctx = await requireAdmin();
  if (!Array.isArray(pageIds)) return { ok: false, error: "Choose at least one page." };
  try {
    const owners = await remindOwners(ctx, pageIds.filter((x): x is string => typeof x === "string"));
    revalidatePath("/admin/knowledge");
    return { ok: true, owners };
  } catch (err) {
    if (err instanceof KnowledgeError) return { ok: false, error: err.message };
    console.error("[knowledge] remind owners", err);
    return { ok: false, error: "Could not send the reminders. Try again in a moment." };
  }
}
