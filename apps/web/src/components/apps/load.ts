import "server-only";
import type { UserContext } from "@lobby/core";
import {
  listMyOpenAccessRequests, listPinnedAppIds, listRecentAppIds, listRequestableApps, listVisibleApps, type AppRow,
  type LaunchType,
} from "@lobby/core/apps";
import { luminance } from "@lobby/core/apps";
import { resolveAppIcon } from "./brand-icons";
import type { AppIconData } from "./app-icon";

export interface LauncherApp {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  category: string;
  launchType: LaunchType;
  icon: AppIconData;
  /** The brand colour as a hex, for the tile's icon plate. Always set (a neutral slate when unknown). */
  color: string;
}

export interface RequestableApp extends LauncherApp {
  pendingTicket: number | null;
}

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;
/** The app's brand colour, validated, or a neutral slate. Near-black brands stay as they are (the plate inks white). */
function brandHex(color: string | null): string {
  const hex = color && HEX.test(color.trim()) ? color.trim() : "#475066";
  // Near-black brands (GitHub, Notion) become a graphite plate, so the tile still reads as a lit
  // object on the dark theme instead of a hole in it.
  return luminance(hex) < 0.012 ? "#2B313C" : hex;
}

export function toLauncherApp(a: AppRow): LauncherApp {
  return {
    id: a.id,
    slug: a.slug,
    name: a.name,
    description: a.description,
    category: a.category,
    launchType: a.launchType,
    icon: resolveAppIcon(a),
    color: brandHex(a.color),
  };
}

/** Everything the launcher needs for one person, visibility already applied. */
export async function loadLauncher(ctx: UserContext) {
  const visible = await listVisibleApps(ctx);
  const visibleIds = new Set(visible.map((a) => a.id));
  const [pinnedIds, recentIds, requestable, pending] = await Promise.all([
    listPinnedAppIds(ctx, visibleIds),
    listRecentAppIds(ctx, 6, visibleIds),
    listRequestableApps(ctx),
    listMyOpenAccessRequests(ctx),
  ]);
  return {
    apps: visible.map(toLauncherApp),
    pinnedIds,
    recentIds,
    requestable: requestable.map((a) => ({ ...toLauncherApp(a), pendingTicket: pending.get(a.slug)?.number ?? null })),
  };
}

/** Just the pinned apps, in order (for the home page). */
export async function loadPinnedApps(ctx: UserContext): Promise<LauncherApp[]> {
  const visible = await listVisibleApps(ctx);
  const byId = new Map(visible.map((a) => [a.id, a]));
  const pinned = await listPinnedAppIds(ctx, new Set(byId.keys()));
  return pinned.map((id) => toLauncherApp(byId.get(id)!));
}
