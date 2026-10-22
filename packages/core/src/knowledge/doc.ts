/**
 * Pure helpers over the Tiptap (ProseMirror) JSON stored in `pages.content`.
 * No database, no React: safe to import from server code, the worker and client components.
 */

export interface DocMark {
  type: string;
  attrs?: Record<string, unknown>;
}

export interface DocNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: DocNode[];
  text?: string;
  marks?: DocMark[];
}

export const EMPTY_DOC: DocNode = { type: "doc", content: [{ type: "paragraph" }] };

/** Coerces whatever is in the content column into a doc node. */
export function asDoc(value: unknown): DocNode {
  if (value && typeof value === "object" && (value as DocNode).type === "doc") return value as DocNode;
  return EMPTY_DOC;
}

/** Inline text of a node (marks ignored, hard breaks become spaces). */
export function inlineText(node: DocNode): string {
  if (node.type === "text") return node.text ?? "";
  if (node.type === "hardBreak") return " ";
  return (node.content ?? []).map(inlineText).join("");
}

/** "Before you start: VPN & MFA" -> "before-you-start-vpn-mfa". */
export function slugify(text: string): string {
  const s = text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64)
    .replace(/-+$/g, "");
  return s || "section";
}

export interface OutlineItem {
  level: number;
  text: string;
  id: string;
}

/**
 * Headings (level 2 and 3) in document order with stable, de-duplicated anchor ids.
 * The page renderer and the search indexer both use this, so a search hit's anchor always lands.
 */
export function docOutline(doc: DocNode): OutlineItem[] {
  const seen = new Map<string, number>();
  const out: OutlineItem[] = [];
  for (const node of doc.content ?? []) {
    if (node.type !== "heading") continue;
    const level = Number(node.attrs?.level ?? 2);
    const text = inlineText(node).trim();
    if (!text) continue;
    const base = slugify(text);
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    out.push({ level, text, id: n === 1 ? base : `${base}-${n}` });
  }
  return out;
}

/** Plain-text projection of a block, one line per paragraph-ish unit. */
function blockText(node: DocNode, depth = 0): string {
  switch (node.type) {
    case "paragraph":
    case "heading":
      return inlineText(node).trim();
    case "codeBlock":
      return inlineText(node);
    case "bulletList":
    case "orderedList":
    case "taskList":
      return (node.content ?? []).map((li, i) => {
        const marker =
          node.type === "orderedList" ? `${Number(node.attrs?.start ?? 1) + i}.` : node.type === "taskList" ? (li.attrs?.checked ? "[x]" : "[ ]") : "-";
        const inner = (li.content ?? []).map((c) => blockText(c, depth + 1)).filter(Boolean);
        const [first = "", ...rest] = inner;
        return [`${"  ".repeat(depth)}${marker} ${first}`, ...rest].join("\n");
      }).join("\n");
    case "table":
      return (node.content ?? [])
        .map((row) => (row.content ?? []).map((cell) => (cell.content ?? []).map((c) => blockText(c)).join(" ").trim()).join(" | "))
        .join("\n");
    case "horizontalRule":
      return "";
    default:
      return (node.content ?? []).map((c) => blockText(c, depth)).filter(Boolean).join("\n\n");
  }
}

/** Plain-text projection of a whole document. Paragraphs are separated by blank lines. */
export function docToText(doc: DocNode): string {
  return (doc.content ?? [])
    .map((n) => blockText(n))
    .filter((t) => t.trim().length > 0)
    .join("\n\n");
}

export interface DocSection {
  /** Heading text, or null for the content before the first heading. */
  heading: string | null;
  id: string | null;
  text: string;
}

/**
 * Splits a document at level-2 headings (level 3 and deeper stay inside their section),
 * so search can point at "Holiday policy > Carrying days over" with an anchor.
 */
export function docSections(doc: DocNode): DocSection[] {
  const outline = docOutline(doc);
  let oi = 0;
  const sections: { heading: string | null; id: string | null; nodes: DocNode[] }[] = [{ heading: null, id: null, nodes: [] }];
  for (const node of doc.content ?? []) {
    if (node.type === "heading" && inlineText(node).trim()) {
      const item = outline[oi++];
      if (item && item.level <= 2) {
        sections.push({ heading: item.text, id: item.id, nodes: [] });
        continue;
      }
    }
    sections[sections.length - 1]!.nodes.push(node);
  }
  return sections
    .map((s) => ({ heading: s.heading, id: s.id, text: docToText({ type: "doc", content: s.nodes }) }))
    .filter((s) => s.text.trim() || s.heading);
}

/** Only these link targets are ever rendered as links. Anything else renders as plain text. */
export function safeHref(href: unknown): string | null {
  if (typeof href !== "string") return null;
  const h = href.trim();
  if (/^https?:\/\//i.test(h) || /^mailto:/i.test(h)) return h;
  if (h.startsWith("/") && !h.startsWith("//")) return h;
  if (h.startsWith("#")) return h;
  return null;
}

/** Word count, for the "6 min read" line. */
export function wordCount(text: string): number {
  return (text.match(/[\p{L}\p{N}']+/gu) ?? []).length;
}
