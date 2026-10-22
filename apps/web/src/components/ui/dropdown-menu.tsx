"use client";

import * as React from "react";
import { DropdownMenu as Menu } from "radix-ui";
import { Check, ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";

export const DropdownMenu = Menu.Root;
export const DropdownMenuTrigger = Menu.Trigger;
export const DropdownMenuGroup = Menu.Group;
export const DropdownMenuSub = Menu.Sub;
export const DropdownMenuRadioGroup = Menu.RadioGroup;

export const menuContentClass =
  "z-50 min-w-[200px] overflow-hidden rounded-card bg-raised p-1.5 text-fg shadow-popover " +
  "data-[state=open]:animate-pop-in data-[state=closed]:animate-pop-out origin-[var(--radix-dropdown-menu-content-transform-origin)]";

export const menuItemClass =
  "relative flex h-9 cursor-pointer select-none items-center gap-2 rounded-control px-2.5 text-body outline-none md:h-8 " +
  "data-[highlighted]:bg-hover data-[disabled]:pointer-events-none data-[disabled]:opacity-50 " +
  "[&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:stroke-[1.5] [&_svg]:text-muted";

export function DropdownMenuContent({
  className,
  sideOffset = 4,
  ...props
}: React.ComponentProps<typeof Menu.Content>) {
  return (
    <Menu.Portal>
      <Menu.Content sideOffset={sideOffset} className={cn(menuContentClass, className)} {...props} />
    </Menu.Portal>
  );
}

export function DropdownMenuItem({
  className,
  destructive,
  shortcut,
  children,
  ...props
}: React.ComponentProps<typeof Menu.Item> & { destructive?: boolean; shortcut?: string }) {
  return (
    <Menu.Item
      className={cn(menuItemClass, destructive && "text-danger-text [&_svg]:text-danger-text", className)}
      {...props}
    >
      {/* With asChild, Radix Slot needs exactly one child, so the shortcut slot is omitted. */}
      {props.asChild ? (
        children
      ) : (
        <>
          {children}
          {shortcut ? <span className="ml-auto pl-4 text-caption tracking-wide text-subtle">{shortcut}</span> : null}
        </>
      )}
    </Menu.Item>
  );
}

export function DropdownMenuCheckboxItem({
  className,
  children,
  ...props
}: React.ComponentProps<typeof Menu.CheckboxItem>) {
  return (
    <Menu.CheckboxItem className={cn(menuItemClass, "pl-8", className)} {...props}>
      <span className="absolute left-2 inline-flex size-4 items-center justify-center">
        <Menu.ItemIndicator>
          <Check className="!text-accent-text" aria-hidden />
        </Menu.ItemIndicator>
      </span>
      {children}
    </Menu.CheckboxItem>
  );
}

export function DropdownMenuRadioItem({ className, children, ...props }: React.ComponentProps<typeof Menu.RadioItem>) {
  return (
    <Menu.RadioItem className={cn(menuItemClass, "pl-8", className)} {...props}>
      <span className="absolute left-2 inline-flex size-4 items-center justify-center">
        <Menu.ItemIndicator>
          <span className="block size-1.5 rounded-full bg-accent-text" />
        </Menu.ItemIndicator>
      </span>
      {children}
    </Menu.RadioItem>
  );
}

export function DropdownMenuLabel({ className, ...props }: React.ComponentProps<typeof Menu.Label>) {
  return <Menu.Label className={cn("px-2 pb-1 pt-2 text-caption font-medium text-muted", className)} {...props} />;
}

export function DropdownMenuSeparator({ className, ...props }: React.ComponentProps<typeof Menu.Separator>) {
  return <Menu.Separator className={cn("-mx-1 my-1 h-px bg-border", className)} {...props} />;
}

export function DropdownMenuSubTrigger({ className, children, ...props }: React.ComponentProps<typeof Menu.SubTrigger>) {
  return (
    <Menu.SubTrigger className={cn(menuItemClass, "data-[state=open]:bg-hover", className)} {...props}>
      {children}
      <ChevronRight className="ml-auto" aria-hidden />
    </Menu.SubTrigger>
  );
}

export function DropdownMenuSubContent({ className, ...props }: React.ComponentProps<typeof Menu.SubContent>) {
  return (
    <Menu.Portal>
      <Menu.SubContent className={cn(menuContentClass, className)} {...props} />
    </Menu.Portal>
  );
}
