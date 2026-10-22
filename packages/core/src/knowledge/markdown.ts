/**
 * A small Markdown subset -> Tiptap JSON converter, used to author seed and starter content.
 * Supports: ## / ### headings, paragraphs, - bullets, 1. ordered, - [ ] / - [x] tasks, > quotes,
 * :::info|warning|success|danger callouts, ``` code, --- rules, | tables |, and inline
 * **bold**, *italic*, `code` and [links](/path). Pure: no imports, safe anywhere (the db seed imports it).
 */

type Mark = { type: string; attrs?: Record<string, unknown> };
type Node = { type: string; attrs?: Record<string, unknown>; content?: Node[]; text?: string; marks?: Mark[] };

const INLINE = /(\*\*([^*]+)\*\*|\*([^*]+)\*|`([^`]+)`|\[([^\]]+)\]\(([^)\s]+)\))/g;

export function inline(text: string): Node[] {
  const out: Node[] = [];
  let last = 0;
  for (const m of text.matchAll(INLINE)) {
    const i = m.index ?? 0;
    if (i > last) out.push({ type: "text", text: text.slice(last, i) });
    if (m[2]) out.push({ type: "text", text: m[2], marks: [{ type: "bold" }] });
    else if (m[3]) out.push({ type: "text", text: m[3], marks: [{ type: "italic" }] });
    else if (m[4]) out.push({ type: "text", text: m[4], marks: [{ type: "code" }] });
    else if (m[5] && m[6]) out.push({ type: "text", text: m[5], marks: [{ type: "link", attrs: { href: m[6] } }] });
    last = i + m[0].length;
  }
  if (last < text.length) out.push({ type: "text", text: text.slice(last) });
  return out.filter((n) => n.text);
}

const para = (text: string): Node => {
  const content = inline(text.trim());
  return content.length ? { type: "paragraph", content } : { type: "paragraph" };
};

export function markdownToDoc(md: string): Node {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const blocks: Node[] = [];
  let i = 0;
  const peek = () => lines[i] ?? "";

  while (i < lines.length) {
    const line = peek();
    const t = line.trim();
    if (!t) {
      i++;
      continue;
    }
    // Code fence
    if (t.startsWith("```")) {
      const lang = t.slice(3).trim() || null;
      const body: string[] = [];
      i++;
      while (i < lines.length && !peek().trim().startsWith("```")) body.push(lines[i++]!);
      i++;
      blocks.push({ type: "codeBlock", attrs: { language: lang }, content: body.length ? [{ type: "text", text: body.join("\n") }] : undefined });
      continue;
    }
    // Callout
    const callout = t.match(/^:::(info|warning|success|danger)$/);
    if (callout) {
      const body: string[] = [];
      i++;
      while (i < lines.length && peek().trim() !== ":::") body.push(lines[i++]!);
      i++;
      const inner = markdownToDoc(body.join("\n")).content ?? [para("")];
      blocks.push({ type: "callout", attrs: { tone: callout[1] }, content: inner });
      continue;
    }
    const h = t.match(/^(#{2,4})\s+(.*)$/);
    if (h) {
      blocks.push({ type: "heading", attrs: { level: h[1]!.length }, content: inline(h[2]!) });
      i++;
      continue;
    }
    if (/^---+$/.test(t)) {
      blocks.push({ type: "horizontalRule" });
      i++;
      continue;
    }
    if (t.startsWith("|")) {
      const rows: string[][] = [];
      while (i < lines.length && peek().trim().startsWith("|")) {
        const cells = peek().trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
        if (!cells.every((c) => /^:?-{2,}:?$/.test(c))) rows.push(cells);
        i++;
      }
      blocks.push({
        type: "table",
        content: rows.map((cells, r) => ({
          type: "tableRow",
          content: cells.map((c) => ({ type: r === 0 ? "tableHeader" : "tableCell", content: [para(c)] })),
        })),
      });
      continue;
    }
    if (t.startsWith("> ")) {
      const body: string[] = [];
      while (i < lines.length && peek().trim().startsWith(">")) body.push(peek().trim().replace(/^>\s?/, "")), i++;
      blocks.push({ type: "blockquote", content: [para(body.join(" "))] });
      continue;
    }
    if (/^- \[( |x)\] /.test(t)) {
      const items: Node[] = [];
      while (i < lines.length && /^- \[( |x)\] /.test(peek().trim())) {
        const m = peek().trim().match(/^- \[( |x)\] (.*)$/)!;
        items.push({ type: "taskItem", attrs: { checked: m[1] === "x" }, content: [para(m[2]!)] });
        i++;
      }
      blocks.push({ type: "taskList", content: items });
      continue;
    }
    if (/^- /.test(t)) {
      const items: Node[] = [];
      while (i < lines.length && /^- /.test(peek().trim()) && !/^- \[( |x)\] /.test(peek().trim())) items.push({ type: "listItem", content: [para(peek().trim().slice(2))] }), i++;
      blocks.push({ type: "bulletList", content: items });
      continue;
    }
    if (/^\d+\. /.test(t)) {
      // Keep the author's numbering, so a list split by a code block continues at 2, 3...
      const start = Number(t.match(/^(\d+)\./)![1]);
      const items: Node[] = [];
      while (i < lines.length && /^\d+\. /.test(peek().trim())) items.push({ type: "listItem", content: [para(peek().trim().replace(/^\d+\. /, ""))] }), i++;
      blocks.push({ type: "orderedList", attrs: { start }, content: items });
      continue;
    }
    // Paragraph: consecutive plain lines
    const body: string[] = [];
    while (i < lines.length) {
      const l = peek().trim();
      if (body.length && (!l || /^(#{2,4}\s|```|:::|---+$|\||> |- |\d+\. )/.test(l))) break;
      if (!l) break;
      body.push(l);
      i++;
    }
    blocks.push(para(body.join(" ")));
  }
  return { type: "doc", content: blocks.length ? blocks : [{ type: "paragraph" }] };
}
