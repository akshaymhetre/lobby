import * as React from "react";
import { Masthead, type MastheadSize } from "./masthead";

/**
 * Page header in the masthead style, without the dateline by default.
 * Use it on detail pages (a ticket, a person, a run). Top-level pages pass `dateline`,
 * or give <Page> a `title` and get the full masthead for free.
 *
 * Existing props are unchanged; `dateline`, `today`, `size` and `inlineActions` are new.
 */
export interface PageHeaderProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Right-aligned actions; wraps under the title on narrow screens. */
  actions?: React.ReactNode;
  /** Breadcrumb or eyebrow shown above the title. */
  breadcrumb?: React.ReactNode;
  /** Use the editorial serif (Home, News and Knowledge titles only, per the kernel). */
  serif?: boolean;
  /** Show the dateline (date + company name + rule). Top-level pages only. */
  dateline?: boolean;
  /** The "Today" line: plain text with <MastheadLink> for the parts that are for the reader. */
  today?: React.ReactNode;
  /** h1 (default) or h2 for compact detail pages; display is reserved for Home. */
  size?: MastheadSize;
  /** Keep actions beside the title at every width; pair with icon-only buttons below `sm`. */
  inlineActions?: boolean;
  className?: string;
  children?: React.ReactNode;
}

export function PageHeader({ dateline = false, size = "h1", ...props }: PageHeaderProps) {
  return <Masthead dateline={dateline} size={size} {...props} />;
}

/** Simple breadcrumb for the header slot. Pass the current page last. */
export function Breadcrumb({ items }: { items: { label: React.ReactNode; href?: string }[] }) {
  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex flex-wrap items-center gap-1.5">
        {items.map((item, i) => {
          const last = i === items.length - 1;
          return (
            <li key={i} className="inline-flex items-center gap-1.5">
              {item.href && !last ? (
                <a href={item.href} className="focus-ring rounded-[4px] text-muted transition-colors hover:text-fg">
                  {item.label}
                </a>
              ) : (
                <span aria-current={last ? "page" : undefined} className={last ? "text-fg" : "text-muted"}>
                  {item.label}
                </span>
              )}
              {!last ? (
                <span className="text-subtle" aria-hidden>
                  /
                </span>
              ) : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
