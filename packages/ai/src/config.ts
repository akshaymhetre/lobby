import Anthropic from "@anthropic-ai/sdk";
import { decrypt, env, getOrgSettings } from "@lobby/core";

export const DEFAULT_MODEL = "claude-opus-5-5";

export interface AiRuntimeConfig {
  enabled: boolean;
  model: string;
  /** Resolved key: the admin-saved key, else ANTHROPIC_API_KEY. Null means retrieval-only mode. */
  apiKey: string | null;
  retentionDays: number;
}

export async function getAiConfig(): Promise<AiRuntimeConfig> {
  const org = await getOrgSettings();
  const ai = org.ai;
  let apiKey: string | null = null;
  if (ai?.apiKeyEnc) {
    try {
      apiKey = decrypt(ai.apiKeyEnc);
    } catch {
      apiKey = null;
    }
  }
  apiKey ??= env.anthropicApiKey || null;
  return {
    enabled: ai?.enabled ?? false,
    model: ai?.model || DEFAULT_MODEL,
    apiKey,
    retentionDays: ai?.retentionDays ?? 90,
  };
}

export const makeClient = (apiKey: string) => new Anthropic({ apiKey, maxRetries: 2, timeout: 120_000 });

/** A tiny real request to prove the key and model work. Used by the admin AI settings page. */
export async function testAiConnection(opts: { apiKey?: string; model?: string } = {}) {
  const cfg = await getAiConfig();
  const apiKey = opts.apiKey || cfg.apiKey;
  const model = opts.model || cfg.model;
  if (!apiKey) return { ok: false as const, error: "No API key is configured." };
  const started = Date.now();
  try {
    const res = await makeClient(apiKey).messages.create({
      model,
      max_tokens: 256,
      output_config: { effort: "low" },
      messages: [{ role: "user", content: "Reply with the single word: ready" }],
    });
    return { ok: true as const, model: res.model, latencyMs: Date.now() - started };
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) return { ok: false as const, error: "The API key was rejected." };
    if (err instanceof Anthropic.NotFoundError) return { ok: false as const, error: `Model "${model}" was not found for this key.` };
    if (err instanceof Anthropic.RateLimitError) return { ok: false as const, error: "Rate limited. Try again in a minute." };
    if (err instanceof Anthropic.APIError) return { ok: false as const, error: `API error ${err.status}: ${err.message}` };
    return { ok: false as const, error: err instanceof Error ? err.message : "Unknown error" };
  }
}
