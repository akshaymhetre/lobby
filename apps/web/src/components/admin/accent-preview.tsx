"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Check, Sparkles } from "lucide-react";
import { accentTokens, contrast, parseHex, type AccentTokens } from "@lobby/core/color";
import { BorderBeam } from "@/components/ui/effects/border-beam";
import { cn } from "@/lib/cn";

const vars = (t: AccentTokens) =>
  ({
    "--lb-accent": t.accent,
    "--lb-accent-hover": t.accentHover,
    "--lb-accent-fg": t.accentFg,
    "--lb-accent-soft": t.accentSoft,
    "--lb-accent-text": t.accentText,
    "--lb-accent-ring": t.accentRing,
  }) as React.CSSProperties;

/**
 * Live preview of the generated accent in both themes: two panels side by side, one in the light
 * material and one in the dark glass, each scoping the theme class and the generated accent
 * variables, so it shows exactly what employees will see whatever theme they use. The branding
 * page's one authored moment: when the colour changes, a light travels once around the preview
 * so the eye lands on the result, not the field.
 */
export function AccentPreview({
  color,
  companyName,
  stack = false,
  note = true,
}: {
  color: string;
  companyName: string;
  /** Panes one above the other (a side column). */
  stack?: boolean;
  /** Show the contrast readout under the panes. */
  note?: boolean;
}) {
  const valid = !!parseHex(color);
  const tokens = useMemo(() => accentTokens(valid ? color : "#2A5FE6"), [color, valid]);
  // Sweep only on a change, never on the first paint.
  const first = useRef(true);
  const [sweep, setSweep] = useState(0);
  useEffect(() => {
    if (!valid) return;
    if (first.current) {
      first.current = false;
      return;
    }
    const t = setTimeout(() => setSweep((n) => n + 1), 120);
    return () => clearTimeout(t);
  }, [tokens.light.accent, valid]);

  return (
    <div className="flex flex-col gap-2">
      <div className={cn("relative isolate grid gap-2 rounded-card", !stack && "sm:grid-cols-2")}>
        {sweep ? <BorderBeam key={sweep} tone="accent" color={tokens.light.accent} loops={1} duration={1.2} intensity="subtle" settle="none" radius={16} /> : null}
        <Pane theme="light" tokens={tokens.light} companyName={companyName} />
        <Pane theme="dark" tokens={tokens.dark} companyName={companyName} />
      </div>
      {note ? <ContrastNote color={color} /> : null}
    </div>
  );
}

/** The contrast readout for a brand colour: the generated button text ratio, and whether Lobby had to darken it. */
export function ContrastNote({ color }: { color: string }) {
  const valid = !!parseHex(color);
  const tokens = useMemo(() => accentTokens(valid ? color : "#2A5FE6"), [color, valid]);
  const ratio = contrast(tokens.light.accentFg, tokens.light.accent);
  return (
    <p className="text-small text-muted">
      Button text contrast <span className="tabular font-medium text-fg">{ratio.toFixed(1)}:1</span>, above the 4.5:1 that WCAG AA asks for.
      {valid && tokens.light.accent.toUpperCase() !== color.toUpperCase() ? " Lobby darkened your colour slightly to get there." : ""}
    </p>
  );
}

/**
 * A miniature of Lobby itself in one theme: the top bar with the company mark, the active pill and
 * the Ask button, the greeting with a link, and a request card with the primary action. Every
 * accent-coloured part is the generated token, so the admin sees their colour in place, not on a
 * swatch.
 */
function Pane({ theme, tokens, companyName }: { theme: "light" | "dark"; tokens: AccentTokens; companyName: string }) {
  const initials =
    (companyName || "Company")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]!.toUpperCase())
      .join("") || "C";
  return (
    <div className={cn(theme, "@container relative min-w-0 overflow-hidden rounded-card bg-canvas p-2 text-fg shadow-panel")} style={vars(tokens)} aria-label={`${theme === "light" ? "Light" : "Dark"} theme preview`} role="img">
      <div className={cn("flex flex-col gap-3.5 rounded-[14px] bg-page p-3.5", theme === "dark" && "slab")}>
        {/* Top bar. Every label here is real product size (13px and up), not a shrunken picture. */}
        <div className="flex items-center gap-2">
          <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-accent text-caption font-semibold text-accent-fg shadow-cell">{initials}</span>
          <span className="flex min-w-0 items-center gap-0.5 rounded-full bg-sunken p-0.5 shadow-inset">
            <span className="rounded-full bg-raised px-2.5 py-1 text-caption font-medium shadow-cell">Home</span>
            <span className="hidden px-2 py-1 text-caption text-muted @[300px]:inline">People</span>
          </span>
          <span className="ml-auto inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full bg-accent px-3 text-caption font-medium text-accent-fg shadow-cell">
            <Sparkles className="size-3.5 stroke-[2]" aria-hidden />
            Ask
          </span>
        </div>
        {/* Greeting. */}
        <div className="flex flex-col gap-1 px-0.5">
          <p className="text-caption text-subtle">{theme === "light" ? "Light" : "Dark"} theme</p>
          <p className="text-row font-medium">Good morning, Maya</p>
          <p className="text-caption text-muted">
            Read the <span className="font-medium text-accent-text underline underline-offset-2">{companyName || "company"} handbook</span> before Monday.
          </p>
        </div>
        {/* A request card with the primary action. */}
        <div className="flex flex-wrap items-center gap-2 rounded-[12px] bg-surface p-3 shadow-cell">
          <span className="inline-flex h-8 items-center gap-1.5 rounded-full bg-accent px-3.5 text-caption font-medium text-accent-fg shadow-cell">
            Request access
            <ArrowRight className="size-3.5 stroke-[1.75]" aria-hidden />
          </span>
          <span className="inline-flex h-7 items-center gap-1 rounded-full bg-accent-soft px-2.5 text-caption font-medium text-accent-text">
            <Check className="size-3.5 stroke-[2.5]" aria-hidden />
            Verified
          </span>
        </div>
      </div>
    </div>
  );
}
