"use server";

import { revalidatePath } from "next/cache";
import {
  KnowledgeError,
  acknowledgePage,
  getVersion,
  listVersions,
  markReviewed,
  restoreVersion,
  savePage,
  setPageStatus,
  getPageById,
  type SavePageInput,
} from "@lobby/core/knowledge";
import type { DocNode } from "@lobby/core/knowledge/doc";
import { requireUser } from "@/server/auth";

export type ActionResult<T = object> = ({ ok: true } & T) | { ok: false; error: string };

async function run<T extends object>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, ...(await fn()) };
  } catch (err) {
    if (err instanceof KnowledgeError) return { ok: false, error: err.message };
    console.error("[knowledge]", err);
    return { ok: false, error: "Something went wrong saving that. Try again in a moment." };
  }
}

const refresh = () => revalidatePath("/knowledge", "layout");

export async function savePageAction(input: SavePageInput): Promise<ActionResult<{ url: string; status: string }>> {
  const ctx = await requireUser();
  return run(async () => {
    const page = await savePage(ctx, { ...input, content: input.content as DocNode });
    const detail = await getPageById(ctx, page.id);
    refresh();
    return { url: `/knowledge/${detail?.space.slug}/${page.slug}`, status: page.status };
  });
}

export async function markReviewedAction(pageId: string): Promise<ActionResult<{ reviewBy: string | null }>> {
  const ctx = await requireUser();
  return run(async () => {
    const row = await markReviewed(ctx, pageId);
    refresh();
    return { reviewBy: row.reviewBy };
  });
}

export async function acknowledgeAction(pageId: string): Promise<ActionResult<{ acknowledgedAt: string }>> {
  const ctx = await requireUser();
  return run(async () => {
    const r = await acknowledgePage(ctx, pageId);
    refresh();
    return { acknowledgedAt: r.acknowledgedAt.toISOString() };
  });
}

export async function setStatusAction(pageId: string, status: "archived" | "draft"): Promise<ActionResult> {
  const ctx = await requireUser();
  return run(async () => {
    await setPageStatus(ctx, pageId, status);
    refresh();
    return {};
  });
}

export async function listVersionsAction(pageId: string) {
  const ctx = await requireUser();
  return run(async () => {
    const versions = await listVersions(ctx, pageId);
    return { versions: versions.map((v) => ({ ...v, createdAt: v.createdAt.toISOString() })) };
  });
}

export async function getVersionAction(versionId: string) {
  const ctx = await requireUser();
  return run(async () => {
    const v = await getVersion(ctx, versionId);
    if (!v) throw new KnowledgeError("That version is not available.");
    return { title: v.title, content: v.content as unknown as DocNode };
  });
}

export async function restoreVersionAction(versionId: string): Promise<ActionResult> {
  const ctx = await requireUser();
  return run(async () => {
    await restoreVersion(ctx, versionId);
    refresh();
    return {};
  });
}
