import { FileText, LayoutGrid, LifeBuoy, Newspaper, Ticket, UserRound, type LucideIcon } from "lucide-react";
import type { SearchResultType } from "./types";

const ICONS: Record<SearchResultType, LucideIcon> = {
  page: FileText,
  person: UserRound,
  app: LayoutGrid,
  request_type: LifeBuoy,
  ticket: Ticket,
  post: Newspaper,
};

export function ResultIcon({ type, className }: { type: SearchResultType; className?: string }) {
  const Icon = ICONS[type] ?? FileText;
  return <Icon className={className} aria-hidden />;
}
