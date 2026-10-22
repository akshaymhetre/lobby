"use server";

import { revalidatePath } from "next/cache";
import { search } from "@lobby/core/search";
import { addComment, createTicket, HelpdeskError, searchPeople, setStatus } from "@lobby/core/helpdesk";
import { requireUser } from "@/server/auth";
import { queryTerms, rankLooseHits } from "./_deflection";

export type ActionResult<T = object> = ({ ok: true } & T) | { ok: false; error: string; fieldErrors?: Record<string, string> };

function fail(err: unknown, fallback: string): { ok: false; error: string; fieldErrors?: Record<string, string> } {
  if (err instanceof HelpdeskError) return { ok: false, error: err.message, fieldErrors: err.fieldErrors };
  console.error("[help]", err);
  return { ok: false, error: fallback };
}

export async function createRequest(input: {
  typeSlug: string;
  subject: string;
  description: string;
  fields: Record<string, unknown>;
}): Promise<ActionResult<{ number: number }>> {
  const ctx = await requireUser();
  try {
    const t = await createTicket(ctx, {
      requestTypeSlug: String(input.typeSlug ?? ""),
      subject: String(input.subject ?? ""),
      description: String(input.description ?? ""),
      fields: input.fields && typeof input.fields === "object" ? input.fields : {},
      source: "portal",
    });
    revalidatePath("/help");
    return { ok: true, number: t.number };
  } catch (err) {
    return fail(err, "We couldn't send that. Try again in a moment.");
  }
}

export interface DeflectionHit {
  title: string;
  snippet: string;
  url: string;
}

/**
 * Knowledge articles that might answer the request, filtered by what the user can see.
 * Pages matching every word are shown as they are. Otherwise the meaningful words are OR-ed and a
 * page is kept only when it is really about the subject (see `_deflection.ts`), so a summary that
 * matches nothing shows nothing rather than three pages that each contain one of its words.
 */
export async function suggestArticles(query: string): Promise<DeflectionHit[]> {
  const ctx = await requireUser();
  const q = String(query ?? "").trim().slice(0, 200);
  if (q.length < 3) return [];
  try {
    let hits = await search({ principals: ctx.principals, query: q, types: ["page"], limit: 3 });
    if (!hits.length) {
      const terms = queryTerms(q);
      if (terms.length > 1) {
        const loose = await search({ principals: ctx.principals, query: terms.join(" or "), types: ["page"], limit: 12 });
        hits = rankLooseHits(loose, terms);
      }
    }
    return hits.slice(0, 3).map((h) => ({ title: h.title, snippet: h.snippet, url: h.url }));
  } catch (err) {
    console.error("[help] deflection search failed", err);
    return [];
  }
}

export async function findPeople(query: string) {
  await requireUser();
  return searchPeople(String(query ?? "").slice(0, 100), 8);
}

export async function replyToRequest(ticketId: string, body: string): Promise<ActionResult> {
  const ctx = await requireUser();
  try {
    await addComment(ctx, String(ticketId), { body: String(body ?? ""), internal: false });
    revalidatePath("/help", "layout");
    return { ok: true };
  } catch (err) {
    return fail(err, "We couldn't send your reply. Try again in a moment.");
  }
}

/** Requesters can cancel an open request or close a resolved one. */
export async function closeRequest(ticketId: string): Promise<ActionResult> {
  const ctx = await requireUser();
  try {
    await setStatus(ctx, String(ticketId), "closed");
    revalidatePath("/help", "layout");
    return { ok: true };
  } catch (err) {
    return fail(err, "We couldn't close that request. Try again in a moment.");
  }
}
