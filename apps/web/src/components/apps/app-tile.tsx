"use client";

import * as React from "react";
import { ArrowLeft, ArrowRight, ArrowUpRight, Ellipsis, Pin, PinOff } from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SpotlightLayer } from "@/components/ui/effects/spotlight";
import { Tilt } from "@/components/ui/effects/tilt";
import { Tile } from "@/components/ui/tile-wall";
import { cn } from "@/lib/cn";
import { AppIcon } from "./app-icon";
import { announceLaunch, LAUNCH_CHIP, launchHref } from "./launch";
import type { LauncherApp } from "./load";

export interface TileActions {
  pinned: boolean;
  onTogglePin: (app: LauncherApp) => void;
  /** Present only for pinned tiles in "Your apps". */
  onMove?: (app: LauncherApp, delta: -1 | 1) => void;
  canMoveEarlier?: boolean;
  canMoveLater?: boolean;
  onLaunched?: (app: LauncherApp) => void;
}

function TileMenu({ app, actions, className }: { app: LauncherApp; actions: TileActions; className?: string }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "focus-ring touch-target relative z-10 inline-flex size-8 items-center justify-center rounded-control text-muted",
          "transition-[opacity,background-color,color] duration-120 ease-standard hover:bg-hover hover:text-fg data-[state=open]:bg-hover data-[state=open]:text-fg",
          className,
        )}
        aria-label={`More for ${app.name}`}
      >
        <Ellipsis className="size-4 stroke-[1.5]" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          onSelect={() => {
            announceLaunch(app);
            actions.onLaunched?.(app);
            window.open(launchHref(app.slug), "_blank", "noopener,noreferrer");
          }}
        >
          <ArrowUpRight aria-hidden />
          Open in a new tab
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => actions.onTogglePin(app)}>
          {actions.pinned ? <PinOff aria-hidden /> : <Pin aria-hidden />}
          {actions.pinned ? "Remove from your apps" : "Add to your apps"}
        </DropdownMenuItem>
        {actions.onMove ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled={!actions.canMoveEarlier} onSelect={() => actions.onMove?.(app, -1)} shortcut="Alt ←">
              <ArrowLeft aria-hidden />
              Move earlier
            </DropdownMenuItem>
            <DropdownMenuItem disabled={!actions.canMoveLater} onSelect={() => actions.onMove?.(app, 1)} shortcut="Alt →">
              <ArrowRight aria-hidden />
              Move later
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Keyboard shortcuts on a focused tile link: Alt+arrows reorder pinned tiles. */
function onTileKeyDown(e: React.KeyboardEvent, app: LauncherApp, actions: TileActions) {
  if (!actions.onMove || !e.altKey) return;
  if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
    e.preventDefault();
    e.stopPropagation();
    if (actions.canMoveEarlier) actions.onMove(app, -1);
  } else if (e.key === "ArrowRight" || e.key === "ArrowDown") {
    e.preventDefault();
    e.stopPropagation();
    if (actions.canMoveLater) actions.onMove(app, 1);
  }
}

/** A row in a category list: icon, name, description, how it signs you in. The whole row opens the app. */
export function AppRow({
  app,
  actions,
  highlighted = false,
}: {
  app: LauncherApp;
  actions: TileActions;
  highlighted?: boolean;
}) {
  const label = `${app.name}${app.launchType !== "bookmark" ? ", signs you in automatically" : ""}. Opens in a new tab.`;
  const chip = LAUNCH_CHIP[app.launchType];
  return (
    <div
      className={cn(
        "group relative flex min-h-[52px] items-center gap-3 px-3 py-2 transition-colors duration-120 ease-standard hover:bg-hover",
        "has-[a[data-tile]:focus-visible]:outline-2 has-[a[data-tile]:focus-visible]:-outline-offset-2 has-[a[data-tile]:focus-visible]:outline-accent-ring",
        highlighted && "bg-accent-soft/60",
      )}
    >
      <AppIcon icon={app.icon} size="sm" />
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="flex min-w-0 items-center gap-1.5 text-body font-medium text-fg">
          <span className="truncate">{app.name}</span>
          {actions.pinned ? (
            <span className="inline-flex text-subtle" title="In your apps">
              <Pin className="size-3.5 stroke-[1.5]" aria-hidden />
              <span className="sr-only">In your apps</span>
            </span>
          ) : null}
        </span>
        {app.description ? (
          <span className="truncate text-small text-muted" title={app.description}>
            {app.description}
          </span>
        ) : null}
      </div>
      {chip ? (
        <span className="hidden shrink-0 text-caption text-subtle sm:inline" title={chip.title}>
          {chip.label}
        </span>
      ) : null}
      <a
        data-tile
        href={launchHref(app.slug)}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={label}
        className="absolute inset-0 outline-none"
        onClick={() => {
          announceLaunch(app);
          actions.onLaunched?.(app);
        }}
        onKeyDown={(e) => onTileKeyDown(e, app, actions)}
      />
      <TileMenu
        app={app}
        actions={actions}
        className="-mr-1 md:opacity-0 md:group-hover:opacity-100 md:group-has-[:focus-visible]:opacity-100 md:data-[state=open]:opacity-100"
      />
    </div>
  );
}

