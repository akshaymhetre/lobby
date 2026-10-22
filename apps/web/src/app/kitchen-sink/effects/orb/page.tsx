"use client";

import * as React from "react";
import { Orb, type OrbState } from "@/components/ui/effects/orb";
import { StreamText } from "@/components/ui/effects/stream-text";
import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { cn } from "@/lib/cn";

const STATES: OrbState[] = ["idle", "typing", "thinking", "done"];
const SIZES = [28, 56, 112];
/** Three columns have to fit beside the row label on a phone, so the sizes step down there. */
const SIZES_PHONE = [24, 40, 72];

// Invented, so the replay has something to say. Nothing here is company data.
const SAMPLE =
  "Northwind gives **26 weeks** of fully paid parental leave to every parent, and birth parents can take a further 4 weeks of recovery leave on top [1]. " +
  "You can start it up to two weeks before the due date and split it into two blocks within the first year [2].\n\n" +
  "- Tell your manager and People at least 8 weeks ahead\n" +
  "- Raise the request in Help under `Time off`\n\n" +
  "Pay stays at 100% for the whole period, including bonus eligibility [1].";

/**
 * The orb and StreamText, every state at three sizes, light beside dark. The state selector drives
 * every orb at once so a frame sequence shows one state across the board.
 */
export default function OrbEffectsPage() {
  const [state, setState] = React.useState<OrbState>("idle");
  // The full answer is visible at rest; Replay streams it word by word.
  const [sample, setSample] = React.useState(SAMPLE);
  const [streaming, setStreaming] = React.useState(false);
  const [runKey, setRunKey] = React.useState(0);

  const replay = React.useCallback(() => {
    setSample("");
    setStreaming(true);
    setRunKey((k) => k + 1);
    const words = SAMPLE.split(/(?<=\s)/);
    let i = 0;
    const tick = () => {
      // Two to four words a step, like a model's token stream.
      const n = 2 + Math.floor(Math.random() * 3);
      i = Math.min(words.length, i + n);
      setSample(words.slice(0, i).join(""));
      if (i < words.length) timer = setTimeout(tick, 70 + Math.random() * 90);
      else setStreaming(false);
    };
    let timer = setTimeout(tick, 120);
    return () => clearTimeout(timer);
  }, []);

  return (
    <main className="mx-auto my-6 max-w-[1280px] rounded-slab bg-page px-4 py-8 shadow-slab sm:px-8 sm:py-10">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-caption font-medium uppercase tracking-[0.08em] text-muted">Effects</p>
          <h1 className="mt-1 text-h1 font-medium text-fg">Orb and StreamText</h1>
          <p className="mt-2 max-w-[560px] text-body text-fg">
            The assistant&apos;s face in every state, light beside dark, and answer text that reveals as it streams.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-small text-muted">State</span>
          <SegmentedControl
            aria-label="Orb state"
            value={state}
            onValueChange={(v) => setState(v as OrbState)}
            options={STATES.map((s) => ({ value: s, label: s }))}
          />
        </div>
      </header>

      <section aria-labelledby="orb-grid" className="grid gap-6 lg:grid-cols-2">
        <h2 id="orb-grid" className="sr-only">Orb states</h2>
        <ThemePane theme="light">
          <OrbGrid state={state} />
        </ThemePane>
        <ThemePane theme="dark">
          <OrbGrid state={state} />
        </ThemePane>
      </section>

      <section aria-labelledby="stream" className="mt-10">
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 id="stream" className="text-h3 font-medium text-fg">StreamText</h2>
          <Button variant="secondary" size="sm" onClick={replay} disabled={streaming}>
            Replay
          </Button>
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <ThemePane theme="light">
            <div className="flex gap-3">
              <Orb size={26} state={streaming ? "thinking" : "idle"} className="mt-0.5" />
              <div className="min-w-0 flex-1">
                <StreamText key={runKey} text={sample} streaming={streaming} citationHref={() => "/knowledge/people/parental-leave"} />
              </div>
            </div>
          </ThemePane>
          <ThemePane theme="dark">
            <div className="flex gap-3">
              <Orb size={26} state={streaming ? "thinking" : "idle"} className="mt-0.5" />
              <div className="min-w-0 flex-1">
                <StreamText key={runKey} text={sample} streaming={streaming} citationHref={() => "/knowledge/people/parental-leave"} />
              </div>
            </div>
          </ThemePane>
        </div>
      </section>
    </main>
  );
}

function ThemePane({ theme, children }: { theme: "light" | "dark"; children: React.ReactNode }) {
  return (
    <div className={cn(theme === "dark" && "dark", "rounded-panel bg-page p-4 text-fg shadow-slab sm:p-6")} data-theme={theme}>
      <p className="mb-4 text-caption font-medium uppercase tracking-[0.08em] text-muted">{theme}</p>
      <div className="rounded-card panel p-4 sm:p-6">{children}</div>
    </div>
  );
}

function OrbGrid({ state }: { state: OrbState }) {
  const phone = useMediaQuery("(max-width: 639px)");
  const sizes = phone ? SIZES_PHONE : SIZES;
  return (
    <div className="grid grid-cols-[auto_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)] items-center gap-x-3 gap-y-8 sm:gap-x-6">
      <span />
      {sizes.map((s) => (
        <span key={s} className="text-caption text-subtle tabular">{s}px</span>
      ))}
      {STATES.map((s) => (
        <React.Fragment key={s}>
          <span className={cn("text-small", s === state ? "font-medium text-fg" : "text-muted")}>{s}</span>
          {sizes.map((size) => (
            <div key={size} className="flex h-[96px] items-center justify-center sm:h-[128px]">
              <Orb size={size} state={s === state ? state : s} label={`${s} orb at ${size}px`} />
            </div>
          ))}
        </React.Fragment>
      ))}
    </div>
  );
}

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = React.useState(false);
  React.useEffect(() => {
    const mq = window.matchMedia(query);
    const apply = () => setMatches(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [query]);
  return matches;
}
