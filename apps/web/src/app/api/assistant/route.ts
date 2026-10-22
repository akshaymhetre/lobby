import { z } from "zod";
import { chat } from "@lobby/ai";
import { currentUser } from "@/server/auth";
import { ndjson } from "./stream";

const Body = z.object({ conversationId: z.string().uuid().optional(), text: z.string().min(1).max(4000) });

export async function POST(req: Request) {
  const ctx = await currentUser();
  if (!ctx) return Response.json({ error: "Sign in first." }, { status: 401 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid request." }, { status: 400 });
  return ndjson(chat(ctx, parsed.data));
}
