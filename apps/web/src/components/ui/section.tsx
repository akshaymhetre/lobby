import * as React from "react";
import { cn } from "@/lib/cn";
import { CollapsibleSectionBody, CollapsibleSectionToggle } from "./section-collapse";

/**
 * One section of a page: a heading block, then content, at the kit's rhythm.
 * Stack sections in a `section-stack` (40px apart). Inside, the heading sits 24px above the
 * content (`section-group`) and siblings in the content sit 16px apart (`section-content`).
 *
 *   <div className="section-stack">
 *     <Section title="Spaces" count={6} action={<Button variant="ghost" size="sm">New space</Button>}>
 *       <CellList>...cells...</CellList>
 *     </Section>
 *     <Section id="recent" title="Recently updated" collapsible summary="4 pages this week">...</Section>
 *   </div>
 *
 * Wave 3:
 * - `tone="page"` headings are 24px (one clear jump below the 44px page title and the 32px hero title).
 * - `tone="quiet"` is a sentence-case 13px label for rails and grouped rows. No tracked capitals:
 *   a screen may carry at most ONE eyebrow, and it is not this.
 * - `collapsible` folds the section on phones (below md) behind its heading, which becomes a
 *   button with a chevron and an optional `summary` ("12 people, 3 new"). From md up it is
 *   always open and the toggle is not rendered. Pair with <SectionSwitcher> for long phone pages.
 * - Every section carries `scroll-mt-24`, so an in-page link or the switcher lands it below the
 *   sticky switcher.
 */
export interface SectionProps extends Omit<React.ComponentProps<"section">, "title"> {
  title?: React.ReactNode;
  /** One line under the title, muted. */
  description?: React.ReactNode;
  /** Shown after the title as a count chip, e.g. a row count. */
  count?: number;
  /** Right-aligned: a ghost button, a "View all" link, a filter. */
  action?: React.ReactNode;
  /** "page" (24px heading, default) or "quiet" (13px sentence-case label, for rails and grouped rows). */
  tone?: "page" | "quiet";
  /** Heading level. Pages use h2 (default); nested groups use h3. */
  as?: "h2" | "h3";
  /** Puts the content in `section-content` (16px between siblings). Off when the child is a single list. */
  spaced?: boolean;
  /** Fold on phones behind the heading. Needs an `id` (used for aria-controls and the switcher). */
  collapsible?: boolean;
  /** Phones only: start open. Default false (folded) when `collapsible`. */
  defaultOpen?: boolean;
  /** Phones only: what the folded section holds, shown under the heading while folded. */
  summary?: React.ReactNode;
}

export function Section({
  title,
  description,
  count,
  action,
  tone = "page",
  as = "h2",
  spaced = false,
  collapsible = false,
  defaultOpen = false,
  summary,
  className,
  children,
  id,
  ...props
}: SectionProps) {
  const autoId = React.useId();
  const baseId = id ?? autoId.replace(/:/g, "");
  const headingId = title ? `${baseId}-heading` : undefined;
  const bodyId = `${baseId}-body`;
  const body = <div className={cn("min-w-0", spaced && "section-content")}>{children}</div>;
  return (
    <section
      id={id}
      aria-labelledby={headingId}
      className={cn("scroll-mt-24", tone === "page" ? "section-group" : "flex flex-col gap-3", collapsible && "max-md:gap-0", className)}
      {...props}
    >
      {title ? (
        <SectionHeading
          id={headingId}
          as={as}
          tone={tone}
          count={count}
          action={action}
          description={description}
          toggle={collapsible ? <CollapsibleSectionToggle sectionId={baseId} bodyId={bodyId} defaultOpen={defaultOpen} summary={summary} label={title} /> : undefined}
        >
          {title}
        </SectionHeading>
      ) : null}
      {collapsible ? (
        <CollapsibleSectionBody sectionId={baseId} bodyId={bodyId} defaultOpen={defaultOpen}>
          {body}
        </CollapsibleSectionBody>
      ) : (
        body
      )}
    </section>
  );
}

export interface SectionHeadingProps {
  id?: string;
  as?: "h2" | "h3";
  tone?: "page" | "quiet";
  count?: number;
  action?: React.ReactNode;
  description?: React.ReactNode;
  /** The phone-only fold toggle (rendered by Section when `collapsible`). */
  toggle?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}

export function SectionHeading({ id, as = "h2", tone = "page", count, action, description, toggle, className, children }: SectionHeadingProps) {
  const Heading = as;
  return (
    <div className={cn("flex items-end justify-between gap-4", toggle && "relative max-md:min-h-11 max-md:items-center max-md:pr-12", className)}>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <Heading
          id={id}
          className={cn(
            "flex items-center gap-2.5 text-fg",
            tone === "page" ? "text-h3 font-medium md:text-h2" : "text-small font-medium text-muted",
          )}
        >
          <span className="truncate">{children}</span>
          {typeof count === "number" ? <SectionCount n={count} quiet={tone === "quiet"} /> : null}
        </Heading>
        {description ? <p className={cn("text-body text-muted", toggle && "max-md:hidden")}>{description}</p> : null}
        {toggle}
      </div>
      {action ? <div className={cn("flex shrink-0 items-center gap-2", toggle && "max-md:hidden")}>{action}</div> : null}
    </div>
  );
}

/** The count after a section title: a small raised chip, not grey text. */
function SectionCount({ n, quiet }: { n: number; quiet: boolean }) {
  return (
    <span
      className={cn(
        "tabular inline-flex shrink-0 items-center justify-center rounded-full bg-raised font-medium text-muted shadow-cell",
        quiet ? "h-5 min-w-5 px-1.5 text-caption" : "h-6 min-w-6 px-2 text-small",
      )}
    >
      {n}
    </span>
  );
}
