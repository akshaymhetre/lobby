"use client";

import * as React from "react";
import Link from "next/link";
import { History } from "lucide-react";
import { CellList, RowCell } from "@/components/ui/cells";
import { Section } from "@/components/ui/section";
import { ResultIcon } from "./result-icon";
import { RESULT_GROUPS } from "./types";
import { readRecent, readVisited, type Visited } from "./visited";

/**
 * The search page before a query: what this browser opened and searched for recently, the same
 * lists the Cmd-K palette shows. Renders nothing until mounted (the server cannot read
 * localStorage) and nothing at all when there is no history, so a first visit stays clean.
 */
export function RecentlyViewed() {
  const [visited, setVisited] = React.useState<Visited[]>([]);
  const [recent, setRecent] = React.useState<string[]>([]);
  React.useEffect(() => {
    setVisited(readVisited());
    setRecent(readRecent());
  }, []);
  if (!visited.length && !recent.length) return null;
  return (
    <>
      {visited.length ? (
        <Section title="Recently viewed">
          <CellList density="compact" layout="grid" min="320px">
            {visited.map((v) => (
              <RowCell
                key={v.href}
                href={v.href}
                leading={
                  <span className="flex size-9 items-center justify-center rounded-[12px] bg-sunken text-muted shadow-inset">
                    <ResultIcon type={v.type} className="size-4 stroke-[1.75]" />
                  </span>
                }
                title={v.title}
                meta={RESULT_GROUPS.find((g) => g.type === v.type)?.singular}
              />
            ))}
          </CellList>
        </Section>
      ) : null}
      {recent.length ? (
        <Section title="Recent searches">
          <ul className="flex flex-wrap gap-2">
            {recent.map((r) => (
              <li key={r}>
                <Link
                  href={`/search?q=${encodeURIComponent(r)}`}
                  className="focus-ring cell press inline-flex h-11 items-center gap-2 rounded-full px-4 text-body font-medium text-fg hover:shadow-cell-hover"
                >
                  <History className="size-4 stroke-[1.5] text-subtle" aria-hidden />
                  {r}
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}
    </>
  );
}
