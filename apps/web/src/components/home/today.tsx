import Link from "next/link";
import { ArrowRight, CircleCheck } from "lucide-react";
import type { TodayData } from "@lobby/core/home";
import { daysUntil } from "@lobby/core/home/logic";
import { Section } from "@/components/ui/section";
import { cn } from "@/lib/cn";
import { formatDate, timeAgo } from "@/lib/time";

function due(day: string) {
  const n = daysUntil(day);
  if (n < 0) return { text: n === -1 ? "Due yesterday" : `${-n} days overdue`, late: true };
  if (n === 0) return { text: "Due today", late: false };
  if (n === 1) return { text: "Due tomorrow", late: false };
  return { text: `Due ${formatDate(day, { day: "numeric", month: "short" })}`, late: false };
}

const STATUS: Record<string, string> = {
  new: "Waiting for the team",
  open: "In progress",
  pending_approval: "Waiting for approval",
  waiting_on_requester: "Waiting on you",
};

function Group({ label, count, href, children }: { label: string; count: number; href: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col">
      <Link
        href={href}
        className="focus-ring touch-target group -mx-2 flex h-8 items-center gap-2 rounded-control px-2 text-small font-medium text-fg transition-colors duration-120 hover:bg-hover"
      >
        {label}
        <span className="tabular text-subtle">{count}</span>
        <ArrowRight className="ml-auto size-3.5 stroke-[1.5] text-subtle transition-transform duration-120 group-hover:translate-x-0.5" aria-hidden />
      </Link>
      <ul className="flex flex-col">{children}</ul>
    </div>
  );
}

function Item({ href, title, meta, late }: { href: string; title: string; meta: string; late?: boolean }) {
  return (
    <li>
      <Link
        href={href}
        className="focus-ring -mx-2 flex min-h-11 flex-col justify-center rounded-control px-2 py-1.5 transition-colors duration-120 hover:bg-hover"
      >
        <span className="line-clamp-1 text-body text-fg">{title}</span>
        <span className={cn("text-caption", late ? "font-medium text-danger-text" : "text-muted")}>{meta}</span>
      </Link>
    </li>
  );
}

/**
 * "Today": the reader's onboarding steps, approvals and open requests as a headed group of rows.
 * The counts live in the masthead's Today line; this lists the items themselves.
 */
export function TodayList({ today, className }: { today: TodayData; className?: string }) {
  const empty = !today.taskCount && !today.approvalCount && !today.ticketCount;
  return (
    <Section tone="quiet" title="Today" className={className}>
      {empty ? (
        <p className="flex items-start gap-2 text-body text-muted">
          <CircleCheck className="mt-0.5 size-4 shrink-0 stroke-[1.5] text-success-text" aria-hidden />
          You are all caught up. New tasks and approvals will show up here.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {today.taskCount ? (
            <Group label="To do" count={today.taskCount} href="/journeys">
              {today.tasks.map((t) => {
                const d = due(t.dueDate);
                return (
                  <Item
                    key={t.id}
                    href="/journeys"
                    title={t.title}
                    meta={t.subjectName ? `${d.text} · for ${t.subjectName}` : d.text}
                    late={d.late}
                  />
                );
              })}
            </Group>
          ) : null}
          {today.approvalCount ? (
            <Group label="Approvals" count={today.approvalCount} href="/approvals">
              {today.approvals.map((a) => (
                <Item key={a.id} href="/approvals" title={a.subject} meta={`#${a.ticketNumber} from ${a.requesterName}`} />
              ))}
            </Group>
          ) : null}
          {today.ticketCount ? (
            <Group label="Your requests" count={today.ticketCount} href="/help">
              {today.tickets.map((t) => (
                <Item
                  key={t.id}
                  href="/help"
                  title={t.subject}
                  meta={`#${t.number} · ${STATUS[t.status] ?? "Open"} · ${timeAgo(t.updatedAt)}`}
                />
              ))}
            </Group>
          ) : null}
        </div>
      )}
    </Section>
  );
}
