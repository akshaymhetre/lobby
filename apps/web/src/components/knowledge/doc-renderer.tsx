import * as React from "react";
import Link from "next/link";
import { Check, CircleAlert, CircleCheck, Info, Link2, TriangleAlert } from "lucide-react";
import { docOutline, inlineText, safeHref, type DocMark, type DocNode } from "@lobby/core/knowledge/doc";
import { cn } from "@/lib/cn";

/**
 * Renders stored Tiptap JSON as React elements. There is no HTML string anywhere on this path,
 * so nothing to sanitise: text is escaped by React and links pass through `safeHref`, which only
 * allows http(s), mailto, same-site paths and in-page anchors.
 */
export function DocRenderer({ doc, className }: { doc: DocNode; className?: string }) {
  const outline = docOutline(doc);
  const blocks = doc.content ?? [];
  // Top-level block index -> anchor id, in the same order docOutline assigns them.
  const anchorAt = new Map<number, string>();
  let next = 0;
  blocks.forEach((node, i) => {
    if (node.type === "heading" && inlineHasText(node)) {
      const item = outline[next++];
      if (item) anchorAt.set(i, item.id);
    }
  });
  return (
    <div className={cn("text-body-lg leading-[26px] text-fg [&>*:first-child]:mt-0", className)}>
      {blocks.map((node, i) => (
        <Block key={i} node={node} anchor={anchorAt.get(i)} />
      ))}
    </div>
  );
}

const inlineHasText = (node: DocNode) => inlineText(node).trim().length > 0;

const CALLOUT = {
  info: { box: "bg-info-soft", icon: Info, iconClass: "text-info-text", label: "Note" },
  warning: { box: "bg-warning-soft", icon: TriangleAlert, iconClass: "text-warning-text", label: "Warning" },
  success: { box: "bg-success-soft", icon: CircleCheck, iconClass: "text-success-text", label: "Tip" },
  danger: { box: "bg-danger-soft", icon: CircleAlert, iconClass: "text-danger-text", label: "Important" },
} as const;

