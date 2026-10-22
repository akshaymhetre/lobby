"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { CircleAlert, CircleCheck, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { HeroLight } from "@/components/ui/hero-light";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Orb } from "@/components/ui/effects/orb";
import { BorderBeam } from "@/components/ui/effects/border-beam";
import { ShimmerText } from "@/components/ui/effects/shimmer-text";
import { BlurIn, CountUp } from "@/components/ui/motion";
import { saveAiAction, testAiAction, type AiTestResult } from "@/app/(app)/admin/_actions";
import { cn } from "@/lib/cn";
import { FormError, fieldError, useActionFeedback } from "./form-status";
import { SaveBar } from "./save-bar";
import { SettingsGroup } from "./settings-group";

export interface AiValues {
  enabled: boolean;
  model: string;
  keySource: "saved" | "environment" | "none";
  embeddingsProvider: "none" | "voyage" | "openai-compatible";
  embeddingsModel: string;
  hasEmbeddingsKey: boolean;
  retentionDays: number;
}

/** A relative scale between the three models (1 to 5), for comparing at a glance; not a benchmark. */
const MODELS = [
  { id: "claude-opus-5-5", label: "Claude Opus 5.5", note: "The most capable", scale: { Depth: 5, Speed: 2, Cost: 5 } },
  { id: "claude-sonnet-5-5", label: "Claude Sonnet 5.5", note: "Faster, cheaper", scale: { Depth: 4, Speed: 4, Cost: 3 } },
  { id: "claude-haiku-5-5", label: "Claude Haiku 5.5", note: "Fastest", scale: { Depth: 3, Speed: 5, Cost: 1 } },
];

