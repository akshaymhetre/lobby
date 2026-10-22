import type Anthropic from "@anthropic-ai/sdk";
import { and, asc, db, eq, s } from "@lobby/db";
import type { Citation } from "@lobby/db/schema";
import { audit, getOrgSettings, type UserContext } from "@lobby/core";
import { search } from "@lobby/core/search";
import { getAiConfig, makeClient } from "./config";
import { systemPrompt } from "./prompt";
import { apiTools, toolByName, type Source } from "./tools";

type Block = Anthropic.Beta.BetaContentBlock;
type MessageParam = Anthropic.Beta.BetaMessageParam;
type ToolResult = Anthropic.Beta.BetaToolResultBlockParam;

export type AssistantEvent =
  | { type: "conversation"; id: string; title: string }
  | { type: "text"; delta: string }
  | { type: "tool"; name: string; label: string }
  | { type: "action"; action: { id: string; tool: string; summary: string; input: Record<string, unknown> } }
  | { type: "notice"; message: string }
  | { type: "done"; messageId: string | null; citations: Citation[] }
  | { type: "error"; message: string };

const MAX_STEPS = 8;

const TOOL_LABELS: Record<string, string> = {
  search_knowledge: "Searching the knowledge base",
  find_person: "Looking up people",
  find_app: "Checking your apps",
  list_my_tickets: "Checking your requests",
  list_request_types: "Reading the service catalog",
  my_onboarding_tasks: "Checking your onboarding tasks",
};

async function ensureConversation(ctx: UserContext, conversationId: string | undefined, firstText: string) {
  if (conversationId) {
    const conv = await db.query.aiConversations.findFirst({
      where: and(eq(s.aiConversations.id, conversationId), eq(s.aiConversations.userId, ctx.user.id)),
    });
    if (!conv) throw new Error("Conversation not found.");
    return conv;
  }
  const title = firstText.length > 60 ? `${firstText.slice(0, 57).trimEnd()}...` : firstText;
  const [conv] = await db.insert(s.aiConversations).values({ userId: ctx.user.id, title }).returning();
  return conv!;
}

async function history(conversationId: string): Promise<MessageParam[]> {
  const rows = await db
    .select()
    .from(s.aiMessages)
    .where(eq(s.aiMessages.conversationId, conversationId))
    .orderBy(asc(s.aiMessages.createdAt));
  return rows.map((r) => ({ role: r.role, content: r.blocks as MessageParam["content"] }));
}

async function saveMessage(conversationId: string, role: "user" | "assistant", text: string, blocks: unknown[], citations: Citation[] = []) {
  const [row] = await db.insert(s.aiMessages).values({ conversationId, role, text, blocks, citations }).returning({ id: s.aiMessages.id });
  await db.update(s.aiConversations).set({ updatedAt: new Date() }).where(eq(s.aiConversations.id, conversationId));
  return row!.id;
}

/** Sources the answer actually cites as [n]. */
function citedSources(text: string, sources: Source[]): Citation[] {
  const used = new Set([...text.matchAll(/\[(\d{1,2})\]/g)].map((m) => Number(m[1])));
  return sources
    .filter((src) => used.has(src.n))
    .map((src) => ({ sourceType: src.sourceType, sourceId: String(src.n), title: src.title, url: src.url }));
}

/** Starts or continues a conversation with a user message. Streams events. */
export async function* chat(ctx: UserContext, input: { conversationId?: string; text: string }): AsyncGenerator<AssistantEvent> {
  const text = input.text.trim().slice(0, 4000);
  if (!text) return yield { type: "error", message: "Ask a question first." };
  const cfg = await getAiConfig();
  if (!cfg.enabled) return yield { type: "error", message: "The assistant is turned off. An admin can enable it in Admin, AI assistant." };

  const conv = await ensureConversation(ctx, input.conversationId, text);
  yield { type: "conversation", id: conv.id, title: conv.title };
  await saveMessage(conv.id, "user", text, [{ type: "text", text }]);

  if (!cfg.apiKey) {
    yield* retrievalOnly(ctx, conv.id, text);
    return;
  }
  yield* runLoop(ctx, conv.id, []);
}

