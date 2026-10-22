import { AppWindow, BookOpen, ClipboardList, Handshake, LifeBuoy, ListChecks, ShieldCheck, type LucideIcon } from "lucide-react";

export const STEP_TYPE_META: Record<string, { icon: LucideIcon; label: string; hint: string }> = {
  task: { icon: ListChecks, label: "Task", hint: "Something to do, ticked off by hand" },
  read_page: { icon: BookOpen, label: "Read a page", hint: "Links to a Knowledge page" },
  acknowledge_page: { icon: ShieldCheck, label: "Acknowledge a page", hint: "They confirm they have read a policy" },
  launch_app: { icon: AppWindow, label: "Open an app", hint: "Signs them in to an app" },
  meet_person: { icon: Handshake, label: "Meet someone", hint: "Introduces a colleague" },
  create_ticket: { icon: LifeBuoy, label: "Raise a request", hint: "Opens a helpdesk ticket automatically" },
  form: { icon: ClipboardList, label: "Answer questions", hint: "A short form, answers saved" },
};

export function StepIcon({ type, className }: { type: string; className?: string }) {
  const Icon = STEP_TYPE_META[type]?.icon ?? ListChecks;
  return <Icon className={className} aria-hidden />;
}