/**
 * A tile on the app wall (wave 3): the kit's raised Tile with a glossy plate in the app's brand
 * colour, the name at 15px and what it is for underneath, then how it signs you in. The whole tile
 * opens the app (a stretched link, so the More menu can sit on top of it). Press depth comes from
 * the tile: it lifts on hover and sinks with an inner shadow while pressed.
 */
export function AppTile({
  app,
  actions,
  highlighted = false,
}: {
  app: LauncherApp;
  actions: TileActions;
  highlighted?: boolean;
}) {
  const sso = app.launchType !== "bookmark";
  const label = `${app.name}${sso ? ", signs you in automatically" : ""}. Opens in a new tab.`;
  return (
    <Tile
      fill
      color={app.color}
      icon={<AppIcon icon={app.icon} size="md" onPlate />}
      // The kit truncates the label; an inner block lets a long name ("Google Workspace") take two lines instead.
      label={<span className="line-clamp-2 block whitespace-normal">{app.name}</span>}
      // Phones keep the wall short: name and sign-in only, the description from md up.
      meta={<span className="max-md:hidden">{app.description ?? app.category}</span>}
      badge={
        <TileMenu
          app={app}
          actions={actions}
          className="size-8 text-[var(--tile-ink)] hover:bg-black/15 hover:text-[var(--tile-ink)] data-[state=open]:bg-black/15 data-[state=open]:text-[var(--tile-ink)] md:opacity-0 md:group-hover/tile:opacity-100 md:group-has-[:focus-visible]/tile:opacity-100 md:data-[state=open]:opacity-100"
        />
      }
      className={cn(
        "min-h-[132px] max-md:gap-2 max-md:p-4 md:min-h-[172px] hover:-translate-y-0.5 hover:shadow-[inset_0_1px_0_rgb(255_255_255/0.3),0_18px_34px_-14px_var(--tile)] active:translate-y-0.5 active:shadow-[inset_0_2px_6px_rgb(0_0_0/0.25)] motion-reduce:hover:translate-y-0 motion-reduce:active:translate-y-0",
        "has-[a[data-tile]:focus-visible]:outline-2 has-[a[data-tile]:focus-visible]:outline-offset-2 has-[a[data-tile]:focus-visible]:outline-accent-ring",
        highlighted && "ring-2 ring-accent-ring",
      )}
    >
      <span className="-mt-1 flex items-center gap-1.5 text-caption">
        <span aria-hidden className={cn("size-1.5 rounded-full bg-current", !sso && "opacity-50")} />
        {sso ? "Signs you in" : "Own sign-in"}
        {actions.pinned ? (
          <span className="ml-auto inline-flex items-center gap-1" title="In your apps">
            <Pin className="size-3.5 stroke-[1.75]" aria-hidden />
            <span className="sr-only">In your apps</span>
          </span>
        ) : null}
      </span>
      <a
        data-tile
        href={launchHref(app.slug)}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={label}
        className="absolute inset-0 rounded-panel outline-none"
        onClick={() => {
          announceLaunch(app);
          actions.onLaunched?.(app);
        }}
        onKeyDown={(e) => onTileKeyDown(e, app, actions)}
      />
    </Tile>
  );
}

/** The brand colour behind an icon, for the tile's glow; null when the glyph follows the text colour. */
function brandColour(icon: LauncherApp["icon"]): string | null {
  return icon.kind === "image" ? null : icon.color;
}