/** The user confirmed or cancelled an action the assistant proposed. Executes it, then lets the model continue. */
export async function* resolveAction(
  ctx: UserContext,
  input: { actionId: string; decision: "confirm" | "cancel" },
): AsyncGenerator<AssistantEvent> {
  const action = await db.query.aiActions.findFirst({
    where: and(eq(s.aiActions.id, input.actionId), eq(s.aiActions.userId, ctx.user.id)),
  });
  if (!action || action.status !== "proposed") return yield { type: "error", message: "That action is no longer waiting for you." };
  const tool = toolByName(action.tool);
  const toolUseId = String(action.result?.toolUseId ?? "");
  const resume = action.resume ?? { toolResults: [], sources: [] };
  let outcome: ToolResult;

  if (input.decision === "cancel" || !tool) {
    await db.update(s.aiActions).set({ status: "cancelled", decidedAt: new Date() }).where(eq(s.aiActions.id, action.id));
    await audit(ctx.user.id, "ai.action.cancelled", { type: "ai_action", id: action.id }, { tool: action.tool });
    outcome = { type: "tool_result", tool_use_id: toolUseId, content: "The user cancelled this action. Do not retry unless they ask.", is_error: true };
  } else {
    try {
      const parsed = tool.input.parse(action.input);
      const result = await (tool.run as (i: unknown, rc: { ctx: UserContext; sources: Source[] }) => Promise<string>)(parsed, {
        ctx,
        sources: resume.sources as Source[],
      });
      await db.update(s.aiActions).set({ status: "executed", decidedAt: new Date(), result: { ...action.result, toolUseId, output: result } }).where(eq(s.aiActions.id, action.id));
      await audit(ctx.user.id, "ai.action.executed", { type: "ai_action", id: action.id }, { tool: action.tool, input: action.input, result });
      outcome = { type: "tool_result", tool_use_id: toolUseId, content: result };
    } catch (err) {
      const message = err instanceof Error ? err.message : "The action failed.";
      await db.update(s.aiActions).set({ status: "failed", decidedAt: new Date(), result: { ...action.result, toolUseId, error: message } }).where(eq(s.aiActions.id, action.id));
      await audit(ctx.user.id, "ai.action.failed", { type: "ai_action", id: action.id }, { tool: action.tool, error: message });
      outcome = { type: "tool_result", tool_use_id: toolUseId, content: `The action failed: ${message}`, is_error: true };
    }
  }

  const blocks = [...(resume.toolResults as ToolResult[]), outcome];
  await saveMessage(action.conversationId, "user", "", blocks);
  const cfg = await getAiConfig();
  if (!cfg.apiKey) return yield { type: "done", messageId: null, citations: [] };
  yield* runLoop(ctx, action.conversationId, resume.sources as Source[]);
}

async function* runLoop(ctx: UserContext, conversationId: string, sources: Source[]): AsyncGenerator<AssistantEvent> {
  const cfg = await getAiConfig();
  const org = await getOrgSettings();
  const client = makeClient(cfg.apiKey!);
  const system = systemPrompt(org, ctx);
  const tools = apiTools();
  const rc = { ctx, sources };
  let answerText = "";
  let lastMessageId: string | null = null;

  try {
    for (let step = 0; step < MAX_STEPS; step++) {
      const messages = await history(conversationId);
      const stream = client.beta.messages.stream({
        model: cfg.model,
        max_tokens: 16000,
        system,
        tools,
        messages,
        thinking: { type: "adaptive" },
        output_config: { effort: "medium" },
        // Refused requests are retried on a suitable fallback model server-side.
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
      } as Parameters<typeof client.beta.messages.stream>[0]);

      for await (const event of stream) {
        if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
          answerText += event.delta.text;
          yield { type: "text", delta: event.delta.text };
        }
      }
      const final = await stream.finalMessage();
      const textOf = (blocks: Block[]) => blocks.filter((b) => b.type === "text").map((b) => (b as Anthropic.Beta.BetaTextBlock).text).join("");

      if (final.stop_reason === "refusal") {
        const note = "I can't help with that request.";
        lastMessageId = await saveMessage(conversationId, "assistant", note, [{ type: "text", text: note }]);
        yield { type: "text", delta: note };
        break;
      }

      const toolUses = final.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use");
      // The full content (thinking blocks included) is stored unchanged, so history replays append-only.
      lastMessageId = await saveMessage(conversationId, "assistant", textOf(final.content), final.content, citedSources(answerText, sources));

      if (!toolUses.length || final.stop_reason === "max_tokens") break;

      const results: ToolResult[] = [];
      let proposed: { id: string; tool: string; summary: string; input: Record<string, unknown> } | null = null;

      for (const use of toolUses) {
        const tool = toolByName(use.name);
        if (!tool) {
          results.push({ type: "tool_result", tool_use_id: use.id, content: `Unknown tool ${use.name}.`, is_error: true });
          continue;
        }
        const parsed = tool.input.safeParse(use.input);
        if (!parsed.success) {
          results.push({ type: "tool_result", tool_use_id: use.id, content: `Invalid input: ${parsed.error.message}`, is_error: true });
          continue;
        }
        if (tool.kind === "action") {
          if (proposed) {
            results.push({ type: "tool_result", tool_use_id: use.id, content: "Only one action can be confirmed at a time. Propose this again after the first one is decided.", is_error: true });
            continue;
          }
          const summary = (tool.summarize as (i: unknown) => string)(parsed.data);
          const [row] = await db
            .insert(s.aiActions)
            .values({
              conversationId,
              messageId: lastMessageId,
              userId: ctx.user.id,
              tool: tool.name,
              input: parsed.data as Record<string, unknown>,
              result: { toolUseId: use.id, summary },
            })
            .returning({ id: s.aiActions.id });
          proposed = { id: row!.id, tool: tool.name, summary, input: parsed.data as Record<string, unknown> };
          continue;
        }
        yield { type: "tool", name: tool.name, label: TOOL_LABELS[tool.name] ?? "Working" };
        try {
          const out = await (tool.run as (i: unknown, r: typeof rc) => Promise<string>)(parsed.data, rc);
          results.push({ type: "tool_result", tool_use_id: use.id, content: out });
        } catch (err) {
          results.push({ type: "tool_result", tool_use_id: use.id, content: `Tool failed: ${err instanceof Error ? err.message : "error"}`, is_error: true });
        }
      }

      if (proposed) {
        // Pause: the remaining tool results are held until the user decides on the action.
        await db.update(s.aiActions).set({ resume: { toolResults: results, sources } }).where(eq(s.aiActions.id, proposed.id));
        await audit(ctx.user.id, "ai.action.proposed", { type: "ai_action", id: proposed.id }, { tool: proposed.tool, input: proposed.input });
        yield { type: "action", action: proposed };
        return yield { type: "done", messageId: lastMessageId, citations: citedSources(answerText, sources) };
      }

      await saveMessage(conversationId, "user", "", results);
      if (answerText && !answerText.endsWith("\n")) {
        answerText += "\n\n";
        yield { type: "text", delta: "\n\n" };
      }
    }
    yield { type: "done", messageId: lastMessageId, citations: citedSources(answerText, sources) };
  } catch (err) {
    console.error("[assistant]", err);
    const AnthropicSdk = (await import("@anthropic-ai/sdk")).default;
    let message = "The assistant could not answer right now. Please try again.";
    if (err instanceof AnthropicSdk.AuthenticationError) message = "The AI provider rejected the API key. An admin needs to update it.";
    else if (err instanceof AnthropicSdk.RateLimitError) message = "The assistant is busy. Try again in a minute.";
    else if (err instanceof AnthropicSdk.APIError) message = `The AI provider returned an error (${err.status}).`;
    yield { type: "error", message };
  }
}

