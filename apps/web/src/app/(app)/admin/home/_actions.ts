"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  acknowledgementReport, ContentError, deleteAnnouncement, deleteHomeCard, moveHomeCard, saveAnnouncement, saveHomeCard,
} from "@lobby/core/home";
import { requireAdmin } from "@/server/auth";

export type AdminHomeResult<T = object> = ({ ok: true } & T) | { ok: false; error: string; fieldErrors?: Record<string, string> };

const id = z.uuid();

function refresh() {
  revalidatePath("/admin/home");
  revalidatePath("/");
}

function failure(e: unknown, fallback: string): { ok: false; error: string; fieldErrors?: Record<string, string> } {
  if (e instanceof ContentError) return { ok: false, error: e.message, fieldErrors: e.fieldErrors };
  console.error("[admin/home]", e);
  return { ok: false, error: fallback };
}

const announcementSchema = z.object({
  id: id.optional(),
  title: z.string().max(500),
  body: z.string().max(5000),
  severity: z.enum(["info", "important", "critical"]),
  mustAcknowledge: z.boolean(),
  audienceGroupIds: z.array(id).max(100),
  /** ISO strings from datetime-local inputs, converted in the browser. */
  startsAt: z.string(),
  endsAt: z.string().nullable(),
});

export async function saveAnnouncementAction(input: z.input<typeof announcementSchema>): Promise<AdminHomeResult<{ id: string }>> {
  const ctx = await requireAdmin();
  const parsed = announcementSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Check the form and try again." };
  const { id: annId, startsAt, endsAt, ...rest } = parsed.data;
  try {
    const row = await saveAnnouncement(ctx, annId ?? null, {
      ...rest,
      startsAt: new Date(startsAt),
      endsAt: endsAt ? new Date(endsAt) : null,
    });
    refresh();
    return { ok: true, id: row.id };
  } catch (e) {
    return failure(e, "Could not save the announcement.");
  }
}

export async function deleteAnnouncementAction(annId: string): Promise<AdminHomeResult> {
  const ctx = await requireAdmin();
  if (!id.safeParse(annId).success) return { ok: false, error: "That announcement could not be found." };
  try {
    await deleteAnnouncement(ctx, annId);
    refresh();
    return { ok: true };
  } catch (e) {
    return failure(e, "Could not delete the announcement.");
  }
}

export interface ReportPerson {
  id: string;
  name: string;
  title: string | null;
  department: string | null;
  avatarUrl: string | null;
  at?: string;
}

export async function acknowledgementReportAction(
  annId: string,
): Promise<AdminHomeResult<{ total: number; acknowledged: ReportPerson[]; pending: ReportPerson[] }>> {
  const ctx = await requireAdmin();
  if (!id.safeParse(annId).success) return { ok: false, error: "That announcement could not be found." };
  const report = await acknowledgementReport(ctx, annId);
  if (!report) return { ok: false, error: "That announcement no longer exists." };
  return {
    ok: true,
    total: report.total,
    acknowledged: report.acknowledged.map((p) => ({ ...p, at: p.at.toISOString() })),
    pending: report.pending,
  };
}

const cardSchema = z.object({
  id: id.optional(),
  type: z.enum(["links", "kpi", "embed"]),
  title: z.string().max(200),
  config: z.record(z.string(), z.unknown()),
  audienceGroupIds: z.array(id).max(100),
});

export async function saveHomeCardAction(input: z.input<typeof cardSchema>): Promise<AdminHomeResult<{ id: string }>> {
  const ctx = await requireAdmin();
  const parsed = cardSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Check the form and try again." };
  const { id: cardId, ...rest } = parsed.data;
  try {
    const row = await saveHomeCard(ctx, cardId ?? null, rest);
    refresh();
    return { ok: true, id: row.id };
  } catch (e) {
    return failure(e, "Could not save the card.");
  }
}

export async function deleteHomeCardAction(cardId: string): Promise<AdminHomeResult> {
  const ctx = await requireAdmin();
  if (!id.safeParse(cardId).success) return { ok: false, error: "That card could not be found." };
  try {
    await deleteHomeCard(ctx, cardId);
    refresh();
    return { ok: true };
  } catch (e) {
    return failure(e, "Could not delete the card.");
  }
}

export async function moveHomeCardAction(cardId: string, delta: -1 | 1): Promise<AdminHomeResult> {
  const ctx = await requireAdmin();
  if (!id.safeParse(cardId).success || (delta !== -1 && delta !== 1)) return { ok: false, error: "Could not move that card." };
  try {
    await moveHomeCard(ctx, cardId, delta);
    refresh();
    return { ok: true };
  } catch (e) {
    return failure(e, "Could not move the card.");
  }
}
