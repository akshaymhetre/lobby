"use client";

import * as React from "react";
import { Check, Hand } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { sayHiAction } from "@/app/(app)/people/_actions";

/** Sends a "Say hi" greeting with one click; becomes a quiet "Said hi" once sent. */
export function SayHiButton({
  personId,
  firstName,
  greeted,
  size = "sm",
  variant = "secondary",
  className,
}: {
  personId: string;
  firstName: string;
  greeted: boolean;
  size?: ButtonProps["size"];
  variant?: ButtonProps["variant"];
  className?: string;
}) {
  const [done, setDone] = React.useState(greeted);
  const [pending, start] = React.useTransition();

  if (done) {
    return (
      <span className={"inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap px-1 text-small font-medium text-success-text md:h-8 " + (className ?? "")}>
        <Check className="size-3.5 stroke-[2]" aria-hidden />
        Said hi
      </span>
    );
  }

  return (
    <Button
      size={size}
      variant={variant}
      loading={pending}
      className={className}
      aria-label={`Say hi to ${firstName}`}
      onClick={() =>
        start(async () => {
          const res = await sayHiAction(personId);
          if (res.ok) {
            setDone(true);
            toast.success(`You said hi to ${firstName}`, { description: "They will see it in their notifications." });
          } else {
            toast.error(res.error ?? "That did not send. Try again.");
          }
        })
      }
    >
      <Hand aria-hidden />
      Say hi
    </Button>
  );
}
