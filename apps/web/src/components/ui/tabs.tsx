"use client";

import * as React from "react";
import { Tabs as TabsPrimitive } from "radix-ui";
import { cn } from "@/lib/cn";
import { LayoutGroup, SlidingPill } from "./motion";

/*
 * Pill tabs. The list is a sunken track; the active tab is a raised white pill that slides to
 * the new tab (a shared-layout spring, no bounce). The Radix API is unchanged: Tabs, TabsList,
 * TabsTrigger, TabsContent, plus TabsCount for a count after a label.
 */

const TabsContext = React.createContext<{ value: string | undefined; id: string }>({ value: undefined, id: "tabs" });

export function Tabs({ value, defaultValue, onValueChange, children, ...props }: React.ComponentProps<typeof TabsPrimitive.Root>) {
  const [inner, setInner] = React.useState(defaultValue);
  const current = value ?? inner;
  const id = React.useId();
  return (
    <TabsContext.Provider value={{ value: current, id }}>
      <TabsPrimitive.Root
        value={value}
        defaultValue={defaultValue}
        onValueChange={(v) => {
          setInner(v);
          onValueChange?.(v);
        }}
        {...props}
      >
        <LayoutGroup id={id}>{children}</LayoutGroup>
      </TabsPrimitive.Root>
    </TabsContext.Provider>
  );
}

export function TabsList({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      className={cn(
        "inline-flex max-w-full items-center gap-1 overflow-x-auto rounded-full bg-sunken p-1 [scrollbar-width:none]",
        className,
      )}
      {...props}
    />
  );
}

export function TabsTrigger({ className, children, value, ...props }: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  const ctx = React.useContext(TabsContext);
  const active = ctx.value === value;
  return (
    <TabsPrimitive.Trigger
      value={value}
      className={cn(
        "group focus-ring relative isolate inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-4 text-body font-medium text-muted",
        "transition-colors duration-160 ease-standard hover:text-fg md:h-8 md:px-3.5",
        "data-[state=active]:text-fg disabled:opacity-50",
        "[&_svg]:size-4 [&_svg]:stroke-[1.75]",
        className,
      )}
      {...props}
    >
      {active ? <SlidingPill layoutId={`${ctx.id}-pill`} className="cell rounded-full" /> : null}
      {children}
    </TabsPrimitive.Trigger>
  );
}

/** Small count shown after a tab label. */
export function TabsCount({ children }: { children: React.ReactNode }) {
  return (
    <span className="tabular rounded-full bg-hover px-1.5 text-caption text-muted group-data-[state=active]:text-fg">
      {children}
    </span>
  );
}

export function TabsContent({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return <TabsPrimitive.Content className={cn("focus-ring rounded-control pt-4 outline-none", className)} {...props} />;
}
