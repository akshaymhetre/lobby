import * as React from "react";
import { cn } from "@/lib/cn";

/**
 * One group of settings, the admin console's composition (wave 3): the group's name and a line on
 * what it decides sit on the left, the controls sit on the right in ONE raised cell. On phones the
 * two stack. A page is a column of these instead of a long run of loose fields, so each decision
 * reads as a unit and the left column becomes a table of contents you can scan.
 *
 *   <SettingsGroup title="Brand colour" description="Buttons, links and the active tab.">…fields…</SettingsGroup>
 *
 * `stacked` keeps the title above the cell at every width (the setup wizard's narrow column).
 * `state` is an optional node under the description (a CategoryBlock, a Badge) for the group's
 * current state. `flush` drops the cell's padding for content that brings its own rows.
 */
export function SettingsGroup({
  title,
  description,
  state,
  children,
  id,
  flush = false,
  stacked = false,
  className,
  cellClassName,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  state?: React.ReactNode;
  children: React.ReactNode;
  id?: string;
  flush?: boolean;
  /** Title above the cell at every width (a narrow column, such as the setup wizard). */
  stacked?: boolean;
  className?: string;
  cellClassName?: string;
}) {
  const headingId = React.useId();
  return (
    <section
      id={id}
      aria-labelledby={headingId}
      className={cn("grid scroll-mt-24 gap-4", !stacked && "lg:grid-cols-[minmax(0,240px)_minmax(0,1fr)] lg:gap-10", className)}
    >
      <div className={cn("flex min-w-0 flex-col gap-1.5", !stacked && "lg:pt-4")}>
        <h2 id={headingId} className="text-h3 font-medium text-fg">
          {title}
        </h2>
        {description ? <p className="max-w-md text-body text-muted text-pretty">{description}</p> : null}
        {state ? <div className="mt-2 flex">{state}</div> : null}
      </div>
      <div className={cn("cell min-w-0 rounded-panel", flush ? "overflow-hidden" : "flex flex-col gap-5 p-5 sm:p-6", cellClassName)}>{children}</div>
    </section>
  );
}
