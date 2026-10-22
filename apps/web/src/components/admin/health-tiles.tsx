"use client";

import Link from "next/link";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { BorderBeam } from "@/components/ui/effects/border-beam";
import { SpotlightLayer } from "@/components/ui/effects/spotlight";
import { CountUp, Reveal, RevealItem } from "@/components/ui/motion";

export interface HealthTile {
  label: string;
  /** The headline. A number counts up; a word is shown as it is. */
  value: string | number;
  /** Shown after a numeric value, e.g. "SCIM tokens". */
  unit?: string;
  detail: string;
  tone: BadgeTone;
  status: string;
  href: string;
  /** Set when this tile is the one thing the admin must fix; it carries the beam. */
  attention?: string;
}

/**
 * The health board: six raised cells on the admin panel, one per connection. The build staggers
 * in on first load and the numbers count up (the overview's one authored moment). At most one
 * tile carries a BorderBeam: the first one that needs attention.
 */
export function HealthTiles({ tiles }: { tiles: HealthTile[] }) {
  const beamOn = tiles.findIndex((t) => t.attention);
  return (
    <Reveal stagger={0.06} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {tiles.map((t, i) => {
        const beam = i === beamOn;
        const danger = t.tone === "danger";
        return (
          <RevealItem key={t.label} from="up">
            <Link
              href={t.href}
              className="focus-ring press relative isolate flex h-full min-h-[132px] flex-col justify-between gap-4 rounded-card bg-raised p-4 shadow-cell hover:shadow-cell-hover"
            >
              {beam ? <BorderBeam tone={danger ? "danger" : "amber"} loops={2} intensity="vivid" /> : null}
              <SpotlightLayer />
              <span className="flex items-start justify-between gap-3">
                <span className="text-small text-muted">{t.label}</span>
                <Badge tone={t.tone} dot size="sm">
                  {t.status}
                </Badge>
              </span>
              <span className="flex flex-col gap-0.5">
                <span className="flex items-baseline gap-1.5 text-h3 font-medium leading-none text-fg">
                  {typeof t.value === "number" ? <CountUp value={t.value} duration={1} delay={0.2 + i * 0.06} /> : <span className="truncate">{t.value}</span>}
                  {t.unit ? <span className="text-small font-normal text-muted">{t.unit}</span> : null}
                </span>
                <span className="text-small text-muted">{t.detail}</span>
              </span>
            </Link>
          </RevealItem>
        );
      })}
    </Reveal>
  );
}
