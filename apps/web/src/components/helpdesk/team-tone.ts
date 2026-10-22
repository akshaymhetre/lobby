/**
 * Each helpdesk team owns one category colour, used everywhere a request shows which team has it:
 * the catalogue tiles, "In flight", the approvals deck. Amber and coral are NOT team colours,
 * because they mean "due" and "breaching" on the queue; a team never borrows a warning.
 * Teams an admin adds later get a stable colour from their name.
 */
/** The four team colours: a subset of the category tones that never means "due" or "breaching". */
export type TeamTone = "blue" | "violet" | "teal" | "green";

const KNOWN: Record<string, TeamTone> = {
  it: "blue",
  people: "violet",
  workplace: "teal",
  finance: "green",
};
const CYCLE: TeamTone[] = ["blue", "violet", "teal", "green"];

export function teamTone(slugOrName: string | null | undefined): TeamTone {
  const k = (slugOrName ?? "").trim().toLowerCase();
  if (KNOWN[k]) return KNOWN[k];
  let h = 0;
  for (let i = 0; i < k.length; i++) h = (h * 31 + k.charCodeAt(i)) >>> 0;
  return CYCLE[h % CYCLE.length]!;
}
