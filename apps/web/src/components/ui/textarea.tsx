import * as React from "react";
import { cn } from "@/lib/cn";
import { controlBase } from "./input";

export function Textarea({ className, rows = 4, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      rows={rows}
      className={cn(controlBase, "min-h-20 resize-y px-3 py-2 leading-5", className)}
      {...props}
    />
  );
}
