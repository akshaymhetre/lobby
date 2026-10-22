"use client";

import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import styles from "./stream-text.module.css";

export interface StreamTextProps {
  /** The text so far. Append-only while streaming; a shorter text resets the reveal. */
  text: string;
  /** True while more text is coming: a soft caret sits after the last word. */
  streaming?: boolean;
  /** Reveal the words present on the first render too (a replay). Default: only words that arrive later animate. */
  animateInitial?: boolean;
  /** Where a [n] citation marker links to. Without it the marker renders as plain text. */
  citationHref?: (n: number) => string | undefined;
  className?: string;
}

/** Word index -> entrance delay in ms, or null for a word that must not animate. Fixed once, so a word never re-animates. */
type Born = Map<number, number | null>;

/**
 * Answer text that reveals as it streams. Every word arrives once, from blur, with a short
 * stagger across the words of one chunk; words already shown keep their spans and never animate
 * again, and only opacity, filter and a 2px transform move, so the layout never jitters.
 *
 * It reads the same Markdown subset as AnswerMarkdown (paragraphs, bullet and numbered lists,
 * **bold**, `code`, [links](/path) and [n] citations) and builds React elements, never HTML.
 *
 *   <StreamText text={turn.text} streaming={turn.streaming} citationHref={(n) => urls[n]} />
 */
export function StreamText({ text, streaming = false, animateInitial = false, citationHref, className }: StreamTextProps) {
  const born = React.useRef<Born>(new Map());
  const firstRender = React.useRef(true);
  const prevLength = React.useRef(0);
  const reduced = usePrefersReducedMotion();

  // A replaced (shorter) text is a new answer: forget the old words.
  if (text.length < prevLength.current) born.current.clear();
  prevLength.current = text.length;

  // Words that are new in THIS render get a stagger relative to the first new word.
  const initial = firstRender.current && !animateInitial;
  let fresh = 0;
  const step = animateInitial ? 34 : 24;
  const delayFor = (index: number): number | null => {
    const known = born.current.get(index);
    if (known !== undefined) return known;
    const d = initial || reduced ? (initial ? null : 0) : Math.min(fresh++, 14) * step;
    born.current.set(index, d);
    return d;
  };

  React.useEffect(() => {
    firstRender.current = false;
  }, []);

  const counter = { index: 0 };
  const href = citationHref ?? (() => undefined);
  const blocks = text.replace(/\r/g, "").split(/\n{2,}/);
  const lastBlock = blocks.length - 1;

  return (
    <div className={cn("space-y-2.5 text-body leading-[1.6] text-fg", className)}>
      {blocks.map((block, i) => {
        const lines = block.split("\n").filter((l) => l.trim());
        const caret = streaming && i === lastBlock ? <span key="caret" className={styles.caret} aria-hidden /> : null;
        if (lines.length && lines.every((l) => /^\s*[-*]\s+/.test(l))) {
          return (
            <ul key={i} className="list-disc space-y-1 pl-5 marker:text-subtle">
              {lines.map((l, j) => (
                <li key={j}>
                  {words(inline(l.replace(/^\s*[-*]\s+/, ""), href), counter, delayFor)}
                  {j === lines.length - 1 ? caret : null}
                </li>
              ))}
            </ul>
          );
        }
        if (lines.length && lines.every((l) => /^\s*\d+[.)]\s+/.test(l))) {
          return (
            <ol key={i} className="list-decimal space-y-1 pl-5 marker:text-subtle">
              {lines.map((l, j) => (
                <li key={j}>
                  {words(inline(l.replace(/^\s*\d+[.)]\s+/, ""), href), counter, delayFor)}
                  {j === lines.length - 1 ? caret : null}
                </li>
              ))}
            </ol>
          );
        }
        const heading = /^#{1,4}\s+(.*)$/.exec(block.trim());
        if (heading && lines.length === 1) {
          return (
            <p key={i} className="font-semibold">
              {words(inline(heading[1]!, href), counter, delayFor)}
              {caret}
            </p>
          );
        }
        return (
          <p key={i}>
            {lines.map((l, j) => (
              <React.Fragment key={j}>
                {j > 0 && <br />}
                {words(inline(l, href), counter, delayFor)}
              </React.Fragment>
            ))}
            {caret}
          </p>
        );
      })}
    </div>
  );
}

/**
 * Wraps every word inside a node tree in its own span, keyed by its position in the whole text.
 * Strings split on whitespace; elements (strong, code, links) keep their shape and get their
 * children wrapped.
 */
function words(nodes: React.ReactNode[], counter: { index: number }, delayFor: (i: number) => number | null): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  for (const node of nodes) {
    if (typeof node === "string") {
      for (const piece of node.split(/(\s+)/)) {
        if (!piece) continue;
        if (/^\s+$/.test(piece)) {
          out.push(piece);
          continue;
        }
        const index = counter.index++;
        const delay = delayFor(index);
        out.push(
          <span
            key={`w${index}`}
            className={cn(styles.word, delay !== null && styles.enter)}
            style={delay ? ({ "--st-delay": `${delay}ms` } as React.CSSProperties) : undefined}
          >
            {piece}
          </span>,
        );
      }
    } else if (React.isValidElement<{ children?: React.ReactNode }>(node)) {
      const inner = React.Children.toArray(node.props.children);
      out.push(React.cloneElement(node, { key: node.key ?? `e${counter.index}` }, ...words(inner, counter, delayFor)));
    } else if (node != null) {
      out.push(node);
    }
  }
  return out;
}

const TOKEN = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\((?:\/|https?:\/\/)[^)\s]+\)|\[\d{1,2}\])/g;

/** The inline grammar, kept in step with components/assistant/markdown.tsx. */
function inline(text: string, citationHref: (n: number) => string | undefined): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(TOKEN)) {
    const tok = m[0];
    const at = m.index ?? 0;
    if (at > last) out.push(text.slice(last, at));
    if (tok.startsWith("**")) {
      out.push(<strong key={at} className="font-semibold">{tok.slice(2, -2)}</strong>);
    } else if (tok.startsWith("`")) {
      out.push(<code key={at} className="rounded-[4px] bg-sunken px-1 py-px font-mono text-[0.92em]">{tok.slice(1, -1)}</code>);
    } else if (/^\[\d{1,2}\]$/.test(tok)) {
      const n = Number(tok.slice(1, -1));
      const to = citationHref(n);
      out.push(
        to ? (
          <Link key={at} href={to} className="mx-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-accent-soft px-1 align-[1px] text-caption font-semibold tabular-nums text-accent-text no-underline hover:bg-accent hover:text-accent-fg" aria-label={`Source ${n}`}>
            {n}
          </Link>
        ) : (
          <span key={at}>{tok}</span>
        ),
      );
    } else {
      const lm = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(tok)!;
      const to = lm[2]!;
      out.push(
        to.startsWith("/") ? (
          <Link key={at} href={to} className="font-medium text-accent-text underline decoration-accent-text/30 underline-offset-2 hover:decoration-accent-text">
            {lm[1]}
          </Link>
        ) : (
          <a key={at} href={to} target="_blank" rel="noreferrer noopener" className="font-medium text-accent-text underline decoration-accent-text/30 underline-offset-2 hover:decoration-accent-text">
            {lm[1]}
          </a>
        ),
      );
    }
    last = at + tok.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

/** The media query, read after mount so the server and the first client render agree. */
function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = React.useState(false);
  React.useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReduced(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);
  return reduced;
}
