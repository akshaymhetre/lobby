"use client";

import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { formatDateline, useOrg } from "./org-context";

/**
 * The page header. In v2 it is a quiet, large sans title with a small dateline above it:
 *
 *   Thursday 15 October · Northwind Labs                                <- caption, muted
 *   Good evening, Maya                                     [actions]    <- title: display on Home, h1 elsewhere
 *   3 things to do, 2 approvals waiting, Berlin opens in 18 days.       <- "Today": body-lg, plain text + accent links
 *
 * The v1 newspaper masthead (serif, printed rule) is retired. Every prop still works: `serif`
 * is accepted and ignored, `dateline` renders the caption line without a rule. The `h1` element
 * is always rendered, whatever `size` is, so `getByRole("heading", { level: 1 })` keeps working.
 *
 * The "Today" line is the only place in the product that mixes `text-fg` with `text-accent-text`
 * links, so an accent link always means "something for you".
 */
export type MastheadSize = "display" | "h1" | "h2";

export interface MastheadProps {
  title: React.ReactNode;
  /** display: the Home greeting. h1: every other top-level page. h2: compact detail pages. */
  size?: MastheadSize;
  /** Accepted for compatibility; v2 has one typeface and ignores it. */
  serif?: boolean;
  /** The date line plus company name above the title. On for top-level pages, off for detail pages. */
  dateline?: boolean;
  /** Override the dateline text; defaults to the org context's date in the viewer's timezone. */
  date?: string;
  /** Override the company name; defaults to the org context. */
  company?: string;
  /** The "Today" line: plain text with <MastheadLink> for the parts that are for the reader. */
  today?: React.ReactNode;
  /** Quiet one-line description under the title (muted). Prefer `today` on top-level pages. */
  description?: React.ReactNode;
  /** Breadcrumb or eyebrow shown above the title, below the dateline. */
  breadcrumb?: React.ReactNode;
  /** Right-aligned actions. Wrap under the title below `sm` unless `inlineActions`. */
  actions?: React.ReactNode;
  /** Keep actions beside the title at every width. Pair with icon-only buttons below `sm`. */
  inlineActions?: boolean;
  className?: string;
  /** Anything else that belongs in the header (tabs, a toolbar). Rendered last. */
  children?: React.ReactNode;
}

/* Wave 3 scale: page titles 44px (34 on phones), the Home greeting 52px, compact detail titles 30px. */
const titleClass: Record<MastheadSize, string> = {
  display: "text-title-sm font-medium md:text-display",
  h1: "text-title-sm font-medium md:text-title",
  h2: "text-h2 font-medium md:text-h1",
};

export function Masthead({
  title,
  size = "h1",
  dateline = true,
  date,
  company,
  today,
  description,
  breadcrumb,
  actions,
  inlineActions = false,
  className,
  children,
}: MastheadProps) {
  const org = useOrg();
  const companyName = company ?? org?.companyName ?? null;
  const dateText = date ?? org?.dateline ?? null;

  return (
    <header className={cn("flex flex-col pb-7 md:pb-10", className)} data-masthead>
      {dateline ? (
        <p className="mb-3 flex min-h-[18px] items-baseline gap-2 text-caption font-medium text-subtle">
          {dateText ? <span className="capitalize">{dateText.toLowerCase()}</span> : <ClientDateline />}
          {companyName ? (
            <>
              <span aria-hidden className="text-border-strong">
                ·
              </span>
              <span className="truncate">{companyName}</span>
            </>
          ) : null}
        </p>
      ) : null}

      {breadcrumb ? <div className="mb-2 text-small text-muted">{breadcrumb}</div> : null}

      <div
        className={cn(
          "flex gap-x-6 gap-y-4",
          inlineActions ? "flex-row items-start justify-between" : "flex-col sm:flex-row sm:items-start sm:justify-between",
        )}
      >
        <div className={cn("flex min-w-0 flex-1 flex-col", size === "h2" ? "gap-1.5" : "gap-3")}>
          <h1 className={cn("text-balance text-fg", titleClass[size])}>{title}</h1>
          {today ? <p className="max-w-[720px] text-body-lg text-fg text-pretty">{today}</p> : null}
          {description ? <p className="max-w-[640px] text-body text-muted text-pretty">{description}</p> : null}
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
      </div>

      {children}
    </header>
  );
}

/**
 * Only used when no <OrgProvider> is mounted (outside the app shell). Renders the date on the client,
 * after mount, so the server HTML and the first client paint never disagree.
 */
function ClientDateline() {
  const [text, setText] = React.useState<string>("");
  React.useEffect(() => {
    setText(formatDateline(new Date(), Intl.DateTimeFormat().resolvedOptions().timeZone));
  }, []);
  return (
    <span className="capitalize" aria-hidden={!text}>
      {text.toLowerCase()}
    </span>
  );
}

/** A link inside the "Today" line: accent means "something for you". Keeps to one line, so keep the phrase to three words. */
export function MastheadLink({ className, children, ...props }: React.ComponentProps<typeof Link>) {
  return (
    <Link
      className={cn(
        "focus-ring whitespace-nowrap rounded-[3px] font-medium text-accent-text underline decoration-accent-text/35 underline-offset-[0.2em] transition-colors duration-120 hover:decoration-accent-text",
        className,
      )}
      {...props}
    >
      {children}
    </Link>
  );
}
