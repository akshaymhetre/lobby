"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowUp, History, Loader2, MessageSquare, Plus, RotateCw, Square, X } from "lucide-react";
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ActionCard, type PendingAction } from "@/components/assistant/action-card";
import { AnswerCards, parseRetrieval, SourceList, type Citation } from "@/components/assistant/sources";
import { BlurIn, Reveal, RevealItem } from "@/components/ui/motion";
import { Orb, type OrbState } from "@/components/ui/effects/orb";
import { StreamText } from "@/components/ui/effects/stream-text";
import { cn } from "@/lib/cn";
import { timeAgo } from "@/lib/time";
import { SHELL_EVENTS } from "./shell-events";
import { ShimmerText } from "@/components/ui/effects/shimmer-text";

interface Turn {
  id: string;
  role: "user" | "assistant";
  text: string;
  citations: Citation[];
  status?: string;
  notice?: string;
  error?: string;
  action?: PendingAction;
  streaming?: boolean;
}
type Event =
  | { type: "conversation"; id: string; title: string }
  | { type: "text"; delta: string }
  | { type: "tool"; name: string; label: string }
  | { type: "action"; action: Omit<PendingAction, "state"> }
  | { type: "notice"; message: string }
  | { type: "done"; messageId: string | null; citations: Citation[] }
  | { type: "error"; message: string };

const SUGGESTIONS = [
  "How much parental leave do we get?",
  "How do I set up the VPN?",
  "Who runs payroll questions?",
  "I need access to Figma",
];

/** Above this width the panel docks beside the page (no scrim, page content moves over) instead of overlaying it. */
const DOCK_QUERY = "(min-width: 1280px)";
/** Classes applied to <main> while the panel is docked, so the page keeps its full width beside the panel. */
const MAIN_DOCKED = ["pr-[28rem]", "transition-[padding]", "duration-240", "ease-standard"];

const uid = () => Math.random().toString(36).slice(2);

/**
 * The assistant. Opens from the top bar, from Cmd-K ("Ask AI") or from deflection on the help form.
 * Under 1280px it is a sheet over the page; from 1280px it docks as a side panel below the top bar
 * and the page moves over, as the kernel's layout model describes.
 */
