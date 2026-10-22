import Link from "next/link";
import { Clock3 } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { SpotlightLayer } from "@/components/ui/effects/spotlight";
import { cn } from "@/lib/cn";

/**
 * A person cell in the Home onboarding card's language: a big generated face, a name, their role
 * on this journey, and one small action pill at the foot. The name is the link (stretched over the
 * cell), so a footer button stays its own target.
 */
export function PersonCell({
  person,
  role,
  footer,
  className,
}: {
  person: { id: string; name: string; avatarUrl: string | null };
  role: string;
  footer?: React.ReactNode;
  className?: string;
}) {
  return (
    <li className={cn("group/person relative isolate flex flex-col items-center gap-2 rounded-card bg-raised px-3 pb-3 pt-4 text-center shadow-cell transition-shadow duration-160 hover:shadow-cell-hover", className)}>
      <SpotlightLayer />
      <Avatar name={person.name} seed={person.id} src={person.avatarUrl} size="xl" className="size-14" />
      <span className="flex min-w-0 max-w-full flex-col">
        <Link
          href={`/people/${person.id}`}
          className="focus-ring truncate rounded-[4px] py-0.5 text-body font-medium text-fg after:absolute after:inset-0 after:rounded-card after:content-['']"
        >
          {person.name}
        </Link>
        <span className="truncate text-caption text-muted">{role}</span>
      </span>
      {footer ? <span className="relative z-10 mt-auto flex">{footer}</span> : null}
    </li>
  );
}

/** The placeholder cell while someone is still to be chosen (a buddy being picked). */
export function PendingPersonCell({ role, note, footer }: { role: string; note: string; footer?: React.ReactNode }) {
  return (
    <li className="flex flex-col items-center gap-2 rounded-card bg-raised/60 px-3 pb-3 pt-4 text-center">
      <span className="hatch inline-flex size-14 items-center justify-center rounded-full text-muted" aria-hidden>
        <Clock3 className="size-5 stroke-[1.5]" />
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-body font-medium text-fg">{role}</span>
        <span className="text-caption text-muted text-pretty">{note}</span>
      </span>
      {footer ? <span className="mt-auto flex">{footer}</span> : null}
    </li>
  );
}