/** No API key configured: answer with the best matching pages instead of generated text. */
async function* retrievalOnly(ctx: UserContext, conversationId: string, text: string): AsyncGenerator<AssistantEvent> {
  yield { type: "notice", message: "Generated answers are not set up yet, so here are the most relevant pages." };
  yield { type: "tool", name: "search_knowledge", label: TOOL_LABELS.search_knowledge! };
  const hits = await search({ principals: ctx.principals, query: text, types: ["page", "request_type", "person", "app"], limit: 4 });
  let answer: string;
  const citations: Citation[] = [];
  if (!hits.length) {
    answer = "I could not find anything about that in the knowledge base. Try different words, or raise a request with the right team from Help.";
  } else {
    answer = hits
      .map((h, i) => {
        // Wave 3: the panel renders each hit as an answer card, so it needs the structured chunk
        // (tables and lists intact, to cut a clean excerpt client-side) and the page's freshness.
        // Extra keys on the jsonb citation; the Citation type's four fields are unchanged.
        const rich: Citation & { excerpt: string; freshness: number } = {
          sourceType: h.sourceType,
          sourceId: String(i + 1),
          title: h.title,
          url: h.url,
          excerpt: h.text.slice(0, 900),
          freshness: h.freshness,
        };
        citations.push(rich);
        // Snippets can cut through tables; flatten cell separators so the excerpt reads as prose.
        const snippet = h.snippet.replace(/\[\[|\]\]/g, "").replace(/\s*\|\s*/g, ", ").replace(/^,\s*|,\s*$/gm, "").replace(/\s+/g, " ").trim();
        return `**${h.title}** [${i + 1}]\n${snippet}${snippet.endsWith(".") ? "" : "..."}`;
      })
      .join("\n\n");
  }
  yield { type: "text", delta: answer };
  const id = await saveMessage(conversationId, "assistant", answer, [{ type: "text", text: answer }], citations);
  yield { type: "done", messageId: id, citations };
}

/** Deletes conversations older than the retention window. Run daily by the worker. */
export async function pruneConversations() {
  const cfg = await getAiConfig();
  const cutoff = new Date(Date.now() - cfg.retentionDays * 24 * 3600 * 1000);
  const { lt } = await import("@lobby/db");
  const removed = await db.delete(s.aiConversations).where(lt(s.aiConversations.updatedAt, cutoff)).returning({ id: s.aiConversations.id });
  return removed.length;
}
