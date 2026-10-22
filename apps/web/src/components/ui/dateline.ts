/** "Thursday 15 October" in a timezone. Plain module, so server and client components can both call it. */
export function formatDateline(now: Date, timeZone: string): string {
  try {
    return new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone }).format(now);
  } catch {
    return new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long" }).format(now);
  }
}
