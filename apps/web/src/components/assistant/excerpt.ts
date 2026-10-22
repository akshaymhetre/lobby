/**
 * Turns a search chunk (markdown-ish text with tables, lists and prose) into a clean excerpt for an
 * answer card: facts from tables as label/value pairs, list items, and whole sentences. Pure, so
 * it can be tested and reused on the server.
 *
 *   "| Birth parent | Second parent…\nFull pay | 26 weeks | 26 weeks\n…\nYou can take the leave in…"
 *   -> { keyFact: { value: "26 weeks", label: "Full pay" }, facts: [...], items: [], text: "You can take the leave in up to three blocks, each at least two weeks long." }
 */
export interface Excerpt {
  /** The headline number for the top card ("26 weeks"), when the chunk has one. */
  keyFact: { value: string; label: string } | null;
  /** Table rows as label/value, with the header cells stripped. */
  facts: { label: string; value: string }[];
  /** List items, without bullets or numbers. */
  items: string[];
  /** Whole sentences of prose, cut on a sentence boundary, field labels stripped. */
  text: string;
}

const NUMBER_FACT = /\b(\d+(?:[.,]\d+)?\s*(?:%|weeks?|days?|months?|years?|hours?|minutes?|working days|per cent|GBP|EUR|USD)|[£€$]\s?\d[\d,.]*k?)\b/i;
/** "Category: Finance." / "Asks for: App, Access level" / "Handled by the IT team." are metadata, not answer text. */
const FIELD_LINE = /^(category|asks for|tags?|owner|type|handled by|status|last updated|single sign-on link)\b[^.]*\.?$/i;
const FIELD_SENTENCE = /^(category|asks for|tags?|owner|type|status|single sign-on link)\s*:?[^.]*\.?$/i;

function cells(line: string): string[] {
  return line
    .replace(/^\s*\|/, "")
    .replace(/\|\s*$/, "")
    .split("|")
    .map((c) => c.trim())
    .filter((c, i, all) => c.length > 0 || i < all.length - 1);
}

function stripMarks(s: string) {
  return s.replace(/\[\[|\]\]/g, "").replace(/\*\*(.+?)\*\*/g, "$1").replace(/`([^`]+)`/g, "$1").replace(/\s+/g, " ").trim();
}

function sentences(text: string): string[] {
  return (text.match(/[^.!?]+[.!?]+(?=\s|$)|[^.!?]+$/g) ?? []).map((x) => x.trim()).filter(Boolean);
}

/** Up to `max` characters of whole sentences; never cuts inside one unless the first alone is longer. */
export function cutSentences(text: string, max = 220): string {
  const out: string[] = [];
  let n = 0;
  for (const s of sentences(text)) {
    if (FIELD_SENTENCE.test(s)) continue;
    if (n && n + s.length > max) break;
    out.push(s);
    n += s.length + 1;
    if (n >= max) break;
  }
  let joined = out.join(" ");
  if (joined.length > max + 60) joined = `${joined.slice(0, max).replace(/\s+\S*$/, "")}…`;
  return joined;
}

export function buildExcerpt(raw: string): Excerpt {
  const lines = raw.replace(/\r/g, "").split("\n").map((l) => l.trim());
  const facts: Excerpt["facts"] = [];
  const items: string[] = [];
  const prose: string[] = [];
  let header: string[] | null = null;
  for (const line of lines) {
    if (!line) {
      header = null;
      continue;
    }
    if (/^\|?\s*:?-{2,}/.test(line)) continue; // a markdown table rule
    if (line.includes(" | ") || /^\|.*\|$/.test(line)) {
      const row = cells(line).map(stripMarks);
      if (!header) {
        header = row;
        continue; // the header names the columns; it is never the answer
      }
      const [label, ...values] = row;
      if (!label || !values.length) continue;
      const uniq = [...new Set(values.filter(Boolean))];
      const value =
        uniq.length === 1
          ? uniq[0]!
          : values.map((v, i) => (header && header[i + 1] ? `${v} (${header[i + 1]!.toLowerCase()})` : v)).join(", ");
      facts.push({ label, value });
      continue;
    }
    header = null;
    const li = /^(?:[-*•]|\d+[.)])\s+(.*)$/.exec(line);
    if (li) {
      items.push(stripMarks(li[1]!));
      continue;
    }
    const clean = stripMarks(line.replace(/^#+\s*/, ""));
    if (FIELD_LINE.test(clean)) continue;
    prose.push(clean);
  }
  const keyRow = facts.find((f) => NUMBER_FACT.test(f.value) && f.value.length <= 28);
  const keyFact = keyRow ? { value: keyRow.value, label: keyRow.label } : null;
  return { keyFact, facts, items, text: cutSentences(prose.join(" ")) };
}

/**
 * A search snippet (a 28-word window that can start and end mid-sentence) as clean text: the
 * leading fragment and the trailing fragment are dropped when a whole sentence remains; otherwise
 * the fragment is kept with an ellipsis so it reads as an excerpt, not a broken line.
 */
export function cleanSnippet(snippet: string): string {
  let s = stripMarks(snippet).replace(/(\.\.\.|…)\s*$/, "");
  const startsMid = /^[a-z,;]/.test(s);
  const parts = sentences(s);
  if (parts.length > 1) {
    if (startsMid) parts.shift();
    if (!/[.!?]$/.test(parts[parts.length - 1]!)) parts.pop();
    if (parts.length) return parts.filter((p) => !FIELD_SENTENCE.test(p)).join(" ");
  }
  s = s.replace(/[,;:]\s*$/, "");
  return `${startsMid ? "…" : ""}${s}${/[.!?]$/.test(s) ? "" : "…"}`;
}
