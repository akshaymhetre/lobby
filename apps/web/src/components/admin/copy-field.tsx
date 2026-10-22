"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

/** A read-only value with a copy button: a sunken well (tone + inset shadow, no border). Monospace, scrolls long values instead of overflowing. */
export function CopyField({ value, label, className, secret }: { value: string; label: string; className?: string; secret?: boolean }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      const el = document.createElement("textarea");
      el.value = value;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      el.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };
  return (
    <div
      className={cn(
        "flex min-h-10 items-center gap-2 rounded-control bg-sunken py-1 pl-3 pr-1 shadow-inset md:min-h-9",
        secret && "bg-warning-soft/60",
        className,
      )}
    >
      <code aria-label={label} className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap py-1 font-mono text-small text-fg [scrollbar-width:thin]">
        {value}
      </code>
      <Button type="button" variant="ghost" size="sm" onClick={copy} aria-label={`Copy ${label}`} className="shrink-0">
        {copied ? <Check className="text-success-text" aria-hidden /> : <Copy aria-hidden />}
        <span aria-live="polite">{copied ? "Copied" : "Copy"}</span>
      </Button>
    </div>
  );
}
