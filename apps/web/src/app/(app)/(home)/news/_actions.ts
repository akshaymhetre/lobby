"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ContentError, createPost, deletePost, updatePost } from "@lobby/core/home";
import { requireUser } from "@/server/auth";

export type PostResult = { ok: true; id: string; published: boolean } | { ok: false; error: string; fieldErrors?: Record<string, string> };

const schema = z.object({
  id: z.uuid().optional(),
  title: z.string().max(500),
  summary: z.string().max(2000).optional().default(""),
  category: z.string().max(100),
  coverImageUrl: z.string().max(2000).optional().default(""),
  bodyHtml: z.string().max(400_000),
  audienceGroupIds: z.array(z.uuid()).max(100),
  pinned: z.boolean(),
  publish: z.boolean(),
});

function refresh(id: string) {
  revalidatePath("/");
  revalidatePath(`/news/${id}`);
}

export async function savePostAction(input: z.input<typeof schema>): Promise<PostResult> {
  const ctx = await requireUser();
  if (!ctx.has("admin") && !ctx.has("content-editor")) return { ok: false, error: "Only content editors and admins can publish news." };
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Check the form and try again." };
  const { id, ...data } = parsed.data;
  try {
    const row = id ? await updatePost(ctx, id, data) : await createPost(ctx, data);
    refresh(row.id);
    return { ok: true, id: row.id, published: data.publish };
  } catch (e) {
    if (e instanceof ContentError) return { ok: false, error: e.message, fieldErrors: e.fieldErrors };
    console.error("[home] save post failed", e);
    return { ok: false, error: "Could not save the post. Try again in a moment." };
  }
}

export async function deletePostAction(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const ctx = await requireUser();
  if (!ctx.has("admin") && !ctx.has("content-editor")) return { ok: false, error: "Only content editors and admins can delete news." };
  if (!z.uuid().safeParse(id).success) return { ok: false, error: "That post could not be found." };
  try {
    await deletePost(ctx, id);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not delete the post." };
  }
  refresh(id);
  return { ok: true };
}
