"use client";

import * as React from "react";
import { ArrowUp, Paperclip, type LucideIcon } from "lucide-react";
import { openAssistant, SHELL_EVENTS } from "@/components/shell/shell-events";
import { NavIcon } from "@/components/shell/nav-icon";
import { CountUp, Words } from "@/components/ui/motion";
import { BorderBeam } from "@/components/ui/effects/border-beam";
import { Orb } from "@/components/ui/effects/orb";
import { cn } from "@/lib/cn";

const MAX = 300;

export interface AssistantSuggestion {
  label: string;
  prompt: string;
  icon: "help" | "people" | "knowledge" | "journeys" | "apps";
}

const DEFAULTS: AssistantSuggestion[] = [
  { label: "Parental leave", prompt: "How much parental leave do we get?", icon: "knowledge" },
  { label: "Get IT help", prompt: "I need help with my VPN connection", icon: "help" },
  { label: "Find a colleague", prompt: "Who runs payroll questions?", icon: "people" },
];

/**
 * The assistant's card on Home: the glossy orb (it breathes, and pulses while thinking),
 * "Welcome, Maya / What can I help with today?", suggestion chips and a composer. Sending opens
 * the real assistant panel with the question, so answers, sources and actions all live in one place.
 */
export function AssistantCard({ firstName, suggestions = DEFAULTS, className }: { firstName: string; suggestions?: AssistantSuggestion[]; className?: string }) {
  const [text, setText] = React.useState("");
  const [thinking, setThinking] = React.useState(false);
  const [panelOpen, setPanelOpen] = React.useState(false);
  const ref = React.useRef<HTMLTextAreaElement>(null);

  // While the assistant panel is open it carries the orb; the card stands down to its chips.
  React.useEffect(() => {
    const onState = (e: globalThis.Event) => setPanelOpen(!!(e as CustomEvent<{ open: boolean }>).detail?.open);
    window.addEventListener(SHELL_EVENTS.assistantState, onState);
    return () => window.removeEventListener(SHELL_EVENTS.assistantState, onState);
  }, []);

  const send = (prompt: string) => {
    const q = prompt.trim();
    if (!q) {
      ref.current?.focus();
      return;
    }
    setThinking(true);
    openAssistant(q);
    setText("");
    setTimeout(() => setThinking(false), 1800);
  };

  return (
    <section aria-labelledby="assistant-heading" className={cn("relative flex flex-col items-center overflow-hidden rounded-panel panel px-5 pb-5 pt-8 text-center sm:px-6", className)}>
      {/* the orb is the one sanctioned glossy object; it carries its own halo */}
      {panelOpen ? null : <Orb size={88} state={thinking ? "thinking" : "idle"} label={thinking ? "The assistant is thinking" : "The assistant"} className="relative" />}

      <h2 id="assistant-heading" className={cn("text-h2 font-medium text-fg", panelOpen ? "mt-0" : "mt-7")}>
        <Words text={`Welcome, ${firstName}`} delay={0.5} />
      </h2>
      <p className="mt-1 text-h3 font-medium text-fg">
        <Words text="What can I help with today?" delay={0.7} stagger={0.04} />
      </p>

      <ul className="mt-5 flex flex-wrap justify-center gap-2" aria-label="Suggestions">
        {suggestions.map((sg) => (
          <li key={sg.prompt}>
            <button
              type="button"
              onClick={() => send(sg.prompt)}
              className="focus-ring touch-target press inline-flex h-9 items-center gap-2 rounded-full bg-raised px-3.5 text-small font-medium text-fg shadow-cell hover:shadow-cell-hover"
            >
              <NavIcon name={sg.icon} className="size-4 text-muted" />
              {sg.label}
            </button>
          </li>
        ))}
      </ul>

      <form
        className="mt-5 w-full"
        onSubmit={(e) => {
          e.preventDefault();
          send(text);
        }}
      >
        <div className="cell relative isolate flex flex-col rounded-card p-2 pl-4 text-left transition-shadow duration-160 focus-within:outline-2 focus-within:outline-offset-0 focus-within:outline-accent-ring">
          {/* A quiet accent beam circles the composer while the assistant is thinking. */}
          <BorderBeam tone="accent" size="sm" intensity="subtle" loops="infinite" duration={2} active={thinking} />
          <label htmlFor="home-assistant-input" className="sr-only">
            Ask anything
          </label>
          <div className="flex items-end gap-2">
            <textarea
              id="home-assistant-input"
              ref={ref}
              rows={1}
              value={text}
              maxLength={MAX}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  send(text);
                }
              }}
              placeholder="Ask me anything"
              className="max-h-32 min-h-9 flex-1 resize-none bg-transparent py-2 text-body-lg text-fg outline-none placeholder:text-subtle md:text-body"
            />
            <button
              type="submit"
              aria-label="Send to the assistant"
              className={cn(
                "focus-ring touch-target press inline-flex size-9 shrink-0 items-center justify-center rounded-full transition-colors duration-160",
                text.trim() ? "bg-accent text-accent-fg shadow-cell" : "bg-sunken text-muted",
              )}
            >
              <ArrowUp className="size-4 stroke-[2]" aria-hidden />
            </button>
          </div>
          <div className="mt-1 flex items-center justify-between gap-2 pr-1">
            <ToolChip icon={Paperclip} label="Attach file" onClick={() => send(text || "I want to attach a file to a request")} />
            <span className="text-caption tabular-nums text-subtle" aria-live="polite">
              <CountUp value={text.length} duration={0.2} />/{MAX}
            </span>
          </div>
        </div>
      </form>
    </section>
  );
}

function ToolChip({ icon: Icon, label, onClick }: { icon: LucideIcon; label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="focus-ring touch-target inline-flex h-8 items-center gap-1.5 rounded-full bg-sunken px-3 text-caption font-medium text-muted transition-colors hover:bg-hover hover:text-fg">
      <Icon className="size-3.5 stroke-[1.75]" aria-hidden />
      {label}
    </button>
  );
}
