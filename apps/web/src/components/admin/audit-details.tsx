"use client";

import { useState } from "react";
import { Check, ChevronDown, Copy } from "lucide-react";
import { cn } from "@/lib/cn";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** First eight characters of an id, the way git shows a commit; the full id is one hover or copy away. */
const shortId = (v: string) => (UUID.test(v) ? v.slice(0, 8) : v);

/**
 * The Details cell of the audit log (audit G1). Closed, every entry sits on ONE line as a run of
 * `key value` pairs separated by dots, so every row keeps the same height and the column scans;
 * the line clips with an ellipsis and carries the full text in a tooltip. "More" expands the cell
 * to a stacked list with every value wrapped and ids in full, each with a copy button.
 * `open` forces the expanded form (the phone list renders it inside a disclosure).
 */
export function AuditDetails({
  data,
  targetType,
  targetId,
  open: forced,
}: {
  data: Record<string, unknown> | null;
  targetType: string | null;
  targetId: string | null;
  open?: boolean;
}) {
  const [opened, setOpened] = useState(false);
  const open = forced ?? opened;
  const entries = Object.entries(data ?? {}).filter(([, v]) => v !== null && v !== undefined && v !== "");
  const rows: [string, string][] = [
    ...(targetType ? ([["target", targetId ? `${targetType} ${targetId}` : targetType]] as [string, string][]) : []),
    ...entries.map(([k, v]) => [k, typeof v === "string" ? v : JSON.stringify(v)] as [string, string]),
  ];
  if (!rows.length) return <span className="text-subtle">None</span>;

  if (!open) {
    const text = rows.map(([k, v]) => `${k} ${v}`).join(" · ");
    // A human handle leads and is never cut: "#1060" for a ticket, then the rest in quiet mono.
    const lead = typeof data?.number === "number" || typeof data?.number === "string" ? `#${data.number}` : null;
    const rest = lead ? rows.filter(([k]) => k !== "number") : rows;
    return (
      <div className={cn("flex min-w-0 items-center gap-1.5 text-small", forced === undefined ? "w-[320px]" : "w-full")}>
        {lead ? <span className="tabular shrink-0 rounded-full bg-sunken px-2 py-0.5 text-caption font-medium text-fg shadow-inset">{lead}</span> : null}
        <p className="min-w-0 flex-1 truncate" title={text}>
          {rest.map(([k, v], i) => (
            <span key={k}>
              {i ? <span className="text-subtle"> · </span> : null}
              <span className="text-caption text-subtle">{k}</span> <span className="font-mono text-small text-muted">{k === "target" ? v.replace(/ ([0-9a-f-]{36})$/i, (_, id) => ` ${shortId(id)}`) : shortId(v)}</span>
            </span>
          ))}
        </p>
        <button
          type="button"
          onClick={() => setOpened(true)}
          aria-expanded={false}
          aria-label={`${rows.length} details, expand`}
          className="focus-ring inline-flex size-6 shrink-0 items-center justify-center rounded-full text-subtle hover:bg-hover hover:text-fg"
        >
          <ChevronDown className="size-3.5 stroke-[1.75]" aria-hidden />
        </button>
      </div>
    );
  }

  return (
    <div className={cn("flex min-w-0 flex-col gap-1 text-small", forced === undefined && "w-[320px]")}>
      <dl className="flex flex-col gap-1">
        {rows.map(([k, v]) => (
          <div key={k} className="flex min-w-0 flex-col">
            <dt className="text-caption text-subtle">{k}</dt>
            <dd className="min-w-0 whitespace-normal font-mono text-small text-muted [overflow-wrap:anywhere]">
              {k === "target" ? (
                <>
                  {v.replace(/ [0-9a-f-]{36}$/i, "")}
                  {targetId ? (
                    <>
                      {" "}
                      <Id value={targetId} />
                    </>
                  ) : null}
                </>
              ) : UUID.test(v) ? (
                <Id value={v} />
              ) : (
                v
              )}
            </dd>
          </div>
        ))}
      </dl>
      {forced === undefined ? (
        <button
          type="button"
          onClick={() => setOpened(false)}
          aria-expanded
          className="focus-ring -ml-1 mt-0.5 inline-flex h-6 w-fit items-center gap-1 rounded-full px-1.5 text-caption font-medium text-muted hover:bg-hover hover:text-fg"
        >
          <ChevronDown className="size-3.5 rotate-180 stroke-[1.75]" aria-hidden />
          Less
        </button>
      ) : null}
    </div>
  );
}

function Id({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      /* clipboard refused: the full id is still on screen */
    }
  };
  return (
    <span className="inline">
      <span className="text-muted [overflow-wrap:anywhere]">{value}</span>{" "}
      <button
        type="button"
        onClick={copy}
        aria-label={copied ? "Copied" : `Copy ${value}`}
        className="focus-ring inline-flex size-6 shrink-0 items-center justify-center rounded-full align-middle text-subtle hover:bg-hover hover:text-fg"
      >
        {copied ? <Check className="size-3 stroke-[2] text-success-text" aria-hidden /> : <Copy className="size-3 stroke-[1.75]" aria-hidden />}
      </button>
    </span>
  );
}
