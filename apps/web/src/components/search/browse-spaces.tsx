import Link from "next/link";
import { listSpacePages, listSpaces } from "@lobby/core/knowledge";
import type { UserContext } from "@lobby/core";
import { FRESH, FRESH_ORDER } from "@/components/knowledge/freshness-tone";
import { SpaceIcon } from "@/components/knowledge/space-icon";
import { cn } from "@/lib/cn";

/**
 * Before a query (and after one that found nothing): the knowledge spaces the reader can open,
 * as cells with their page count and a freshness bar, so the search page is a way in even when
 * the reader does not know the word to type. Lists only what the reader's groups may see.
 */
export async function BrowseSpaces({ ctx, title = "Browse by space" }: { ctx: UserContext; title?: string }) {
  const spaces = await listSpaces(ctx);
  if (!spaces.length) return null;
  const pages = await Promise.all(spaces.map((sp) => listSpacePages(ctx, sp)));
  return (
    <section aria-labelledby="browse-spaces" className="flex flex-col gap-4">
      <h2 id="browse-spaces" className="text-h2 font-medium text-fg">
        {title}
      </h2>
      <ul className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {spaces.map((sp, i) => {
          const published = pages[i]!.filter((p) => p.status === "published");
          const n = (k: (typeof FRESH_ORDER)[number]) => published.filter((p) => p.freshness === k).length;
          return (
            <li key={sp.id}>
              <Link
                href={`/knowledge/${sp.slug}`}
                className="focus-ring press cell group flex min-h-[72px] items-center gap-3.5 rounded-card px-4 py-3 hover:shadow-cell-hover"
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-sunken shadow-inset">
                  <SpaceIcon name={sp.icon} size="md" className="text-fg" />
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-row font-medium text-fg">{sp.name}</span>
                    <span className="tabular shrink-0 text-caption text-muted">{published.length === 1 ? "1 page" : `${published.length} pages`}</span>
                  </span>
                  <span className="flex h-1.5 gap-px overflow-hidden rounded-full bg-sunken" aria-hidden>
                    {FRESH_ORDER.filter((k) => n(k) > 0).map((k) => (
                      <span key={k} className={cn("h-full", k === "unset" ? "bg-border-strong" : FRESH[k].fill)} style={{ flexGrow: n(k) }} />
                    ))}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