export function AiForm({ initial, usage }: { initial: AiValues; /** The usage panel, shown inside the hero. */ usage?: React.ReactNode }) {
  const [state, action, pending] = useActionState(saveAiAction, null);
  useActionFeedback(state);
  const known = MODELS.some((m) => m.id === initial.model);
  const [enabled, setEnabled] = useState(initial.enabled);
  const [modelChoice, setModelChoice] = useState(known ? initial.model : "custom");
  const [customModel, setCustomModel] = useState(known ? "" : initial.model);
  const [apiKey, setApiKey] = useState("");
  const [clearKey, setClearKey] = useState(false);
  const [embeddings, setEmbeddings] = useState(initial.embeddingsProvider);
  const [test, setTest] = useState<AiTestResult | null>(null);
  const [testing, startTest] = useTransition();
  const model = modelChoice === "custom" ? customModel : modelChoice;
  const [dirty, setDirty] = useState(false);
  useEffect(() => {
    if (state?.ok) setDirty(false);
  }, [state]);

  const missingKey = enabled && initial.keySource === "none" && !apiKey.trim();
  const keyHelp =
    initial.keySource === "saved"
      ? "A key is saved and encrypted. Type a new one to replace it."
      : initial.keySource === "environment"
        ? "Using ANTHROPIC_API_KEY from the server environment. Type a key here to use a different one."
        : "Create one in the Anthropic Console under API keys. Stored encrypted, never shown again.";

  const answering = enabled && (initial.keySource !== "none" || !!apiKey.trim());
  const verdict = !enabled ? "Ask is off for everyone" : answering ? "Ask is answering questions" : "Ask is on, but cannot answer";
  const sub = !enabled
    ? "Search still works. Switch it on to let people ask in plain words."
    : answering
      ? `${MODELS.find((m) => m.id === model)?.label ?? model} answers from your pages, people and apps. It only sees what the person asking can see.`
      : "New questions fail until an API key is saved. Add one below and it answers at once.";

  return (
    <form action={action} onChange={() => setDirty(true)} className="section-stack max-sm:overflow-x-clip max-sm:pb-2">
      <FormError state={state} />
      {/* The hero: the assistant's face, its verdict and its switch, beside what it actually did. The light is the state:
          red while it is on and cannot answer, green while it answers, a quiet blue while it is off. */}
      <section aria-labelledby="ai-verdict" className="relative isolate overflow-hidden rounded-panel panel dark:glass">
        <HeroLight tone={!enabled ? "blue" : answering ? "green" : "red"} position="top-left" />
        <div className={cn("grid gap-8 p-6 sm:p-8", usage && "xl:grid-cols-[minmax(0,1fr)_minmax(0,420px)] xl:items-center xl:gap-12")}>
          <div className="flex min-w-0 flex-col gap-5 sm:flex-row sm:items-start">
            {/* The orb shows the state too: dim when off, and dimmed inside a coral ring when it is on but cannot answer. */}
            <span className={cn("relative shrink-0 self-start rounded-full", enabled && !answering && "shadow-[0_0_0_3px_var(--lb-cat-coral-to),0_0_32px_-2px_var(--lb-cat-coral-from)]")}>
              <Orb
                size={88}
                state={testing ? "thinking" : test?.ok ? "done" : "idle"}
                label={!enabled ? "Ask is off" : answering ? "Ask is on" : "Ask is on but cannot answer"}
                className={cn("transition-[opacity,filter] duration-240", !enabled && "opacity-50 saturate-50", enabled && !answering && "brightness-90 saturate-[0.35]")}
              />
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <h2 id="ai-verdict" className="text-balance text-h2 font-medium text-fg md:text-hero">
                {verdict}
              </h2>
              <p className="max-w-lg text-row text-muted text-pretty">{sub}</p>
              <div className="mt-2 flex items-center gap-3">
                <Switch
                  id="ai-enabled"
                  name="enabled"
                  checked={enabled}
                  onCheckedChange={(v) => {
                    setEnabled(v);
                    setDirty(true);
                  }}
                />
                <label htmlFor="ai-enabled" className="cursor-pointer text-body font-medium text-fg">
                  Ask, the AI assistant, for everyone
                </label>
              </div>
            </div>
          </div>
          {usage}
        </div>
      </section>

      <SettingsGroup title="Model" description="Anthropic's models. More providers come in a later release." state={<Badge tone="neutral" dot>Provider: Anthropic</Badge>}>
        <input type="hidden" name="provider" value="anthropic" />
        <input type="hidden" name="modelChoice" value={modelChoice} />
        {/* Three models as three cards to compare at a glance: how deep, how fast, how costly, on one scale. */}
        <ul className="grid gap-3 sm:grid-cols-3" aria-label="Model">
          {MODELS.map((m) => {
            const on = modelChoice === m.id;
            return (
              <li key={m.id} className="min-w-0">
                <button
                  type="button"
                  aria-pressed={on}
                  onClick={() => {
                    setModelChoice(m.id);
                    setTest(null);
                    setDirty(true);
                  }}
                  className={cn(
                    "focus-ring press relative flex h-full w-full flex-col gap-4 rounded-card p-4 text-left",
                    on ? "bg-raised shadow-[var(--lb-shadow-cell),0_0_0_2px_var(--lb-accent-ring)]" : "bg-surface shadow-cell hover:bg-raised hover:shadow-cell-hover",
                  )}
                >
                  <span className="flex items-start justify-between gap-2">
                    <span className="flex min-w-0 flex-col">
                      <span className="text-row font-medium text-fg">{m.label}</span>
                      <span className="text-caption text-muted">{m.note}</span>
                    </span>
                    <span aria-hidden className={cn("grid size-5 shrink-0 place-items-center rounded-full shadow-inset", on ? "bg-accent" : "bg-sunken")}>
                      {on ? <span className="size-2 rounded-full bg-accent-fg" /> : null}
                    </span>
                  </span>
                  <span className="flex flex-col gap-1.5">
                    {(["Depth", "Speed", "Cost"] as const).map((k) => (
                      <span key={k} className="flex items-center justify-between gap-3 text-caption text-muted">
                        {k}
                        <span className="flex gap-1" aria-label={`${k} ${m.scale[k]} of 5`}>
                          {[1, 2, 3, 4, 5].map((d) => (
                            <span key={d} className={cn("h-1.5 w-3.5 rounded-full", d <= m.scale[k] ? (k === "Cost" ? "bg-cat-amber" : "bg-accent") : "bg-sunken shadow-inset")} />
                          ))}
                        </span>
                      </span>
                    ))}
                  </span>
                  {m.id === "claude-opus-5-5" ? <Badge tone="accent" size="sm" className="self-start">Recommended</Badge> : null}
                </button>
              </li>
            );
          })}
        </ul>
        <Button
          type="button"
          variant="link"
          size="sm"
          className="self-start"
          aria-pressed={modelChoice === "custom"}
          onClick={() => {
            setModelChoice(modelChoice === "custom" ? MODELS[0]!.id : "custom");
            setTest(null);
            setDirty(true);
          }}
        >
          {modelChoice === "custom" ? "Use one of these models" : "Use another model id"}
        </Button>
        {modelChoice === "custom" ? (
          <Field label="Model id" help="Exactly as Anthropic names it." error={fieldError(state, "model")}>
            <Input name="customModel" value={customModel} onChange={(e) => setCustomModel(e.target.value)} spellCheck={false} placeholder="claude-opus-5-5" className="sm:max-w-[320px]" />
          </Field>
        ) : fieldError(state, "model") ? (
          <p className="text-small text-danger-text">{fieldError(state, "model")}</p>
        ) : null}
      </SettingsGroup>

      <SettingsGroup
        title="API key"
        description="Stored encrypted and never shown again."
        state={
          initial.keySource === "saved" ? (
            <Badge tone="success" dot>Key saved</Badge>
          ) : initial.keySource === "environment" ? (
            <Badge tone="success" dot>From the server environment</Badge>
          ) : (
            <Badge tone="danger" dot>No key</Badge>
          )
        }
        cellClassName={cn(missingKey && "relative isolate")}
      >
        {/* With Ask switched on and no key anywhere, every question fails: the key field is the one thing that needs the admin. */}
        {missingKey ? <BorderBeam settle="none" tone="danger" loops={2} intensity="vivid" delay={0.6} /> : null}
        <Field label="Anthropic API key" help={keyHelp} error={fieldError(state, "apiKey")}>
          <Input
            name="apiKey"
            type="password"
            autoComplete="off"
            value={apiKey}
            onChange={(e) => { setApiKey(e.target.value); setTest(null); }}
            placeholder={initial.keySource === "saved" ? "Configured" : initial.keySource === "environment" ? "Using the environment key" : "sk-ant-..."}
            className="sm:max-w-[420px]"
          />
        </Field>
        {initial.keySource === "saved" ? (
          <div className="flex flex-wrap items-center gap-2">
            <input type="hidden" name="clearApiKey" value={clearKey ? "1" : "0"} />
            <Button type="button" variant="link" size="sm" onClick={() => setClearKey((c) => !c)}>
              {clearKey ? "Keep the saved key" : "Remove the saved key"}
            </Button>
            {clearKey ? <span className="text-small text-muted">Removed when you save.</span> : null}
          </div>
        ) : null}
        <div className="flex flex-col gap-3 rounded-card bg-sunken/70 p-4 shadow-inset">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 flex-col">
              <span className="text-row font-medium text-fg">Test with a real request</span>
              {testing ? (
                <ShimmerText active className="text-small">Asking {model || "the model"} for one short answer</ShimmerText>
              ) : (
                <span className="text-small text-muted">Sends one short message to {model || "the model"}. Costs a fraction of a cent.</span>
              )}
            </div>
            <Button
              type="button"
              variant="secondary"
              loading={testing}
              disabled={initial.keySource === "none" && !apiKey.trim()}
              title={initial.keySource === "none" && !apiKey.trim() ? "Add an API key first" : undefined}
              onClick={() => startTest(async () => setTest(await testAiAction({ apiKey: apiKey || undefined, model })))}
            >
              <Zap aria-hidden />
              Test
            </Button>
          </div>
          {test ? (
            test.ok ? (
              <BlurIn role="status" className="flex items-center gap-2 text-small text-success-text">
                <CircleCheck className="size-4 stroke-[1.5]" aria-hidden />
                <span>
                  {test.model} answered in <CountUp value={test.latencyMs} duration={0.6} suffix=" ms" className="font-medium" />.
                </span>
              </BlurIn>
            ) : (
              <BlurIn role="alert" className="flex items-start gap-2 text-small text-danger-text">
                <CircleAlert className="mt-px size-4 shrink-0 stroke-[1.5]" aria-hidden />
                <span className="break-words">{test.error}</span>
              </BlurIn>
            )
          ) : null}
        </div>
      </SettingsGroup>

      <SettingsGroup title="Search and memory" description="Search works without embeddings; they improve recall. Older conversations are deleted on schedule.">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Embeddings" controlId="ai-embeddings" help="None keeps everything on this server.">
            <Select value={embeddings} onValueChange={(v) => { setEmbeddings(v as AiValues["embeddingsProvider"]); setDirty(true); }} name="embeddingsProvider">
              <SelectTrigger id="ai-embeddings">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                <SelectItem value="voyage">Voyage AI</SelectItem>
                <SelectItem value="openai-compatible">OpenAI-compatible</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Keep chats for" help="Older conversations are deleted automatically." error={fieldError(state, "retentionDays")}>
            <Input name="retentionDays" type="number" min={1} max={3650} defaultValue={initial.retentionDays} trailing={<span className="text-small">days</span>} className="sm:max-w-[200px]" />
          </Field>
          {embeddings !== "none" ? (
            <>
              <Field label="Embeddings model" help={embeddings === "voyage" ? "For example voyage-3.5" : "For example text-embedding-3-small"}>
                <Input name="embeddingsModel" defaultValue={initial.embeddingsModel} spellCheck={false} />
              </Field>
              <Field label="Embeddings API key" help={initial.hasEmbeddingsKey ? "Saved. Leave blank to keep it." : "Stored encrypted."}>
                <Input name="embeddingsKey" type="password" autoComplete="off" placeholder={initial.hasEmbeddingsKey ? "Configured" : ""} />
              </Field>
            </>
          ) : null}
        </div>
      </SettingsGroup>

      <SaveBar dirty={dirty}>
        <Button type="submit" loading={pending}>
          Save assistant settings
        </Button>
      </SaveBar>
    </form>
  );
}
