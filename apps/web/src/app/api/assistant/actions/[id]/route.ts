import { z } from "zod";
import { resolveAction } from "@lobby/ai";
import { currentUser } from "@/server/auth";
import { ndjson } from "../../stream";

const Body = z.object({ decision: z.enum(["confirm", "cancel"]) });

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await currentUser();
  if (!ctx) return Response.json({ error: "Sign in first." }, { status: 401 });
  const { id } = await params;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success || !z.string().uuid().safeParse(id).success) return Response.json({ error: "Invalid request." }, { status: 400 });
  return ndjson(resolveAction(ctx, { actionId: id, decision: parsed.data.decision }));
}
