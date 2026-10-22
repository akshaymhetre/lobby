"use client";

import { Sparkles } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { openAssistant } from "@/components/shell/shell-events";

export function AskAiButton({ query, icon = true, children, ...props }: ButtonProps & { query: string; icon?: boolean }) {
  return (
    <Button {...props} onClick={() => openAssistant(query)}>
      {icon ? <Sparkles aria-hidden /> : null}
      {children ?? "Ask the assistant"}
    </Button>
  );
}
