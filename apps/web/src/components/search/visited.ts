import type { SearchResultType } from "./types";

/*
 * What the reader searched for and opened recently, kept in this browser only (localStorage).
 * Shared by the Cmd-K palette and the search page's no-query state, so both show the same list.
 */
export const RECENT_KEY = "lobby:recent-searches";
export const MAX_RECENT = 6;
export const VISITED_KEY = "lobby:recent-pages";
export const MAX_VISITED = 5;

export function readRecent(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").slice(0, MAX_RECENT) : [];
  } catch {
    return [];
  }
}

export function writeRecent(list: string[]) {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, MAX_RECENT)));
  } catch {
    /* storage unavailable: recent searches are a convenience only */
  }
}

/** A page the reader opened, remembered in this browser only. */
export interface Visited {
  href: string;
  title: string;
  type: SearchResultType;
}

export function readVisited(): Visited[] {
  try {
    const v = JSON.parse(localStorage.getItem(VISITED_KEY) ?? "[]");
    return Array.isArray(v)
      ? v
          .filter((x): x is Visited => !!x && typeof x.href === "string" && typeof x.title === "string" && typeof x.type === "string")
          .slice(0, MAX_VISITED)
      : [];
  } catch {
    return [];
  }
}

export function writeVisited(list: Visited[]) {
  try {
    localStorage.setItem(VISITED_KEY, JSON.stringify(list.slice(0, MAX_VISITED)));
  } catch {
    /* storage unavailable */
  }
}
