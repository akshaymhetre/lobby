import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/cn";

export interface PersonLiteView {
  id: string;
  name: string;
  title: string | null;
  avatarUrl: string | null;
}

/** Avatar + name (+ title) linking to the profile. */
export function PersonChip({ person, size = "sm", showTitle = false, className }: { person: PersonLiteView; size?: "xs" | "sm" | "md"; showTitle?: boolean; className?: string }) {
  return (
    <Link
      href={`/people/${person.id}`}
      className={cn("focus-ring group inline-flex min-w-0 items-center gap-2 rounded-control", className)}
    >
      <Avatar name={person.name} seed={person.id} src={person.avatarUrl} size={size} />
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-small font-medium text-fg group-hover:underline group-hover:underline-offset-2">{person.name}</span>
        {showTitle && person.title ? <span className="truncate text-caption text-muted">{person.title}</span> : null}
      </span>
    </Link>
  );
}
