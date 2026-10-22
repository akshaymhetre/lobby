import { and, asc, db, desc, eq, s } from "@lobby/db";
import { currentUser } from "@/server/auth";

/** GET: the user's recent conversations. GET ?id=: one conversation's visible messages and pending action. */
export async function GET(req: Request) {
  const ctx = await currentUser();
  if (!ctx) return Response.json({ error: "Sign in first." }, { status: 401 });
  const id = new URL(req.url).searchParams.get("id");
  if (!id) {
    const rows = await db
      .select({ id: s.aiConversations.id, title: s.aiConversations.title, updatedAt: s.aiConversations.updatedAt })
      .from(s.aiConversations)
      .where(eq(s.aiConversations.userId, ctx.user.id))
      .orderBy(desc(s.aiConversations.updatedAt))
      .limit(30);
    return Response.json({ conversations: rows });
  }
  const conv = await db.query.aiConversations.findFirst({
    where: and(eq(s.aiConversations.id, id), eq(s.aiConversations.userId, ctx.user.id)),
  });
  if (!conv) return Response.json({ error: "Not found." }, { status: 404 });
  const messages = await db
    .select({ id: s.aiMessages.id, role: s.aiMessages.role, text: s.aiMessages.text, citations: s.aiMessages.citations })
    .from(s.aiMessages)
    .where(eq(s.aiMessages.conversationId, id))
    .orderBy(asc(s.aiMessages.createdAt));
  const actions = await db
    .select({ id: s.aiActions.id, tool: s.aiActions.tool, input: s.aiActions.input, status: s.aiActions.status, messageId: s.aiActions.messageId, result: s.aiActions.result })
    .from(s.aiActions)
    .where(eq(s.aiActions.conversationId, id));
  return Response.json({ conversation: conv, messages: messages.filter((m) => m.text), actions });
}
