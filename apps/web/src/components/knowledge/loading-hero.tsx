import { Page } from "@/components/page";
import { Skeleton, SkeletonRow } from "@/components/ui/skeleton";

/**
 * The loading state shared by Knowledge, search and content health: the page heading, then the
 * hero panel's outline with its rows already in place, so the screen keeps its shape while the
 * data arrives and nothing jumps when it lands.
 */
export function KnowledgeLoading({ label, rows = 6 }: { label: string; rows?: number }) {
  return (
    <Page width="wide">
      <div role="status" aria-live="polite" className="pt-3">
      <span className="sr-only">{label}</span>
      <Skeleton className="h-3 w-40" />
      <Skeleton className="mt-4 h-9 w-56" />
      <Skeleton className="mt-3 h-4 w-80 max-w-full" />
      <div className="panel mt-8 flex flex-col gap-4 rounded-panel p-5 md:p-6">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-72 max-w-full" />
        <div className="mt-2 flex flex-col gap-2">
          {Array.from({ length: rows }, (_, i) => (
            <div key={i} className="grid grid-cols-[140px_minmax(0,1fr)] items-center gap-4">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-9 rounded-cell" style={{ width: `${55 + ((i * 17) % 40)}%` }} />
            </div>
          ))}
        </div>
      </div>
      <div className="mt-10 flex flex-col">
        {Array.from({ length: 3 }, (_, i) => (
          <SkeletonRow key={i} />
        ))}
      </div>
      </div>
    </Page>
  );
}
