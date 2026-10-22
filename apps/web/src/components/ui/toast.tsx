"use client";

import * as React from "react";
import { Toaster as Sonner, toast } from "sonner";
import { useTheme } from "@/components/theme";
import { CircleAlert, CircleCheck, Info, Loader2, TriangleAlert } from "lucide-react";

export { toast };

export function Toaster(props: React.ComponentProps<typeof Sonner>) {
  const { resolvedTheme } = useTheme();
  return (
    <Sonner
      theme={resolvedTheme === "dark" ? "dark" : "light"}
      position="bottom-right"
      gap={8}
      offset={16}
      mobileOffset={12}
      icons={{
        success: <CircleCheck className="size-4 stroke-[1.5] text-success-text" />,
        error: <CircleAlert className="size-4 stroke-[1.5] text-danger-text" />,
        warning: <TriangleAlert className="size-4 stroke-[1.5] text-warning-text" />,
        info: <Info className="size-4 stroke-[1.5] text-info-text" />,
        loading: <Loader2 className="size-4 animate-spin-slow stroke-[1.5] text-muted" />,
      }}
      toastOptions={{
        unstyled: true,
        classNames: {
          toast:
            "group flex w-full items-start gap-3 rounded-card bg-raised px-4 py-3 text-fg shadow-popover sm:w-[360px] font-sans dark:glass dark:bg-glass-strong",
          icon: "mt-0.5 shrink-0",
          content: "flex min-w-0 flex-1 flex-col gap-0.5",
          title: "text-body font-medium text-fg",
          description: "text-small text-muted",
          actionButton:
            "focus-ring ml-auto shrink-0 self-center rounded-full bg-accent px-3 h-8 text-small font-medium text-accent-fg hover:bg-accent-hover",
          cancelButton:
            "focus-ring shrink-0 self-center rounded-full px-3 h-8 text-small font-medium text-muted hover:bg-hover hover:text-fg",
          closeButton: "!bg-raised !border-border !text-muted hover:!text-fg",
        },
      }}
      {...props}
    />
  );
}
