import { FrontDoorScene } from "@/components/front-door-scene";
import { BlurIn } from "@/components/ui/motion";
import { cn } from "@/lib/cn";

/** Company logo, or a monogram on the accent colour when no logo has been uploaded. */
export function BrandMark({
  name,
  logoUrl,
  size = 32,
  className,
}: {
  name: string;
  logoUrl?: string | null;
  size?: number;
  className?: string;
}) {
  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt=""
        width={size}
        height={size}
        className={cn("rounded-control object-contain", className)}
        style={{ width: size, height: size }}
      />
    );
  }
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
  return (
    <span
      aria-hidden
      className={cn("inline-flex shrink-0 items-center justify-center rounded-control bg-accent font-semibold text-accent-fg", className)}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.4) }}
    >
      {initials || "L"}
    </span>
  );
}

/**
 * The company nameplate as a line: mark + company name, an optional right-hand slot and a rule.
 * Kept for compatibility; the front door now uses <FrontDoor>, which carries the nameplate itself.
 */
export function BrandLockup({
  name,
  logoUrl,
  aside,
  size = 40,
  className,
}: {
  name: string;
  logoUrl?: string | null;
  aside?: React.ReactNode;
  size?: number;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-3 border-b border-border pb-3", className)}>
      <BrandMark name={name} logoUrl={logoUrl} size={size} />
      <span className="flex min-w-0 flex-1 items-baseline justify-between gap-4">
        <span className="truncate text-body-lg font-medium text-fg">{name}</span>
        {aside ? <span className="shrink-0 text-caption font-medium text-subtle">{aside}</span> : null}
      </span>
    </div>
  );
}

/**
 * The ambient behind the front door: three large colour glows (cyan, violet, gold, the v2 glow
 * tokens) drawn as radial gradients, under a faint grain that dithers the gradients so they do
 * not band on an 8-bit screen. Decorative, static, aria-hidden, clipped by the page.
 */
const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.5'/%3E%3C/svg%3E\")";

const AMBIENT_LAYOUTS = [
  [
    "radial-gradient(55% 60% at 8% 6%, var(--lb-glow-cyan), transparent 70%)",
    "radial-gradient(50% 55% at 96% 40%, var(--lb-glow-violet), transparent 70%)",
    "radial-gradient(45% 50% at 34% 108%, var(--lb-glow-gold), transparent 70%)",
  ],
  [
    "radial-gradient(60% 80% at 100% 0%, var(--lb-glow-violet), transparent 70%)",
    "radial-gradient(50% 70% at 0% 100%, var(--lb-glow-cyan), transparent 70%)",
    "radial-gradient(40% 60% at 70% 110%, var(--lb-glow-gold), transparent 70%)",
  ],
  [
    "radial-gradient(60% 80% at 100% 0%, var(--lb-glow-gold), transparent 70%)",
    "radial-gradient(55% 75% at 0% 0%, var(--lb-glow-cyan), transparent 70%)",
    "radial-gradient(45% 60% at 80% 110%, var(--lb-glow-violet), transparent 70%)",
  ],
] as const;

/**
 * The v2 ambient field (three coloured glows under a dithering grain), for any surface that wants
 * the front door's light: the door itself and a news article's cover. `layout` picks one of three
 * arrangements so neighbouring covers do not look stamped.
 */
export function Ambient({ layout = 0, className }: { layout?: number; className?: string }) {
  return (
    <div aria-hidden className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}>
      <div
        className="absolute inset-0"
        style={{ backgroundImage: AMBIENT_LAYOUTS[Math.abs(layout) % AMBIENT_LAYOUTS.length]!.slice(0, 2).join(",") }}
      />
      {/* The gold glow muddies the cool grey canvas in light mode, so it is a whisper there and full in dark. */}
      <div
        className="absolute inset-0 opacity-35 dark:opacity-100"
        style={{ backgroundImage: AMBIENT_LAYOUTS[Math.abs(layout) % AMBIENT_LAYOUTS.length]![2] }}
      />
      <div className="absolute inset-0 opacity-[0.07] mix-blend-overlay dark:opacity-[0.1]" style={{ backgroundImage: GRAIN }} />
    </div>
  );
}

/**
 * The company's front door, outside the app shell: sign-in, signed-out and the 404 at the door.
 * One wide floating slab (the v2 object) on the ambient canvas. The left half is the door itself:
 * the nameplate, then the page's content. The right half is a picture of what the door opens
 * (FrontDoorScene): the company mark with light travelling out to the six places of the
 * intranet. On a phone the picture sits above the nameplate as a short band. The slab
 * materialises from blur once, on arrival. In dark mode the slab is teal glass.
 */
export function FrontDoor({
  name,
  logoUrl,
  dateline,
  productName,
  lit = true,
  caption = "One sign-in opens everything here: your week, your people, the knowledge, help and every app.",
  children,
}: {
  name: string;
  logoUrl?: string | null;
  dateline: string;
  productName: string;
  /** The line under the picture. */
  caption?: string;
  /** false on the signed-out page: the picture shows the connections closed. */
  lit?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-dvh flex-col">
      <Ambient />
      <main className="relative flex flex-1 flex-col items-center justify-center px-4 pb-8 pt-6 sm:px-8 sm:pt-10">
        <BlurIn className="w-full max-w-[448px] lg:max-w-[1040px]">
          <div className="grid overflow-hidden rounded-slab bg-page shadow-slab grid-cols-[minmax(0,1fr)] dark:glass lg:grid-cols-[minmax(0,1fr)_minmax(0,1.08fr)]">
            <div className="order-2 flex flex-col justify-center p-6 sm:p-8 lg:order-1 lg:p-12">
              {/* The nameplate is words only: the mark itself is the hub of the picture beside (or above) it. */}
              <p className="flex min-w-0 items-baseline gap-2 text-caption font-medium text-subtle">
                <span className="truncate text-body font-medium text-fg">{name}</span>
                <span aria-hidden>·</span>
                <span className="truncate capitalize">{dateline.toLowerCase()}</span>
              </p>
              <div className="mt-5 lg:mt-10">{children}</div>
            </div>
            <div className="order-1 p-2 pb-0 lg:order-2 lg:p-3">
              <div className="relative flex h-full flex-col overflow-hidden rounded-panel panel dark:bg-white/[0.03]">
                <div className="relative flex-1 px-2 pt-4 lg:min-h-[400px] lg:pt-6">
                  <FrontDoorScene
                    lit={lit}
                    className="h-[200px] sm:h-[240px] lg:h-full lg:min-h-[380px]"
                    hub={<SceneHub name={name} logoUrl={logoUrl} />}
                  />
                </div>
                <p className="hidden px-6 pb-6 text-small text-muted text-pretty lg:block">{caption}</p>
              </div>
            </div>
          </div>
        </BlurIn>
      </main>
      <footer className="relative px-4 pb-5 text-center text-caption text-fg sm:px-8">Powered by {productName}</footer>
    </div>
  );
}

/** The company mark as the hub of the places map: large, lit from below in the accent. */
function SceneHub({ name, logoUrl }: { name: string; logoUrl?: string | null }) {
  return (
    <span className="relative inline-flex rounded-[22px] shadow-glow-cyan">
      <BrandMark
        name={name}
        logoUrl={logoUrl}
        size={72}
        className="rounded-[22px] [box-shadow:0_18px_40px_-12px_color-mix(in_srgb,var(--lb-accent)_60%,transparent),inset_0_1px_0_rgb(255_255_255/0.35)]"
      />
    </span>
  );
}
