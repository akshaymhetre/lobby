"use client";

import * as React from "react";
import { Slot } from "radix-ui";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";

export { buttonVariants, type ButtonVariant, type ButtonSize } from "./button-variants";
import { buttonVariants, type ButtonVariant, type ButtonSize } from "./button-variants";

export interface ButtonProps extends React.ComponentProps<"button"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Shows a spinner, keeps the width, and blocks clicks. */
  loading?: boolean;
  /** Render the child element (e.g. a Next <Link>) with button styles. */
  asChild?: boolean;
}

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  asChild = false,
  disabled,
  className,
  children,
  type,
  ...props
}: ButtonProps) {
  const classes = buttonVariants({ variant, size, className });

  if (asChild) {
    return (
      <Slot.Root data-press className={classes} aria-disabled={disabled || loading || undefined} {...props}>
        {children}
      </Slot.Root>
    );
  }

  return (
    <button
      data-press
      type={type ?? "button"}
      className={cn(classes, loading && "relative")}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? (
        <>
          <span className="invisible inline-flex items-center gap-2">{children}</span>
          <span className="absolute inset-0 inline-flex items-center justify-center">
            <Loader2 className="animate-spin-slow" aria-hidden />
            <span className="sr-only">Loading</span>
          </span>
        </>
      ) : (
        children
      )}
    </button>
  );
}