export function AssistantPanel({ isAdmin = false }: { isAdmin?: boolean }) {
  const [open, setOpen] = useState(false);
  const [docked, setDocked] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<{ id: string; title: string; updatedAt: string }[] | null>(null);
  // True for a moment after an answer lands, so the orb can settle before it rests.
  const [landed, setLanded] = useState(false);
  const wasBusy = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const patchLast = useCallback((fn: (t: Turn) => Turn) => {
    setTurns((ts) => (ts.length ? [...ts.slice(0, -1), fn(ts[ts.length - 1]!)] : ts));
  }, []);

  const consume = useCallback(
    async (res: Response) => {
      if (!res.ok || !res.body) {
        const body = await res.json().catch(() => ({ error: "The assistant is unavailable." }));
        patchLast((t) => ({ ...t, streaming: false, status: undefined, error: body.error ?? "The assistant is unavailable." }));
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const ev = JSON.parse(line) as Event;
          if (ev.type === "conversation") setConversationId(ev.id);
          else if (ev.type === "text") patchLast((t) => ({ ...t, text: t.text + ev.delta, status: undefined }));
          else if (ev.type === "tool") patchLast((t) => ({ ...t, status: ev.label }));
          else if (ev.type === "notice") {
            // Retrieval-only mode: the answer carries one quiet chip saying so (wave 3), not a header banner.
            patchLast((t) => ({ ...t, notice: ev.message }));
          } else if (ev.type === "action") patchLast((t) => ({ ...t, action: { ...ev.action, state: "waiting" } }));
          else if (ev.type === "done") patchLast((t) => ({ ...t, streaming: false, status: undefined, citations: ev.citations }));
          else if (ev.type === "error") patchLast((t) => ({ ...t, streaming: false, status: undefined, error: ev.message }));
        }
      }
      patchLast((t) => ({ ...t, streaming: false, status: undefined }));
    },
    [patchLast],
  );

  const send = useCallback(
    async (text: string) => {
      const q = text.trim();
      if (busy) return;
      if (!q) {
        inputRef.current?.focus();
        return;
      }
      setInput("");
      setBusy(true);
      setTurns((ts) => [
        ...ts,
        { id: uid(), role: "user", text: q, citations: [] },
        { id: uid(), role: "assistant", text: "", citations: [], streaming: true, status: "Thinking" },
      ]);
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      try {
        const res = await fetch("/api/assistant", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ text: q, conversationId: conversationId ?? undefined }),
          signal: ctrl.signal,
        });
        await consume(res);
      } catch (err) {
        if ((err as Error).name !== "AbortError") patchLast((t) => ({ ...t, streaming: false, error: "Connection lost. Try again." }));
        else patchLast((t) => ({ ...t, streaming: false, status: undefined }));
      } finally {
        setBusy(false);
        abortRef.current = null;
      }
    },
    [busy, conversationId, consume, patchLast],
  );

  const decide = useCallback(
    async (turnId: string, action: PendingAction, decision: "confirm" | "cancel") => {
      setBusy(true);
      setTurns((ts) =>
        ts.map((t) => (t.id === turnId && t.action ? { ...t, action: { ...t.action, state: "working" } } : t)),
      );
      setTurns((ts) => [...ts, { id: uid(), role: "assistant", text: "", citations: [], streaming: true, status: decision === "confirm" ? "Submitting" : "Okay" }]);
      try {
        const res = await fetch(`/api/assistant/actions/${action.id}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ decision }),
        });
        setTurns((ts) =>
          ts.map((t) => (t.id === turnId && t.action ? { ...t, action: { ...t.action, state: decision === "confirm" ? "confirmed" : "cancelled" } } : t)),
        );
        await consume(res);
      } finally {
        setBusy(false);
      }
    },
    [consume],
  );

  const newChat = () => {
    abortRef.current?.abort();
    setTurns([]);
    setConversationId(null);
    setInput("");
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const loadConversation = async (id: string) => {
    const res = await fetch(`/api/assistant/conversations?id=${id}`);
    if (!res.ok) return;
    const data = (await res.json()) as {
      messages: { id: string; role: "user" | "assistant"; text: string; citations: Citation[] }[];
      actions: { id: string; tool: string; status: string; messageId: string | null; input: Record<string, unknown>; result: { summary?: string } | null }[];
    };
    setConversationId(id);
    setTurns(
      data.messages.map((m) => {
        const a = data.actions.find((x) => x.messageId === m.id);
        return {
          id: m.id,
          role: m.role,
          text: m.text,
          citations: m.citations,
          action: a
            ? {
                id: a.id,
                tool: a.tool,
                input: a.input,
                summary: a.result?.summary ?? a.tool,
                state: a.status === "proposed" ? "waiting" : a.status === "executed" ? "confirmed" : "cancelled",
              }
            : undefined,
        };
      }),
    );
  };

  // Tell the page when the panel opens and closes, so the Home card can stand down while it is open.
  useEffect(() => {
    window.dispatchEvent(new CustomEvent(SHELL_EVENTS.assistantState, { detail: { open } }));
  }, [open]);

  // Listen for "open the assistant" from anywhere in the app.
  useEffect(() => {
    const onOpen = (e: Event | globalThis.Event) => {
      const prompt = (e as CustomEvent<{ prompt?: string }>).detail?.prompt;
      setOpen(true);
      if (prompt) {
        setTurns([]);
        setConversationId(null);
        setTimeout(() => void send(prompt), 50);
      } else {
        setTimeout(() => inputRef.current?.focus(), 80);
      }
    };
    window.addEventListener(SHELL_EVENTS.openAssistant, onOpen);
    return () => window.removeEventListener(SHELL_EVENTS.openAssistant, onOpen);
  }, [send]);

  // Docked (side panel) above 1280px, sheet with a scrim below it.
  useEffect(() => {
    const mq = window.matchMedia(DOCK_QUERY);
    const apply = () => setDocked(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  // While docked and open, the page moves over so the panel is a true side panel, not an overlay.
  useEffect(() => {
    const main = document.getElementById("main");
    if (!main) return;
    const on = open && docked;
    main.classList.toggle("transition-[padding]", true);
    main.classList.toggle("duration-240", true);
    main.classList.toggle("ease-standard", true);
    main.classList.toggle(MAIN_DOCKED[0]!, on);
    return () => main.classList.remove(MAIN_DOCKED[0]!);
  }, [open, docked]);

  // Recent conversations fill the empty state, so the panel opens on something the reader can pick up.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    fetch("/api/assistant/conversations")
      .then((r) => (r.ok ? r.json() : { conversations: [] }))
      .then((d) => {
        if (!cancelled) setHistory(d.conversations ?? []);
      })
      .catch(() => {
        if (!cancelled) setHistory([]);
      });
    return () => {
      cancelled = true;
    };
  }, [open, conversationId]);

  // While an answer streams, follow it. Once it lands, bring the QUESTION to the top so the answer
  // reads from its first card down, instead of leaving the reader at the follow-up chips.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const last = turns[turns.length - 1];
    if (last && last.role === "assistant" && !last.streaming) {
      const q = el.querySelectorAll<HTMLElement>('[data-turn="user"]');
      const top = q[q.length - 1];
      if (top) {
        el.scrollTop = top.offsetTop - 12;
        return;
      }
    }
    el.scrollTop = el.scrollHeight;
  }, [turns]);

  // The orb mirrors the conversation: typing while the reader types, thinking while an answer is
  // on its way, one settle bounce when it lands, then it rests.
  useEffect(() => {
    if (wasBusy.current && !busy) {
      setLanded(true);
      const t = setTimeout(() => setLanded(false), 1400);
      wasBusy.current = false;
      return () => clearTimeout(t);
    }
    wasBusy.current = busy;
  }, [busy]);

  const empty = turns.length === 0;
  const typing = !busy && input.trim().length > 0;
  const orbState: OrbState = busy ? "thinking" : landed ? "done" : typing ? "typing" : "idle";

  return (
    <Sheet open={open} onOpenChange={setOpen} modal={!docked}>
      <SheetContent
        side="right"
        hideClose
        className={cn("w-full gap-0 p-0 sm:max-w-md", docked && "xl:bottom-4 xl:right-4 xl:top-4 xl:h-auto xl:rounded-panel")}
        style={docked ? { top: "1rem", height: "calc(100dvh - 2rem)" } : undefined}
        onInteractOutside={docked ? (e) => e.preventDefault() : undefined}
        data-docked={docked || undefined}
      >
        <header className="shrink-0 border-b border-border">
          <div className="flex h-16 items-center gap-3 px-4">
            <Orb size={26} state={orbState} className="ml-1" />
            <div className="min-w-0 flex-1">
              <SheetTitle className="text-row font-medium">Assistant</SheetTitle>
              <SheetDescription className="sr-only">Ask about policies, people, apps and requests. Answers cite their sources.</SheetDescription>
            </div>
            <DropdownMenu onOpenChange={(o) => o && fetch("/api/assistant/conversations").then((r) => r.json()).then((d) => setHistory(d.conversations ?? []))}>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm" aria-label="Previous conversations">
                  <History />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-72">
                <DropdownMenuLabel>Recent conversations</DropdownMenuLabel>
                {history === null ? (
                  <p className="px-2 py-2 text-small text-muted">Loading…</p>
                ) : history.length === 0 ? (
                  <p className="px-2 py-2 text-small text-muted">Nothing yet. Your conversations stay private to you.</p>
                ) : (
                  history.map((h) => (
                    <DropdownMenuItem key={h.id} onSelect={() => void loadConversation(h.id)} className="flex-col items-start gap-0">
                      <span className="w-full truncate">{h.title}</span>
                      <span className="text-caption text-subtle">{timeAgo(h.updatedAt)}</span>
                    </DropdownMenuItem>
                  ))
                )}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="ghost" size="icon-sm" aria-label="New conversation" onClick={newChat}>
              <Plus />
            </Button>
            <Button variant="ghost" size="icon-sm" aria-label="Close assistant" onClick={() => setOpen(false)}>
              <X />
            </Button>
          </div>
        </header>

        <div ref={scrollRef} className="relative flex-1 overflow-y-auto px-4 py-5" aria-live="polite">
          {empty ? (
            <BlurIn className="flex flex-col items-center pt-5 text-center">
              <Orb size={76} state={orbState} label={busy ? "The assistant is thinking" : "The assistant"} />
              <h2 className="mt-7 text-h3 font-medium text-fg">How can I help?</h2>
              <p className="mt-1.5 max-w-[320px] text-body text-muted text-pretty">
                Ask about policies, people, apps or requests. Answers come from your company&apos;s pages, with links to the source.
              </p>
              {/* The suggestions stand back while the reader writes their own question. */}
              <Reveal stagger={0.07} delay={0.25} className={cn("mt-6 w-full transition-opacity duration-240 ease-standard", typing && "opacity-55")}>
                <ul className="flex w-full flex-col gap-2">
                  {SUGGESTIONS.map((s) => (
                    <li key={s}>
                      <RevealItem from="up" duration={0.55}>
                        <button
                          type="button"
                          onClick={() => void send(s)}
                          className="focus-ring press cell flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-card px-3.5 text-left text-body text-fg hover:shadow-cell-hover"
                        >
                          <MessageSquare className="size-4 shrink-0 stroke-[1.75] text-subtle" aria-hidden />
                          <span className="min-w-0 flex-1 truncate">{s}</span>
                        </button>
                      </RevealItem>
                    </li>
                  ))}
                </ul>
              </Reveal>
              {history && history.length > 0 && (
                <div className="mt-6 w-full text-left">
                  <p className="mb-1 text-small font-medium text-muted">Pick up where you left off</p>
                  <ul className="-mx-2 divide-y divide-border">
                    {history.filter((h, i, all) => all.findIndex((x) => x.title === h.title) === i).slice(0, 4).map((h) => (
                      <li key={h.id}>
                        <button
                          type="button"
                          onClick={() => void loadConversation(h.id)}
                          className="focus-ring flex min-h-10 w-full cursor-pointer items-center gap-3 rounded-control px-2 text-left text-body text-fg transition-colors duration-120 hover:bg-hover"
                        >
                          <History className="size-4 shrink-0 stroke-[1.5] text-subtle" aria-hidden />
                          <span className="min-w-0 flex-1 truncate">{h.title}</span>
                          <span className="shrink-0 text-caption text-subtle">{timeAgo(h.updatedAt)}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </BlurIn>
          ) : (
            <>
            <ol className="space-y-5">
              {turns.map((t) => (
                <li key={t.id} data-turn={t.role} className={cn("flex", t.role === "user" ? "justify-end" : "justify-start")}>
                  {t.role === "user" ? (
                    <p className="max-w-[85%] whitespace-pre-wrap rounded-card rounded-br-[6px] bg-accent-soft px-3.5 py-2 text-row text-fg">{t.text}</p>
                  ) : (
                    <AssistantTurn
                      turn={t}
                      isAdmin={isAdmin}
                      onDecide={(a, d) => void decide(t.id, a, d)}
                      onRetry={() => {
                        const q = [...turns].reverse().find((x) => x.role === "user")?.text;
                        if (q) {
                          setTurns((ts) => ts.filter((x) => x.id !== t.id));
                          void send(q);
                        }
                      }}
                      disabled={busy}
                    />
                  )}
                </li>
              ))}
            </ol>
            {/* Follow-ups fill the space under a finished answer: the suggestions not asked yet. */}
            {!busy && turns.length > 0 && turns[turns.length - 1]!.role === "assistant" ? (
              <div className="mt-6">
                <p className="mb-2 text-small font-medium text-muted">Ask next</p>
                <ul className="flex flex-wrap gap-2">
                  {SUGGESTIONS.filter((q) => !turns.some((t) => t.role === "user" && t.text === q))
                    .slice(0, 3)
                    .map((q) => (
                      <li key={q}>
                        <button
                          type="button"
                          onClick={() => void send(q)}
                          className="focus-ring press inline-flex min-h-9 items-center gap-2 rounded-full bg-raised px-3.5 text-small text-fg shadow-cell hover:shadow-cell-hover"
                        >
                          <MessageSquare className="size-3.5 shrink-0 stroke-[1.75] text-subtle" aria-hidden />
                          {q}
                        </button>
                      </li>
                    ))}
                </ul>
              </div>
            ) : null}
            </>
          )}
        </div>

        <form
          className="shrink-0 border-t border-border px-4 pb-3 pt-3"
          onSubmit={(e) => {
            e.preventDefault();
            void send(input);
          }}
        >
          {/* The composer box carries the focus ring for the textarea inside it, the same way Input does, plus a soft glow while it has focus. */}
          <div className="cell flex items-end gap-2 rounded-card p-1.5 pl-3.5 pr-1.5 transition-shadow duration-240 ease-standard focus-within:shadow-[0_0_0_1px_var(--lb-accent-ring),0_10px_32px_-8px_var(--lb-glow-cyan),0_0_0_5px_var(--lb-accent-soft)]">
            <label htmlFor="assistant-input" className="sr-only">Ask the assistant</label>
            <textarea
              id="assistant-input"
              ref={inputRef}
              value={input}
              rows={1}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  void send(input);
                }
              }}
              placeholder="Ask anything about work…"
              className="max-h-40 min-h-9 flex-1 resize-none bg-transparent py-2 text-body text-fg outline-none placeholder:text-subtle"
            />
            {busy && abortRef.current ? (
              <Button type="button" size="icon" variant="secondary" aria-label="Stop" onClick={() => abortRef.current?.abort()}>
                <Square className="fill-current" />
              </Button>
            ) : (
              <Button type="submit" size="icon" variant={input.trim() ? "primary" : "secondary"} aria-label="Send" disabled={busy}>
                <ArrowUp />
              </Button>
            )}
          </div>
          <p className="mt-1.5 px-1 text-caption text-subtle">The assistant can make mistakes. Check the linked sources.</p>
        </form>
      </SheetContent>
    </Sheet>
  );
}

/** A failed answer: what went wrong in plain words, and a way to try again. */
export function AssistantErrorNotice({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-col gap-2 rounded-card bg-danger-soft px-3.5 py-3 text-small text-danger-text">
      <p>{message}</p>
      {onRetry ? (
        <button type="button" onClick={onRetry} className="focus-ring press inline-flex h-8 w-fit items-center gap-1.5 rounded-full bg-raised px-3 text-small font-medium text-fg shadow-cell">
          <RotateCw className="size-3.5 stroke-[1.75]" aria-hidden />
          Try again
        </button>
      ) : null}
    </div>
  );
}

function AssistantTurn({ turn, isAdmin, onDecide, onRetry, disabled }: { turn: Turn; isAdmin: boolean; onDecide: (a: PendingAction, d: "confirm" | "cancel") => void; onRetry?: () => void; disabled: boolean }) {
  const byNumber = new Map(turn.citations.map((c) => [Number(c.sourceId), c]));
  // Retrieval-only answers are a reading list: lay the hits out as rows rather than as prose.
  const results = !turn.streaming && turn.notice ? parseRetrieval(turn.text, turn.citations) : null;
  return (
    <BlurIn className="w-full max-w-full space-y-3" duration={0.4}>
      {results ? (
        <>
          <StreamText text={results.length === 1 ? "The best match from your company's pages." : `The ${results.length} best matches from your company's pages.`} animateInitial className="text-small text-muted" />
          {/* The answer cards materialise from blur; the one-shot sweep on the lead card lives inside AnswerCards. */}
          <BlurIn delay={0.12} duration={0.5}>
            <AnswerCards rows={results} />
          </BlurIn>
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-caption text-subtle">
            <span className="inline-flex h-6 items-center rounded-full bg-sunken px-2.5 font-medium text-muted">Pages only</span>
            {isAdmin ? (
              <span>
                Written answers are off.{" "}
                <Link href="/admin/ai" className="focus-ring rounded-[3px] font-medium text-accent-text underline decoration-accent-text/35 underline-offset-[0.2em] hover:decoration-accent-text">
                  Turn them on
                </Link>
              </span>
            ) : (
              <span>Written answers are off. An admin can turn them on.</span>
            )}
          </p>
        </>
      ) : turn.text ? (
        <StreamText text={turn.text} streaming={turn.streaming} citationHref={(n) => byNumber.get(n)?.url} />
      ) : null}
      {turn.status && (
        <p className="flex items-center gap-2 text-small text-muted">
          <Loader2 className="size-3.5 animate-spin" aria-hidden />
          <ShimmerText>{`${turn.status}…`}</ShimmerText>
        </p>
      )}
      {turn.action && <ActionCard action={turn.action} onDecide={onDecide} disabled={disabled} />}
      {turn.error && <AssistantErrorNotice message={turn.error} onRetry={onRetry} />}
      {!results && !turn.streaming && turn.citations.length > 0 && (
        <BlurIn delay={0.1} duration={0.5}>
          <SourceList rows={turn.citations.map((citation) => ({ citation }))} className="border-t border-border pt-3" highlightFirst />
        </BlurIn>
      )}
    </BlurIn>
  );
}
