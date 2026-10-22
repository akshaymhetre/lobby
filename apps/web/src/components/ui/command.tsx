"use client";

import * as React from "react";
import { Command as CommandPrimitive } from "cmdk";
import { Dialog as DialogPrimitive, VisuallyHidden } from "radix-ui";
import { Search } from "lucide-react";
import { cn } from "@/lib/cn";

export function Command({ className, ...props }: React.ComponentProps<typeof CommandPrimitive>) {
  return (
    <CommandPrimitive
      className={cn("flex size-full flex-col overflow-hidden rounded-panel bg-surface text-fg", className)}
      {...props}
    />
  );
}

export function CommandInput({
  className,
  trailing,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Input> & { trailing?: React.ReactNode }) {
  return (
    <div className="flex h-12 items-center gap-2.5 border-b border-border px-4" cmdk-input-wrapper="">
      <Search className="size-4 shrink-0 stroke-[1.5] text-subtle" aria-hidden />
      <CommandPrimitive.Input
        className={cn(
          "h-full w-full min-w-0 bg-transparent text-body-lg text-fg outline-none placeholder:text-subtle md:text-body",
          className,
        )}
        {...props}
      />
      {trailing}
    </div>
  );
}

export function CommandList({ className, ...props }: React.ComponentProps<typeof CommandPrimitive.List>) {
  return (
    <CommandPrimitive.List
      className={cn("max-h-[min(400px,60dvh)] scroll-py-2 overflow-y-auto overflow-x-hidden p-2", className)}
      {...props}
    />
  );
}

export function CommandEmpty({ className, ...props }: React.ComponentProps<typeof CommandPrimitive.Empty>) {
  return <CommandPrimitive.Empty className={cn("py-10 text-center text-body text-muted", className)} {...props} />;
}

export function CommandGroup({ className, ...props }: React.ComponentProps<typeof CommandPrimitive.Group>) {
  return (
    <CommandPrimitive.Group
      className={cn(
        "[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:pb-1.5 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:text-caption [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted",
        className,
      )}
      {...props}
    />
  );
}

export function CommandItem({
  className,
  shortcut,
  children,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Item> & { shortcut?: React.ReactNode }) {
  return (
    <CommandPrimitive.Item
      className={cn(
        "relative flex h-10 cursor-pointer select-none items-center gap-2.5 rounded-control px-2 text-body text-fg outline-none md:h-9",
        "data-[selected=true]:bg-hover data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50",
        "[&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:stroke-[1.5] [&_svg]:text-muted",
        className,
      )}
      {...props}
    >
      {children}
      {shortcut ? <span className="ml-auto pl-3 text-caption text-subtle">{shortcut}</span> : null}
    </CommandPrimitive.Item>
  );
}

export function CommandSeparator({ className, ...props }: React.ComponentProps<typeof CommandPrimitive.Separator>) {
  return <CommandPrimitive.Separator className={cn("-mx-2 my-1 h-px bg-border", className)} {...props} />;
}

export function CommandDialog({
  open,
  onOpenChange,
  title = "Search",
  children,
  footer,
  ...props
}: React.ComponentProps<typeof CommandPrimitive> & {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  footer?: React.ReactNode;
}) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-overlay data-[state=open]:animate-fade-in data-[state=closed]:animate-fade-out" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className={cn(
            "fixed left-1/2 top-[12dvh] z-50 w-[calc(100vw-24px)] max-w-[640px] -translate-x-1/2 overflow-hidden",
            "rounded-dialog border border-border bg-raised shadow-dialog outline-none",
            "data-[state=open]:animate-dialog-in data-[state=closed]:animate-dialog-out",
          )}
        >
          <VisuallyHidden.Root>
            <DialogPrimitive.Title>{title}</DialogPrimitive.Title>
          </VisuallyHidden.Root>
          <Command className="rounded-none" {...props}>
            {children}
          </Command>
          {footer ? (
            <div className="flex items-center gap-4 border-t border-border px-4 py-2 text-caption text-muted">{footer}</div>
          ) : null}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
