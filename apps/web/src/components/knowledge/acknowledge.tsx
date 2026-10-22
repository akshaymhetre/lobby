"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CircleCheck, FileCheck2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { formatDate } from "@/lib/time";
import { acknowledgeAction } from "@/app/(app)/knowledge/_actions";

/** "I have read and understood this" for policy pages. */
export function Acknowledge({ pageId, acknowledgedAt, total }: { pageId: string; acknowledgedAt: string | null; total: number }) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const [at, setAt] = React.useState(acknowledgedAt);

  const confirm = () =>
    start(async () => {
      const r = await acknowledgeAction(pageId);
      if (!r.ok) return void toast.error(r.error);
      setAt(r.acknowledgedAt);
      toast.success("Thanks, that is recorded");
      router.refresh();
    });

  if (at) {
    return (
      <div className="flex items-start gap-3 rounded-card bg-cat-green-soft px-4 py-3.5" role="status">
        <CircleCheck className="mt-0.5 size-5 shrink-0 stroke-[1.5] text-cat-green-text" aria-hidden />
        <div>
          <p className="text-body font-medium text-fg">You confirmed you have read and understood this policy</p>
          <p className="text-small text-muted">
            On {formatDate(at)}. {total > 1 ? `${total} people have confirmed so far.` : null}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="cell flex flex-col gap-4 rounded-card p-4 sm:flex-row sm:items-center sm:p-5">
      <FileCheck2 className="size-5 shrink-0 stroke-[1.5] text-muted sm:mt-0.5 sm:self-start" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-body font-medium text-fg">Please confirm you have read this policy</p>
        <p className="text-small text-muted">Your confirmation is recorded with today&apos;s date. The policy owner can see who has confirmed.</p>
      </div>
      <Button onClick={confirm} loading={pending} className="sm:shrink-0">
        I have read and understood this
      </Button>
    </div>
  );
}
