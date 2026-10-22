/**
 * Allow-list HTML sanitizer for news posts. Posts render with dangerouslySetInnerHTML, so this
 * runs on the server before anything is stored. It is deliberately small and strict:
 *  - only the tags below survive; every other tag is dropped (its text is kept),
 *  - script, style and similar elements are dropped with their content,
 *  - every attribute is dropped except href on links, which must be http(s), mailto or a
 *    same-site path, and links get rel="noopener noreferrer",
 *  - text is re-escaped, and the output is always well nested.
 */

const ALLOWED = new Set([
  "p", "br", "h2", "h3", "h4", "strong", "b", "em", "i", "u", "s", "code", "pre", "blockquote",
  "ul", "ol", "li", "a", "hr",
]);
const VOID = new Set(["br", "hr"]);
/** Elements removed together with everything inside them. */
const DROP_WITH_CONTENT = new Set([
  "script", "style", "iframe", "object", "embed", "template", "noscript", "textarea", "select", "svg", "math", "head", "title",
]);
/** Map presentational tags onto their semantic twins so output stays consistent. */
const RENAME: Record<string, string> = { b: "strong", i: "em" };

export function safeHref(raw: string): string | null {
  const v = decodeEntities(raw).trim().replace(/[\u0000-\u001F\u007F\s]+/g, "");
  if (!v) return null;
  if (/^(https?:\/\/|mailto:)/i.test(v)) return v;
  if (v.startsWith("/") && !v.startsWith("//") && !v.startsWith("/\\")) return v;
  if (v.startsWith("#")) return v;
  return null;
}

const NAMED: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", "#39": "'" };

function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);?/gi, (m, e: string) => {
    const k = e.toLowerCase();
    if (k.startsWith("#x")) return String.fromCodePoint(parseInt(k.slice(2), 16) || 0xfffd);
    if (k.startsWith("#")) return String.fromCodePoint(parseInt(k.slice(1), 10) || 0xfffd);
    return NAMED[k] ?? m;
  });
}

export function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function attr(attrs: string, name: string): string | null {
  const re = new RegExp(`(?:^|\\s)${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'>]+))`, "i");
  const m = re.exec(attrs);
  return m ? (m[1] ?? m[2] ?? m[3] ?? "") : null;
}

export function sanitizePostHtml(input: string): string {
  const html = input.replace(/<!--[\s\S]*?(-->|$)/g, "");
  const out: string[] = [];
  const stack: string[] = [];
  const tagRe = /<\s*(\/?)\s*([a-zA-Z][a-zA-Z0-9-]*)((?:"[^"]*"|'[^']*'|[^'">])*)>/g;
  let last = 0;
  let dropping: string | null = null;

  const text = (s: string) => {
    if (!dropping && s) out.push(escapeHtml(decodeEntities(s)));
  };

  for (let m = tagRe.exec(html); m; m = tagRe.exec(html)) {
    text(html.slice(last, m.index));
    last = m.index + m[0].length;
    const closing = m[1] === "/";
    const raw = m[2]!.toLowerCase();
    if (dropping) {
      if (closing && raw === dropping) dropping = null;
      continue;
    }
    if (DROP_WITH_CONTENT.has(raw)) {
      if (!closing && !/\/\s*$/.test(m[3] ?? "")) dropping = raw;
      continue;
    }
    if (!ALLOWED.has(raw)) continue;
    const tag = RENAME[raw] ?? raw;
    if (VOID.has(tag)) {
      if (!closing) out.push(`<${tag}>`);
      continue;
    }
    if (closing) {
      const i = stack.lastIndexOf(tag);
      if (i === -1) continue;
      while (stack.length > i) out.push(`</${stack.pop()}>`);
      continue;
    }
    if (tag === "a") {
      const href = safeHref(attr(m[3] ?? "", "href") ?? "");
      out.push(href ? `<a href="${escapeHtml(href)}" rel="noopener noreferrer">` : "<a>");
    } else {
      out.push(`<${tag}>`);
    }
    stack.push(tag);
  }
  text(html.slice(last));
  while (stack.length) out.push(`</${stack.pop()}>`);
  return out
    .join("")
    .replace(/<(p|h2|h3|h4|li|blockquote|strong|em|u|s|code)><\/\1>/g, "")
    .trim();
}

/** Plain-text length of sanitized HTML, used to refuse empty posts. */
export function htmlTextLength(html: string): number {
  return decodeEntities(html.replace(/<[^>]+>/g, "")).trim().length;
}
