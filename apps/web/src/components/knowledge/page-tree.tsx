import Link from "next/link";
import { FileText, Plus } from "lucide-react";
import type { PageSummary } from "@lobby/core/knowledge";
import { cn } from "@/lib/cn";
import { SpaceIcon } from "./space-icon";

export interface TreeNode {
  page: PageSummary;
  children: TreeNode[];
}

/** Nests pages by parentId. Pages whose parent is not visible to the reader sit at the root. */
export function buildTree(pages: PageSummary[]): TreeNode[] {
  const byId = new Map(pages.map((p) => [p.id, { page: p, children: [] as TreeNode[] }]));
  const roots: TreeNode[] = [];
  for (const node of byId.values()) {
    const parent = node.page.parentId ? byId.get(node.page.parentId) : undefined;
    if (parent && parent !== node) parent.children.push(node);
    else roots.push(node);
  }
  const sort = (nodes: TreeNode[]) => {
    nodes.sort((a, b) => a.page.title.localeCompare(b.page.title));
    nodes.forEach((n) => sort(n.children));
  };
  sort(roots);
  return roots;
}

/**
 * The left panel on space and page views: the space, then its pages as a tree. In v2 it is a
 * panel inset on the slab, and the page being read is a raised white cell, like the active pill
 * in the top bar.
 */
export function PageTree({
  space,
  pages,
  currentId,
  canEdit,
}: {
  space: { slug: string; name: string; icon: string | null };
  pages: PageSummary[];
  currentId?: string;
  canEdit: boolean;
}) {
  const tree = buildTree(pages);
  return (
    <nav aria-label={`${space.name} pages`} className="panel flex flex-col gap-2 rounded-panel p-3">
      <Link
        href={`/knowledge/${space.slug}`}
        aria-current={currentId ? undefined : "page"}
        className={cn(
          "focus-ring flex min-h-9 items-center gap-2.5 rounded-cell px-2.5 py-1.5 text-body font-medium text-fg transition-colors duration-120",
          currentId ? "hover:bg-hover" : "cell",
        )}
      >
        <SpaceIcon name={space.icon} size="sm" className="text-muted" />
        <span className="truncate">{space.name}</span>
      </Link>
      {tree.length ? (
        <TreeList nodes={tree} currentId={currentId} depth={0} />
      ) : (
        <p className="px-2.5 text-small text-muted">No pages yet.</p>
      )}
      {canEdit ? (
        <Link
          href={`/knowledge/new?space=${space.slug}`}
          className="focus-ring mt-1 flex h-9 items-center gap-2 rounded-cell px-2.5 text-small text-muted transition-colors duration-120 hover:bg-hover hover:text-fg"
        >
          <Plus className="size-3.5 stroke-[1.75]" aria-hidden />
          Add a page
        </Link>
      ) : null}
    </nav>
  );
}

function TreeList({ nodes, currentId, depth }: { nodes: TreeNode[]; currentId?: string; depth: number }) {
  return (
    <ul className={cn("flex flex-col gap-0.5", depth > 0 && "ml-[17px] border-l border-border pl-1.5")}>
      {nodes.map((n) => {
        const active = n.page.id === currentId;
        return (
          <li key={n.page.id}>
            <Link
              href={`/knowledge/${n.page.spaceSlug}/${n.page.slug}`}
              aria-current={active ? "page" : undefined}
              className={cn(
                "focus-ring flex min-h-9 items-center gap-2 rounded-cell px-2.5 py-1.5 text-small transition-[background-color,color,box-shadow] duration-120",
                active ? "cell font-medium text-fg" : "text-muted hover:bg-hover hover:text-fg",
              )}
            >
              <FileText className={cn("size-3.5 shrink-0 stroke-[1.5]", active ? "text-accent-text" : "text-subtle")} aria-hidden />
              <span className="line-clamp-2 min-w-0 flex-1">{n.page.title}</span>
              {n.page.status !== "published" ? (
                <span className="shrink-0 text-caption text-subtle">{n.page.status === "draft" ? "Draft" : "Archived"}</span>
              ) : n.page.freshness === "stale" ? (
                <span className="shrink-0 text-caption font-medium text-cat-coral-text">Stale</span>
              ) : n.page.freshness === "due-soon" ? (
                <span className="size-1.5 shrink-0 rounded-full bg-cat-amber" aria-label="Review due soon" role="img" />
              ) : null}
            </Link>
            {n.children.length ? <TreeList nodes={n.children} currentId={currentId} depth={depth + 1} /> : null}
          </li>
        );
      })}
    </ul>
  );
}
