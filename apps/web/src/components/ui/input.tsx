import * as React from "react";
import { cn } from "@/lib/cn";

/*
 * A field is a well: one tone below the surface with a soft inset shadow instead of a border.
 * Focus draws the 2px accent ring. Shared by Input, Textarea, Select and DateField.
 */
export const controlBase =
  "w-full min-w-0 rounded-control bg-raised text-body text-fg shadow-inset " +
  "transition-[box-shadow,background-color] duration-160 ease-standard " +
  "hover:shadow-[inset_0_1px_2px_rgb(20_30_50/0.1),inset_0_0_0_1px_rgb(20_30_50/0.12)] " +
  "focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-accent-ring " +
  "disabled:bg-sunken disabled:opacity-60 " +
  "aria-invalid:shadow-[inset_0_0_0_1.5px_var(--lb-danger)] aria-invalid:focus-visible:outline-danger " +
  "dark:bg-sunken dark:hover:shadow-[inset_0_1px_2px_rgb(0_0_0/0.5),inset_0_0_0_1px_rgb(160_225_235/0.16)]";

export interface InputProps extends React.ComponentProps<"input"> {
  /** Optional leading icon (rendered at 16px inside the field). */
  leading?: React.ReactNode;
  /** Optional trailing element, e.g. a unit or a Kbd hint. */
  trailing?: React.ReactNode;
}

export function Input({ className, leading, trailing, type = "text", ...props }: InputProps) {
  const field = (
    <input
      type={type}
      className={cn(
        controlBase,
        "h-10 px-3.5 md:h-9",
        "file:mr-3 file:border-0 file:bg-transparent file:text-small file:font-medium file:text-fg",
        leading ? "pl-9" : null,
        trailing ? "pr-10" : null,
        !leading && !trailing && className,
      )}
      {...props}
    />
  );
  if (!leading && !trailing) return field;
  return (
    <div className={cn("relative flex w-full items-center", className)}>
      {leading ? (
        <span className="pointer-events-none absolute left-3 inline-flex text-subtle [&_svg]:size-4 [&_svg]:stroke-[1.75]">
          {leading}
        </span>
      ) : null}
      {field}
      {trailing ? (
        <span className="absolute right-2.5 inline-flex items-center text-subtle [&_svg]:size-4">{trailing}</span>
      ) : null}
    </div>
  );
}
