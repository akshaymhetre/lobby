import Link from "next/link";
import { Fragment, type ReactNode } from "react";

/**
 * A deliberately small Markdown renderer for assistant answers: paragraphs, bullet and numbered
 * lists, **bold**, `code`, [links](/path) and [n] citation markers. It builds React elements,
 * never HTML strings, so model output cannot inject markup.
 */
export function AnswerMarkdown({ text, citationHref }: { text: string; citationHref: (n: number) => string | undefined }) {
  const blocks = text.replace(/\r/g, "").split(/\n{2,}/);
  return (
    <div className="space-y-2.5 text-body leading-[1.6] text-fg">
      {blocks.map((block, i) => {
        const lines = block.split("\n").filter((l) => l.trim());
        if (lines.length && lines.every((l) => /^\s*[-*]\s+/.test(l))) {
          return (
            <ul key={i} className="list-disc space-y-1 pl-5 marker:text-subtle">
              {lines.map((l, j) => (
                <li key={j}>{inline(l.replace(/^\s*[-*]\s+/, ""), citationHref)}</li>
              ))}
            </ul>
          );
        }
        if (lines.length && lines.every((l) => /^\s*\d+[.)]\s+/.test(l))) {
          return (
            <ol key={i} className="list-decimal space-y-1 pl-5 marker:text-subtle">
              {lines.map((l, j) => (
                <li key={j}>{inline(l.replace(/^\s*\d+[.)]\s+/, ""), citationHref)}</li>
              ))}
            </ol>
          );
        }
        const heading = /^#{1,4}\s+(.*)$/.exec(block.trim());
        if (heading && lines.length === 1) {
          return (
            <p key={i} className="font-semibold">
              {inline(heading[1]!, citationHref)}
            </p>
          );
        }
        return (
          <p key={i}>
            {lines.map((l, j) => (
              <Fragment key={j}>
                {j > 0 && <br />}
                {inline(l, citationHref)}
              </Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
}

const TOKEN = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\((?:\/|https?:\/\/)[^)\s]+\)|\[\d{1,2}\])/g;

function inline(text: string, citationHref: (n: number) => string | undefined): ReactNode[] {
  const out: ReactNode[] = [];
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
      const href = citationHref(n);
      out.push(
        href ? (
          <Link key={at} href={href} className="mx-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-accent-soft px-1 align-[1px] text-caption font-semibold tabular-nums text-accent-text no-underline hover:bg-accent hover:text-accent-fg" aria-label={`Source ${n}`}>
            {n}
          </Link>
        ) : (
          <span key={at}>{tok}</span>
        ),
      );
    } else {
      const lm = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(tok)!;
      const href = lm[2]!;
      out.push(
        href.startsWith("/") ? (
          <Link key={at} href={href} className="font-medium text-accent-text underline decoration-accent-text/30 underline-offset-2 hover:decoration-accent-text">
            {lm[1]}
          </Link>
        ) : (
          <a key={at} href={href} target="_blank" rel="noreferrer noopener" className="font-medium text-accent-text underline decoration-accent-text/30 underline-offset-2 hover:decoration-accent-text">
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
