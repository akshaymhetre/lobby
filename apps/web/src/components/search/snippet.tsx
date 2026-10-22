import * as React from "react";
import { cn } from "@/lib/cn";

/**
 * Renders a search snippet whose matches are wrapped in [[ and ]] as <mark>. The text is split
 * and rendered as React text nodes, never as HTML, so nothing in a page can inject markup.
 */
export function Snippet({ text, className }: { text: string; className?: string }) {
  const parts = text.replace(/\s+/g, " ").trim().split(/(\[\[.*?\]\])/g);
  return (
    <span className={className}>
      {parts.map((part, i) =>
        part.startsWith("[[") && part.endsWith("]]") ? (
          <mark key={i} className="rounded-[2px] bg-accent-soft px-0.5 font-medium text-fg">
            {part.slice(2, -2)}
          </mark>
        ) : (
          <React.Fragment key={i}>{part.replace(/\[\[|\]\]/g, "")}</React.Fragment>
        ),
      )}
    </span>
  );
}

/** "Holiday policy › Carrying days over" -> title and section. */
export function splitTitle(title: string): { title: string; section: string | null } {
  const i = title.indexOf(" › ");
  return i === -1 ? { title, section: null } : { title: title.slice(0, i), section: title.slice(i + 3) };
}

export function SnippetTitle({ title, className }: { title: string; className?: string }) {
  const t = splitTitle(title);
  return (
    <span className={cn("truncate", className)}>
      {t.title}
      {t.section ? <span className="font-normal text-muted"> › {t.section}</span> : null}
    </span>
  );
}