/**
 * A tile in the "Your apps" hero: the brand icon on a raised disc with the brand's own colour as a
 * soft glow under it, the name, and how it signs you in. The `targetRef` is the point the
 * launcher's sign-on beam lands on (the disc).
 */
export function PinnedTile({
  app,
  actions,
  dragging = false,
  dragProps,
  targetRef,
}: {
  app: LauncherApp;
  actions: TileActions;
  dragging?: boolean;
  dragProps?: React.HTMLAttributes<HTMLDivElement> & { draggable?: boolean };
  targetRef?: React.Ref<HTMLSpanElement>;
}) {
  const glow = brandColour(app.icon);
  const sso = app.launchType !== "bookmark";
  // The tile tilts under the pointer (Tilt owns the press scale) and carries a spotlight; both are
  // decorative, sit under the content, and stay out of the way of the launch link and the menu.
  return (
    <Tilt
      {...dragProps}
      className={cn(
        "group relative isolate flex h-[132px] flex-col md:h-[148px] items-center justify-center gap-2 rounded-card cell px-2 pt-1",
        "transition-[opacity,box-shadow] duration-160 ease-standard hover:shadow-cell-hover",
        "has-[a[data-tile]:focus-visible]:outline-2 has-[a[data-tile]:focus-visible]:outline-offset-2 has-[a[data-tile]:focus-visible]:outline-accent-ring",
        dragging && "opacity-40",
      )}
    >
      <SpotlightLayer />
      <span ref={targetRef} className="relative grid size-14 place-items-center rounded-[18px]">
        {/* The brand's own colour, as light under the disc. Decorative. */}
        <span
          aria-hidden
          className="absolute -inset-3 -z-10 rounded-full opacity-70 blur-xl transition-opacity duration-200 group-hover:opacity-100 dark:opacity-60"
          style={{ background: `radial-gradient(closest-side, ${glow ? `color-mix(in srgb, ${glow} 45%, transparent)` : "var(--lb-glow-cyan)"}, transparent)` }}
        />
        <span className="grid size-14 place-items-center rounded-[18px] bg-raised shadow-cell [box-shadow:var(--lb-shadow-cell),inset_0_1px_0_rgb(255_255_255/0.6)] dark:bg-white/[0.06] dark:[box-shadow:inset_0_1px_0_rgb(255_255_255/0.08)]">
          <AppIcon icon={app.icon} size="lg" />
        </span>
      </span>
      <span className="mt-1 w-full truncate text-center text-body font-medium text-fg">{app.name}</span>
      <span className="-mt-1.5 inline-flex items-center gap-1.5 text-caption text-subtle">
        <span aria-hidden className={cn("size-1.5 rounded-full", sso ? "bg-success" : "bg-border-strong")} />
        {sso ? "Signs you in" : "Own sign-in"}
      </span>
      <a
        data-tile
        href={launchHref(app.slug)}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`${app.name}. Opens in a new tab.`}
        className="absolute inset-0 rounded-card outline-none"
        draggable={false}
        onClick={() => {
          announceLaunch(app);
          actions.onLaunched?.(app);
        }}
        onKeyDown={(e) => onTileKeyDown(e, app, actions)}
      />
      <div className="absolute right-1 top-1">
        <TileMenu
          app={app}
          actions={actions}
          className="size-7 md:opacity-0 md:group-hover:opacity-100 md:group-has-[:focus-visible]:opacity-100 md:data-[state=open]:opacity-100"
        />
      </div>
    </Tilt>
  );
}

/** A small pill for "Recently used". */
export function RecentPill({ app, onLaunched }: { app: LauncherApp; onLaunched?: (app: LauncherApp) => void }) {
  return (
    <a
      data-tile
      href={launchHref(app.slug)}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`${app.name}. Opens in a new tab.`}
      onClick={() => {
        announceLaunch(app);
        onLaunched?.(app);
      }}
      className={cn(
        "focus-ring press inline-flex h-11 shrink-0 items-center gap-2.5 rounded-full bg-raised pl-1.5 pr-4 shadow-cell md:h-10",
        "text-body font-medium text-fg hover:shadow-cell-hover",
      )}
    >
      <AppIcon icon={app.icon} size="sm" className="rounded-full" />
      {app.name}
    </a>
  );
}
