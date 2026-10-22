import { Search } from "lucide-react";
import { Kbd } from "@/components/ui/kbd";
import { controlBase } from "@/components/ui/input";
import { cn } from "@/lib/cn";

/** Search box scoped to knowledge pages. A plain GET form, so it works before JavaScript loads. */
export function KnowledgeSearch({ className, defaultValue, placeholder = "Search the knowledge base" }: { className?: string; defaultValue?: string; placeholder?: string }) {
  return (
    <form action="/search" method="get" role="search" className={cn("relative", className)}>
      <input type="hidden" name="type" value="page" />
      <label htmlFor="knowledge-search" className="sr-only">
        Search knowledge
      </label>
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 stroke-[1.5] text-subtle" aria-hidden />
      <input
        id="knowledge-search"
        name="q"
        type="search"
        defaultValue={defaultValue}
        placeholder={placeholder}
        autoComplete="off"
        className={cn(controlBase, "h-11 pl-9 pr-16 text-body-lg md:h-10 md:text-body")}
      />
      <span className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 sm:inline-flex">
        <Kbd>Enter</Kbd>
      </span>
    </form>
  );
}
