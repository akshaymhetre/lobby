import type { AiSettings } from "@lobby/db/schema";
import { z } from "zod";
import { audit } from "../audit";
import { encrypt } from "../crypto";
import { env } from "../env";
import { getOrgSettings, updateOrgSettings } from "../settings";
import { ValidationError } from "./setup";

export const DEFAULT_AI_MODEL = "claude-opus-5-5";

export const AI_MODELS = [
  { id: "claude-opus-5-5", label: "Claude Opus 5.5", note: "Recommended" },
  { id: "claude-sonnet-5-5", label: "Claude Sonnet 5.5", note: "Faster, cheaper" },
  { id: "claude-haiku-5-5", label: "Claude Haiku 5.5", note: "Fastest" },
] as const;

export const aiInput = z.object({
  enabled: z.boolean(),
  /** Only Anthropic is supported in this release. */
  provider: z.literal("anthropic").default("anthropic"),
  model: z
    .string()
    .trim()
    .min(1, "Pick a model.")
    .max(100)
    .regex(/^[A-Za-z0-9._:\-/]+$/, "Model ids use letters, numbers, dots and dashes."),
  /** Blank keeps the saved key. */
  apiKey: z.string().trim().optional().default(""),
  clearApiKey: z.boolean().optional().default(false),
  embeddingsProvider: z.enum(["none", "voyage", "openai-compatible"]).default("none"),
  embeddingsModel: z.string().trim().max(100).optional().default(""),
  embeddingsKey: z.string().trim().optional().default(""),
  retentionDays: z.coerce.number().int("Use a whole number of days.").min(1, "Keep chats for at least 1 day.").max(3650, "The longest retention is 10 years."),
});
export type AiInput = z.input<typeof aiInput>;

export function aiKeySource(ai: AiSettings | null | undefined): "saved" | "environment" | "none" {
  if (ai?.apiKeyEnc) return "saved";
  if (env.anthropicApiKey) return "environment";
  return "none";
}

export async function saveAiSettings(actorId: string, input: AiInput): Promise<AiSettings> {
  const r = aiInput.safeParse(input);
  if (!r.success) {
    const errors: Record<string, string> = {};
    for (const issue of r.error.issues) errors[String(issue.path[0])] ??= issue.message;
    throw new ValidationError(errors);
  }
  const v = r.data;
  const prev = (await getOrgSettings()).ai;
  const apiKeyEnc = v.clearApiKey ? undefined : v.apiKey ? encrypt(v.apiKey) : prev?.apiKeyEnc;
  if (v.enabled && !apiKeyEnc && !env.anthropicApiKey) {
    throw new ValidationError({ apiKey: "Add an Anthropic API key to turn the assistant on." });
  }
  const ai: AiSettings = {
    enabled: v.enabled,
    provider: "anthropic",
    model: v.model,
    apiKeyEnc,
    embeddingsProvider: v.embeddingsProvider,
    embeddingsModel: v.embeddingsModel || undefined,
    embeddingsKeyEnc:
      v.embeddingsProvider === "none" ? undefined : v.embeddingsKey ? encrypt(v.embeddingsKey) : prev?.embeddingsKeyEnc,
    retentionDays: v.retentionDays,
  };
  await updateOrgSettings({ ai });
  await audit(actorId, "ai.settings_updated", { type: "org_settings", id: "1" }, {
    enabled: ai.enabled,
    model: ai.model,
    keyChanged: !!v.apiKey || v.clearApiKey,
    embeddingsProvider: ai.embeddingsProvider,
    retentionDays: ai.retentionDays,
  });
  return ai;
}
