import { cn } from "@/lib/cn";
import { Masthead, type MastheadSize } from "@/components/ui/masthead";

/**
 * The content container inside the shell, and the only place a page's max width is set.
 *
 *   width="wide"   1200px  most pages (lists, feeds, settings with a rail)
 *   width="prose"   760px  reading and single-column forms
 *   width="full"    none   tables, boards, trees, anything with its own sidebar
 *
 * The widths are the `--container-page-*` tokens in globals.css. Never add `max-w-[NNNpx]` to a page.
 *
 * Give it a `title` and it renders the Masthead (dateline + title + optional "Today" line + actions)
 * above the children, so a top-level page gets the signature move with one prop.
 */
export type PageWidth = "full" | "wide" | "prose";

export interface PageProps {
  children: React.ReactNode;
  width?: PageWidth;
  className?: string;

  /** Renders a Masthead above the content. Top-level pages: pass the page name. */
  title?: React.ReactNode;
  /** Quiet description under the title. */
  description?: React.ReactNode;
  /** The "Today" line: plain text plus <MastheadLink> for what is for the reader. */
  today?: React.ReactNode;
  /** Right-aligned header actions. */
  actions?: React.ReactNode;
  /** Breadcrumb or eyebrow above the title. */
  breadcrumb?: React.ReactNode;
  /** Newsreader title: Home, News and Knowledge only. */
  serif?: boolean;
  /** "display" on Home, "h1" (default) everywhere else. */
  titleSize?: MastheadSize;
  /** The date + company line. Defaults on when `title` is set; detail pages pass false. */
  dateline?: boolean;
  /** Keep actions beside the title at every width (icon-only buttons below `sm`). */
  inlineActions?: boolean;
}

export function Page({
  children,
  width = "wide",
  className,
  title,
  description,
  today,
  actions,
  breadcrumb,
  serif,
  titleSize = "h1",
  dateline = true,
  inlineActions,
}: PageProps) {
  return (
    <div
      className={cn(
        "mx-auto w-full px-4 pb-10 pt-3 sm:px-6 md:pb-12 md:pt-4 lg:px-8",
        width === "wide" && "max-w-(--container-page-wide)",
        width === "prose" && "max-w-(--container-page-prose)",
        className,
      )}
    >
      {title !== undefined ? (
        <Masthead
          title={title}
          description={description}
          today={today}
          actions={actions}
          breadcrumb={breadcrumb}
          serif={serif}
          size={titleSize}
          dateline={dateline}
          inlineActions={inlineActions}
        />
      ) : null}
      {children}
    </div>
  );
}