function Block({ node, anchor }: { node: DocNode; anchor?: string }): React.ReactNode {
  const kids = (node.content ?? []).map((c, i) => <Block key={i} node={c} />);
  switch (node.type) {
    case "paragraph":
      return node.content?.length ? <p className="my-4 text-pretty">{inlineNodes(node.content)}</p> : <p className="my-4 h-6" aria-hidden />;
    case "heading": {
      const level = Math.min(Math.max(Number(node.attrs?.level ?? 2), 2), 4);
      const id = anchor;
      const Tag = (`h${level}` as "h2" | "h3" | "h4");
      return (
        <Tag
          id={id}
          className={cn(
            "group relative scroll-mt-20 font-medium text-fg text-balance",
            level === 2 && "mb-3 mt-10 text-h3",
            level === 3 && "mb-2 mt-8 text-h4",
            level === 4 && "mb-2 mt-6 text-body-lg",
          )}
        >
          {inlineNodes(node.content ?? [])}
          {id ? (
            <a
              href={`#${id}`}
              className="focus-ring ml-2 inline-flex size-6 translate-y-[-1px] items-center justify-center rounded-control align-middle text-subtle opacity-0 transition-opacity duration-120 hover:bg-hover hover:text-fg focus-visible:opacity-100 group-hover:opacity-100"
              aria-label="Link to this section"
            >
              <Link2 className="size-4 stroke-[1.5]" aria-hidden />
            </a>
          ) : null}
        </Tag>
      );
    }
    case "bulletList":
      return <ul className="my-4 list-disc space-y-1.5 pl-6 marker:text-subtle">{kids}</ul>;
    case "orderedList":
      return (
        <ol start={Number(node.attrs?.start ?? 1)} className="my-4 list-decimal space-y-1.5 pl-6 marker:text-muted marker:tabular-nums">
          {kids}
        </ol>
      );
    case "listItem":
      return <li className="pl-1 [&>p]:my-0 [&>ul]:my-1.5 [&>ol]:my-1.5">{kids}</li>;
    case "taskList":
      return <ul className="my-4 space-y-2">{kids}</ul>;
    case "taskItem": {
      const checked = !!node.attrs?.checked;
      return (
        <li className="flex items-start gap-3">
          <span
            role="img"
            aria-label={checked ? "Done" : "To do"}
            className={cn(
              "mt-[3px] inline-flex size-[18px] shrink-0 items-center justify-center rounded-[4px] border",
              checked ? "border-accent bg-accent text-accent-fg" : "border-control-border bg-raised",
            )}
          >
            {checked ? <Check className="size-3 stroke-[2.5]" aria-hidden /> : null}
          </span>
          <div className={cn("min-w-0 flex-1 [&>p]:my-0", checked && "text-muted line-through decoration-subtle")}>{kids}</div>
        </li>
      );
    }
    case "blockquote":
      return <blockquote className="my-5 border-l-2 border-border-strong pl-4 text-muted [&>p]:my-2">{kids}</blockquote>;
    case "callout": {
      const tone = (node.attrs?.tone as keyof typeof CALLOUT) in CALLOUT ? (node.attrs?.tone as keyof typeof CALLOUT) : "info";
      const c = CALLOUT[tone];
      const Icon = c.icon;
      return (
        <aside className={cn("my-5 flex gap-3 rounded-card px-4 py-3 text-body", c.box)} role="note" aria-label={c.label}>
          <Icon className={cn("mt-0.5 size-4 shrink-0 stroke-[1.75]", c.iconClass)} aria-hidden />
          <div className="min-w-0 flex-1 text-fg [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&>p]:my-2">{kids}</div>
        </aside>
      );
    }
    case "codeBlock":
      return (
        <pre className="my-5 overflow-x-auto rounded-cell bg-sunken px-4 py-3 font-mono text-small leading-relaxed text-fg shadow-inset">
          <code>{(node.content ?? []).map((c) => c.text ?? "").join("")}</code>
        </pre>
      );
    case "horizontalRule":
      return <hr className="my-8 border-border" />;
    case "hardBreak":
      return <br />;
    case "table":
      return (
        <div className="cell my-5 overflow-x-auto rounded-cell">
          <table className="w-full border-collapse text-left text-body">
            <tbody>{kids}</tbody>
          </table>
        </div>
      );
    case "tableRow":
      return <tr className="border-b border-border last:border-b-0">{kids}</tr>;
    case "tableHeader":
      return (
        <th scope="col" className="bg-sunken/60 px-3 py-2 align-top text-small font-medium text-muted dark:bg-sunken/60 [&>p]:my-0">
          {kids}
        </th>
      );
    case "tableCell":
      return <td className="px-3 py-2 align-top tabular-nums [&>p]:my-0">{kids}</td>;
    case "text":
      return inlineNodes([node]);
    default:
      return kids.length ? <div>{kids}</div> : null;
  }
}

function inlineNodes(nodes: DocNode[]): React.ReactNode[] {
  return nodes.map((n, i) => {
    if (n.type === "hardBreak") return <br key={i} />;
    if (n.type !== "text") return <React.Fragment key={i}>{inlineNodes(n.content ?? [])}</React.Fragment>;
    return <React.Fragment key={i}>{applyMarks(n.text ?? "", n.marks ?? [])}</React.Fragment>;
  });
}

function applyMarks(text: string, marks: DocMark[]): React.ReactNode {
  let out: React.ReactNode = text;
  // Link outermost so its styling wraps the formatted text.
  const ordered = [...marks].sort((a, b) => Number(a.type === "link") - Number(b.type === "link"));
  for (const m of ordered) {
    switch (m.type) {
      case "bold":
        out = <strong className="font-semibold">{out}</strong>;
        break;
      case "italic":
        out = <em>{out}</em>;
        break;
      case "strike":
        out = <s>{out}</s>;
        break;
      case "underline":
        out = <u className="underline-offset-2">{out}</u>;
        break;
      case "code":
        out = <code className="rounded-[4px] bg-sunken px-1 py-0.5 font-mono text-[0.875em]">{out}</code>;
        break;
      case "link": {
        const href = safeHref(m.attrs?.href);
        if (!href) break;
        const cls = "focus-ring rounded-[2px] text-accent-text underline decoration-accent-text/40 underline-offset-[3px] transition-colors hover:decoration-accent-text";
        out = href.startsWith("/") ? (
          <Link href={href} className={cls}>
            {out}
          </Link>
        ) : (
          <a href={href} className={cls} target={href.startsWith("#") ? undefined : "_blank"} rel="noopener noreferrer">
            {out}
          </a>
        );
        break;
      }
    }
  }
  return out;
}
