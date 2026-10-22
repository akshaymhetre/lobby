import { getOrgSettings } from "@lobby/core";
import { aiKeySource, DEFAULT_AI_MODEL } from "@lobby/core/admin";
import { and, countDistinct, db, eq, gte, s as schema, sql } from "@lobby/db";
import { Page } from "@/components/page";
import { AiUsage } from "@/components/admin/ai-usage";
import { PageHeader } from "@/components/ui/page-header";
import { AiForm } from "@/components/admin/ai-form";
import { requireAdmin } from "@/server/auth";

export const metadata = { title: "AI assistant" };

export default async function AiPage() {
  await requireAdmin();
  const [{ ai }, usage] = await Promise.all([getOrgSettings(), askUsage()]);
  const keySource = aiKeySource(ai);
  return (
    <Page width="wide">
      <PageHeader title="AI assistant" description="Choose the model behind Ask and how long conversations are kept." />
      <AiForm
        initial={{
          enabled: ai?.enabled ?? false,
          model: ai?.model || DEFAULT_AI_MODEL,
          keySource,
          embeddingsProvider: ai?.embeddingsProvider ?? "none",
          embeddingsModel: ai?.embeddingsModel ?? "",
          hasEmbeddingsKey: !!ai?.embeddingsKeyEnc,
          retentionDays: ai?.retentionDays ?? 90,
        }}
        usage={<AiUsage {...usage} enabled={ai?.enabled ?? false} hasKey={keySource !== "none"} />}
      />
    </Page>
  );
}

/** Questions asked of Ask per day for the last 14 days, from its own tables. */
async function askUsage() {
  const since = new Date();
  since.setUTCHours(0, 0, 0, 0);
  since.setUTCDate(since.getUTCDate() - 13);
  const recent = and(eq(schema.aiMessages.role, "user"), gte(schema.aiMessages.createdAt, since));
  const [rows, [who], [cited]] = await Promise.all([
    db
      .select({ d: sql<string>`to_char(${schema.aiMessages.createdAt} at time zone 'UTC', 'YYYY-MM-DD')`, n: sql<number>`count(*)::int` })
      .from(schema.aiMessages)
      .where(recent)
      .groupBy(sql`1`),
    db
      .select({ n: countDistinct(schema.aiConversations.userId) })
      .from(schema.aiMessages)
      .innerJoin(schema.aiConversations, eq(schema.aiConversations.id, schema.aiMessages.conversationId))
      .where(recent),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(schema.aiMessages)
      .where(and(eq(schema.aiMessages.role, "assistant"), gte(schema.aiMessages.createdAt, since), sql`jsonb_array_length(${schema.aiMessages.citations}) > 0`)),
  ]);
  const by = new Map(rows.map((r) => [r.d, r.n]));
  const fmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
  const days = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(since.getTime() + i * 86_400_000);
    const key = d.toISOString().slice(0, 10);
    return { label: fmt.format(d), n: by.get(key) ?? 0, today: i === 13 };
  });
  return { days, questions: days.reduce((a, d) => a + d.n, 0), people: who?.n ?? 0, cited: cited?.n ?? 0 };
}
