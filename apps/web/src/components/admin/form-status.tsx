"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { CircleAlert } from "lucide-react";
import { toast } from "@/components/ui/toast";
import type { ActionResult } from "@/app/(app)/admin/_actions";

/**
 * Reacts to a server action result: toasts success, follows `next` (wizard steps) and shows
 * a form-level error banner. Field errors are rendered by the fields themselves.
 */
export function useActionFeedback(state: ActionResult | null) {
  const router = useRouter();
  const seen = useRef<ActionResult | null>(null);
  useEffect(() => {
    if (!state || seen.current === state) return;
    seen.current = state;
    if (state.ok) {
      if (state.next) router.push(state.next);
      else if (state.message) toast.success(state.message);
      router.refresh();
    }
  }, [state, router]);
}

export function FormError({ state }: { state: ActionResult | null }) {
  if (!state || state.ok) return null;
  return (
    <div role="alert" className="flex items-start gap-2 rounded-card bg-danger-soft px-4 py-3 text-small text-danger-text">
      <CircleAlert className="mt-px size-4 shrink-0 stroke-[1.5]" aria-hidden />
      <span>{state.error}</span>
    </div>
  );
}

export const fieldError = (state: ActionResult | null, key: string) => (state && !state.ok ? state.fieldErrors?.[key] : undefined);
