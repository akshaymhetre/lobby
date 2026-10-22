"use client";

import * as React from "react";
import { Dialog as SheetPrimitive } from "radix-ui";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";

export const Sheet = SheetPrimitive.Root;
export const SheetTrigger = SheetPrimitive.Trigger;
export const SheetClose = SheetPrimitive.Close;

const sides = {
  right:
    "inset-y-0 right-0 h-dvh w-full max-w-[400px] data-[state=open]:animate-sheet-in-right data-[state=closed]:animate-sheet-out-right sm:rounded-l-dialog",
  left: "inset-y-0 left-0 h-dvh w-full max-w-[320px] data-[state=open]:animate-sheet-in-left data-[state=closed]:animate-sheet-out-left sm:rounded-r-dialog",
  bottom:
    "inset-x-0 bottom-0 max-h-[85dvh] rounded-t-dialog data-[state=open]:animate-sheet-in-bottom data-[state=closed]:animate-sheet-out-bottom",
} as const;

export function SheetContent({
  side = "right",
  className,
  children,
  hideClose = false,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Content> & { side?: keyof typeof sides; hideClose?: boolean }) {
  return (
    <SheetPrimitive.Portal>
      <SheetPrimitive.Overlay className="fixed inset-0 z-50 bg-overlay data-[state=open]:animate-fade-in data-[state=closed]:animate-fade-out" />
      <SheetPrimitive.Content
        className={cn(
          "fixed z-50 flex flex-col bg-surface text-fg shadow-dialog outline-none dark:glass dark:bg-glass-strong",
          sides[side],
          className,
        )}
        {...props}
      >
        {side === "bottom" ? (
          <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-border-strong" aria-hidden />
        ) : null}
        {children}
        {hideClose ? null : (
          <SheetPrimitive.Close
            className="focus-ring touch-target absolute right-3 top-3 inline-flex size-8 items-center justify-center rounded-full text-muted transition-colors duration-120 hover:bg-hover hover:text-fg"
            aria-label="Close"
          >
            <X className="size-4 stroke-[1.5]" aria-hidden />
          </SheetPrimitive.Close>
        )}
      </SheetPrimitive.Content>
    </SheetPrimitive.Portal>
  );
}

export function SheetHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("flex flex-col gap-1 border-b border-border px-5 py-4 pr-12", className)} {...props} />;
}

export function SheetBody({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("min-h-0 flex-1 overflow-y-auto px-5 py-4", className)} {...props} />;
}

export function SheetFooter({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("flex justify-end gap-2 border-t border-border px-5 py-3", className)} {...props} />;
}

export function SheetTitle({ className, ...props }: React.ComponentProps<typeof SheetPrimitive.Title>) {
  return <SheetPrimitive.Title className={cn("text-h4 font-medium text-fg", className)} {...props} />;
}

export function SheetDescription({ className, ...props }: React.ComponentProps<typeof SheetPrimitive.Description>) {
  return <SheetPrimitive.Description className={cn("text-small text-muted", className)} {...props} />;
}
