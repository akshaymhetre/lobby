/** Pure helpers for the app launcher. No database access, so they are unit tested directly. */

/** An app with no visibility rows is visible to everyone; otherwise to members of any listed group. */
export function isAppVisible(appGroupIds: readonly string[], userGroupIds: readonly string[]): boolean {
  return appGroupIds.length === 0 || appGroupIds.some((g) => userGroupIds.includes(g));
}

/** Only http(s) URLs may be launched. Rejects javascript:, data:, relative paths and junk. */
export function safeLaunchUrl(raw: string): string | null {
  const value = raw.trim();
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  if (!url.hostname) return null;
  return url.toString();
}

/** True when the URL still carries a preset placeholder such as {tenant}. */
export function hasPlaceholder(url: string): boolean {
  return /\{[a-z]+\}/i.test(url);
}

export function slugify(name: string): string {
  return (
    name
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "app"
  );
}

/** Picks `base`, or `base-2`, `base-3`... so it does not collide with `taken`. */
export function uniqueSlug(base: string, taken: ReadonlySet<string>): string {
  if (!taken.has(base)) return base;
  for (let i = 2; ; i++) {
    const candidate = `${base}-${i}`;
    if (!taken.has(candidate)) return candidate;
  }
}

/** Groups items by category, categories in a stable preferred order and then alphabetically. */
export function groupByCategory<T extends { category: string; name: string }>(
  items: readonly T[],
  preferred: readonly string[] = [],
): { category: string; items: T[] }[] {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const list = map.get(item.category) ?? [];
    list.push(item);
    map.set(item.category, list);
  }
  const rank = (c: string) => {
    const i = preferred.indexOf(c);
    return i === -1 ? preferred.length : i;
  };
  return [...map.entries()]
    .sort(([a], [b]) => rank(a) - rank(b) || a.localeCompare(b))
    .map(([category, list]) => ({ category, items: [...list].sort((a, b) => a.name.localeCompare(b.name)) }));
}

/** Moves `id` one place earlier (-1) or later (+1) in an ordered list. Out-of-range moves are no-ops. */
export function moveInOrder(order: readonly string[], id: string, delta: -1 | 1): string[] {
  const next = [...order];
  const i = next.indexOf(id);
  const j = i + delta;
  if (i === -1 || j < 0 || j >= next.length) return next;
  [next[i], next[j]] = [next[j]!, next[i]!];
  return next;
}

/**
 * Validates a client-proposed pin order against the pins the user actually has: keeps only
 * known ids, drops duplicates, and appends any pins the client left out (so nothing is lost).
 */
export function reconcilePinOrder(proposed: readonly string[], current: readonly string[]): string[] {
  const known = new Set(current);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of proposed) {
    if (known.has(id) && !seen.has(id)) {
      seen.add(id);
      out.push(id);
    }
  }
  for (const id of current) if (!seen.has(id)) out.push(id);
  return out;
}

/** Distinct app ids from launches, newest first, up to `limit`. */
export function recentAppIds(launches: readonly { appId: string; at: Date }[], limit = 6): string[] {
  const sorted = [...launches].sort((a, b) => b.at.getTime() - a.at.getTime());
  const out: string[] = [];
  for (const l of sorted) {
    if (!out.includes(l.appId)) out.push(l.appId);
    if (out.length >= limit) break;
  }
  return out;
}

/** Simple case-insensitive match on name, description and category; every word must match. */
export function matchesQuery(app: { name: string; description?: string | null; category: string }, query: string): boolean {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const hay = `${app.name} ${app.description ?? ""} ${app.category}`.toLowerCase();
  return words.every((w) => hay.includes(w));
}

/** Up to two letters for a monogram tile: "Expenses" -> "E", "AWS console" -> "AC". */
export function monogram(name: string): string {
  const words = name.replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter(Boolean);
  if (!words.length) return "?";
  // "Microsoft 365" -> "M": a trailing number is a version, not a word.
  if (words.length === 1 || !/^\p{L}/u.test(words[1]!)) return words[0]![0]!.toUpperCase();
  return (words[0]![0]! + words[1]![0]!).toUpperCase();
}

/** Relative luminance of a #rrggbb colour (0 black .. 1 white). Invalid input counts as mid grey. */
export function luminance(hex: string): number {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return 0.2;
  const n = parseInt(m[1]!, 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * ch[0]! + 0.7152 * ch[1]! + 0.0722 * ch[2]!;
}

/** Text colour for a monogram on a solid brand fill: whichever of white/black contrasts more. */
export function onColor(hex: string): "white" | "black" {
  const l = luminance(hex);
  return (1.05 / (l + 0.05)) >= ((l + 0.05) / 0.05) ? "white" : "black";
}
