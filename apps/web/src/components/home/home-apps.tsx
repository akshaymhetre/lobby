"use client";

import type * as React from "react";
import Link from "next/link";
import { ArrowUpRight, Pin } from "lucide-react";
import { AppIcon } from "@/components/apps/app-icon";
import { announceLaunch, launchHref } from "@/components/apps/launch";
import type { LauncherApp } from "@/components/apps/load";
import { inkOn } from "@/components/ui/tile-wall";
import { cn } from "@/lib/cn";

/** "Your apps": the person's pinned launcher tiles as raised cells, in their order. */
export function HomeApps({ apps, className }: { apps: LauncherApp[]; className?: string }) {
  return (
    <section id="home-apps" aria-labelledby="home-apps-heading" className={cn("flex scroll-mt-24 flex-col rounded-panel panel p-5", className)}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 id="home-apps-heading" className="text-h3 font-medium text-fg md:text-h2">
          Your apps
        </h2>
        <Link href="/apps" className="focus-ring touch-target press inline-flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-raised px-3 text-small font-medium text-fg shadow-cell">
          <ArrowUpRight className="size-3.5 stroke-[1.75]" aria-hidden />
          All apps
        </Link>
      </div>
      {apps.length ? (
        <ul className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(56px, 1fr))" }}>
          {apps.slice(0, 8).map((app) => (
            <li key={app.id}>
              <a
                href={launchHref(app.slug)}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => announceLaunch(app)}
                aria-label={`${app.name}. Opens in a new tab.`}
                className="focus-ring press flex flex-col items-center gap-2 rounded-card bg-raised px-1 py-3 shadow-cell hover:shadow-cell-hover"
              >
                {/* The same glossy brand plate as the Apps wall, so an app looks the same everywhere. */}
                <span
                  aria-hidden
                  className="inline-flex size-10 items-center justify-center rounded-[12px] shadow-[inset_0_1px_0_rgb(255_255_255/0.35),0_6px_12px_-6px_var(--tile)] [&>svg]:size-5"
                  style={{ "--tile": app.color, background: `linear-gradient(180deg, ${app.color}, color-mix(in oklch, ${app.color} 86%, black))`, color: inkOn(app.color) } as React.CSSProperties}
                >
                  <AppIcon icon={app.icon} size="sm" onPlate />
                </span>
                <span className="w-full truncate text-center text-caption text-fg">{app.name}</span>
              </a>
            </li>
          ))}
        </ul>
      ) : (
        <div className="flex flex-col items-start gap-3 rounded-card bg-raised/60 px-4 py-4">
          <p className="flex items-start gap-3 text-small text-muted">
            <Pin className="mt-0.5 size-4 shrink-0 stroke-[1.75] text-muted" aria-hidden />
            Pin the apps you use most and open them from here with one click.
          </p>
          <Link href="/apps" className="focus-ring touch-target press inline-flex h-8 items-center gap-1.5 rounded-full bg-raised px-3 text-small font-medium text-fg shadow-cell">
            Browse apps
            <ArrowUpRight className="size-3.5 stroke-[1.75]" aria-hidden />
          </Link>
        </div>
      )}
    </section>
  );
}
