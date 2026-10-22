/**
 * Deflection relevance: which knowledge hits are worth showing under a request's summary.
 *
 * Full-text search ANDs every word, so a sentence like "VPN keeps dropping at home" rarely matches a
 * page word for word. The old fallback OR-ed every meaningful word and showed whatever came back,
 * so "I need a diagram tool for my laptop" offered the Accessories, MFA and Data handling pages
 * because each contained "laptop" or "tool" once (audit E2).
 *
 * The rule now: a page from the OR search is shown only when it shares at least two of the query's
 * terms, where a term in the page title counts double (a page titled "Using the VPN" is about VPNs,
 * a page that mentions "laptop" once is not about laptops). Pages that match every term (the strict
 * search) are shown as they are.
 */

const STOPWORDS = new Set(
  (
    "the and for with from that this have has had not but can cant can't won't wont does doesn't dont don't how what when where why who which " +
    "need needs want wants please help also into onto about just keep keeps still my our your their its was were are is be been being any some get got " +
    "every few minute minutes hour hours day days week weeks again always never very really much more less lots lot new old one two " +
    "someone something anything everything nothing like only all each there here then than too use using"
  ).split(" "),
);

/** The words of a subject worth searching for: lowercase, no stopwords, at least three characters, at most eight. */
export function queryTerms(subject: string): string[] {
  const words = subject.toLowerCase().match(/[a-z0-9][a-z0-9'-]{2,}/g) ?? [];
  return [...new Set(words)].filter((w) => !STOPWORDS.has(w)).slice(0, 8);
}

/** A crude stem so "dropping" meets "drops" and "diagram" meets "diagramming". Enough for a floor, not a search engine. */
export function stem(word: string): string {
  let s = word.toLowerCase();
  for (const suffix of ["ing", "ed", "es", "s"]) {
    if (s.length > suffix.length + 3 && s.endsWith(suffix)) {
      s = s.slice(0, -suffix.length);
      break;
    }
  }
  if (s.length > 3 && s[s.length - 1] === s[s.length - 2]) s = s.slice(0, -1);
  return s;
}

/** Title hit = 2, body hit = 1, per term. The page qualifies at 2 or more. */
export const RELEVANCE_FLOOR = 2;

export function relevance(hit: { title: string; text: string }, terms: string[]): number {
  const title = hit.title.toLowerCase();
  const body = hit.text.toLowerCase();
  let score = 0;
  for (const term of terms) {
    const s = stem(term);
    if (title.includes(s)) score += 2;
    else if (body.includes(s)) score += 1;
  }
  return score;
}

/** Keeps the hits at or above the floor, most relevant first (ties broken by the search score), capped. */
export function rankLooseHits<T extends { title: string; text: string; score: number }>(hits: T[], terms: string[], cap = 3): T[] {
  return hits
    .map((hit) => ({ hit, r: relevance(hit, terms) }))
    .filter(({ r }) => r >= RELEVANCE_FLOOR)
    .sort((a, b) => b.r - a.r || b.hit.score - a.hit.score)
    .slice(0, cap)
    .map(({ hit }) => hit);
}
