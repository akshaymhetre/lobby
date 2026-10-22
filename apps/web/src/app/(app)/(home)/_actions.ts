"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  acknowledgeAnnouncement, addComment, deleteComment, dismissAnnouncement, sendGreeting, toggleLike, toggleSave,
} from "@lobby/core/home";
import { requireUser } from "@/server/auth";

export type HomeResult<T = object> = ({ ok: true } & T) | { ok: false; error: string };

const id = z.uuid();
const fail = (e: unknown, fallback: string): { ok: false; error: string } => ({
  ok: false,
  error: e instanceof Error ? e.message : fallback,
});

export async function acknowledgeAnnouncementAction(announcementId: string): Promise<HomeResult> {
  const ctx = await requireUser();
  if (!id.safeParse(announcementId).success) return { ok: false, error: "That announcement is not available." };
  try {
    await acknowledgeAnnouncement(ctx, announcementId);
  } catch (e) {
    return fail(e, "Could not save that. Try again.");
  }
  revalidatePath("/");
  return { ok: true };
}

export async function dismissAnnouncementAction(announcementId: string): Promise<HomeResult> {
  const ctx = await requireUser();
  if (!id.safeParse(announcementId).success) return { ok: false, error: "That announcement is not available." };
  try {
    await dismissAnnouncement(ctx, announcementId);
  } catch (e) {
    return fail(e, "Could not dismiss that. Try again.");
  }
  revalidatePath("/");
  return { ok: true };
}

export async function toggleLikeAction(postId: string): Promise<HomeResult<{ liked: boolean; count: number }>> {
  const ctx = await requireUser();
  if (!id.safeParse(postId).success) return { ok: false, error: "That post is not available." };
  try {
    const r = await toggleLike(ctx, postId);
    revalidatePath("/");
    revalidatePath(`/news/${postId}`);
    return { ok: true, ...r };
  } catch (e) {
    return fail(e, "Could not save your like.");
  }
}

export async function toggleSaveAction(postId: string): Promise<HomeResult<{ saved: boolean }>> {
  const ctx = await requireUser();
  if (!id.safeParse(postId).success) return { ok: false, error: "That post is not available." };
  try {
    const r = await toggleSave(ctx, postId);
    revalidatePath("/");
    revalidatePath(`/news/${postId}`);
    return { ok: true, ...r };
  } catch (e) {
    return fail(e, "Could not save the post.");
  }
}

export async function addCommentAction(postId: string, body: string): Promise<HomeResult<{ id: string }>> {
  const ctx = await requireUser();
  if (!id.safeParse(postId).success) return { ok: false, error: "That post is not available." };
  try {
    const r = await addComment(ctx, postId, body);
    revalidatePath(`/news/${postId}`);
    revalidatePath("/");
    return { ok: true, id: r.id };
  } catch (e) {
    return fail(e, "Could not post your comment.");
  }
}

export async function deleteCommentAction(commentId: string, postId: string): Promise<HomeResult> {
  const ctx = await requireUser();
  if (!id.safeParse(commentId).success || !id.safeParse(postId).success) return { ok: false, error: "That comment is gone." };
  try {
    await deleteComment(ctx, commentId);
    revalidatePath(`/news/${postId}`);
    revalidatePath("/");
    return { ok: true };
  } catch (e) {
    return fail(e, "Could not delete the comment.");
  }
}

export async function sendGreetingAction(toUserId: string, message: string): Promise<HomeResult> {
  const ctx = await requireUser();
  if (!id.safeParse(toUserId).success) return { ok: false, error: "That person could not be found." };
  try {
    await sendGreeting(ctx, toUserId, message);
  } catch (e) {
    return fail(e, "Could not send your message.");
  }
  revalidatePath("/");
  return { ok: true };
}
