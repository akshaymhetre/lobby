import Link from "next/link";
import { ArrowUpRight, Banknote, ChevronRight } from "lucide-react";
import type { HomeCardRow } from "@lobby/core/home";
import { nextPayday } from "@lobby/core/home/logic";
import { Section } from "@/components/ui/section";
import { formatDate } from "@/lib/time";
import { MoreOnPhone } from "./more-on-phone";

interface LinkItem {
  label: string;
  href: string;
  external?: boolean;
}

const isSafeHref = (h: string) => (h.startsWith("/") && !h.startsWith("//")) || h.startsWith("https://");

/**
 * A figure with its label. Payday is the planner's coral category, so it is a filled coral block
 * (the same colour as the payday marker in the planner); every other figure is a raised cell with
 * the number at 24px and a sentence-case label.
 */
function Kpi({ card, workingDays }: { card: HomeCardRow; workingDays: number[] }) {
  const cfg = card.config as { compute?: string; value?: string; hint?: string };
  let value = cfg.value ?? "";
  const hint = cfg.hint;
  if (cfg.compute === "next-payday") {
    const d = nextPayday(new Date(), workingDays);
    const days = Math.round((d.getTime() - Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate())) / 86_400_000);
    value = formatDate(d, { weekday: "short", day: "numeric", month: "short" });
    // A raised cell like the other figures; payday's coral lives on the icon disc only (the planner
    // already carries the loud coral marker on the day itself).
    return (
      <div className="cell min-w-0 rounded-card px-4 py-3">
        <dt className="sr-only">{card.title}</dt>
        <dd className="flex min-w-0 items-center gap-3">
          <span aria-hidden className="cat-coral inline-flex size-11 shrink-0 items-center justify-center rounded-full shadow-[inset_0_1px_0_rgb(255_255_255/0.35)]">
            <Banknote className="size-5 stroke-[1.75]" />
          </span>
          <span className="flex min-w-0 flex-1 flex-col">
            <span aria-hidden className="text-small text-muted">{card.title}</span>
            <span className="tabular text-h2 font-medium text-fg">{value}</span>
          </span>
          <span className="shrink-0 rounded-full bg-cat-coral-soft px-2.5 py-1 text-caption font-medium text-cat-coral-text">
            {days === 0 ? "Today" : `In ${days} ${days === 1 ? "day" : "days"}`}
          </span>
        </dd>
      </div>
    );
  }
  return (
    <div className="cell flex min-w-0 flex-col gap-0.5 rounded-card px-4 py-3">
      <dt className="text-small text-muted">{card.title}</dt>
      <dd className="tabular text-h2 font-medium text-fg">{value}</dd>
      {hint ? <dd className="text-caption text-muted text-pretty">{hint}</dd> : null}
    </div>
  );
}

function LinksGroup({ card }: { card: HomeCardRow }) {
  const links = ((card.config as { links?: LinkItem[] }).links ?? []).filter((l) => isSafeHref(l.href));
  const cls =
    "focus-ring touch-target group -mx-2 flex h-11 items-center gap-2 rounded-control px-2 text-body text-fg transition-colors duration-120 hover:bg-hover md:h-9";
  return (
    <Section tone="quiet" as="h3" title={card.title}>
      <ul className="flex flex-col">
        {links.map((l) => {
          const external = l.external || l.href.startsWith("https://");
          return (
            <li key={l.href + l.label}>
              {external ? (
                <a href={l.href} target="_blank" rel="noopener noreferrer" className={cls}>
                  <span className="truncate">{l.label}</span>
                  <ArrowUpRight className="ml-auto size-3.5 shrink-0 stroke-[1.5] text-subtle" aria-hidden />
                  <span className="sr-only">(opens in a new tab)</span>
                </a>
              ) : (
                <Link href={l.href} className={cls}>
                  <span className="truncate">{l.label}</span>
                  <ChevronRight className="ml-auto size-3.5 shrink-0 stroke-[1.5] text-subtle transition-transform duration-120 group-hover:translate-x-0.5" aria-hidden />
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </Section>
  );
}

function EmbedGroup({ card }: { card: HomeCardRow }) {
  const cfg = card.config as { url?: string; height?: number };
  if (!cfg.url || !cfg.url.startsWith("https://")) return null;
  return (
    <Section tone="quiet" as="h3" title={card.title}>
      <iframe
        src={cfg.url}
        title={card.title}
        loading="lazy"
        sandbox="allow-scripts allow-same-origin allow-popups"
        referrerPolicy="no-referrer"
        className="w-full rounded-card bg-raised shadow-cell"
        style={{ height: Math.min(Math.max(cfg.height ?? 240, 120), 600) }}
      />
    </Section>
  );
}

/**
 * Admin-configured cards, rendered as headed groups rather than a stack of boxes: figures two-up,
 * link lists as rows. Only an embed keeps a frame, because an iframe needs one.
 */
export function HomeCards({ cards, workingDays }: { cards: HomeCardRow[]; workingDays: number[] }) {
  if (!cards.length) return null;
  const kpis = cards.filter((c) => c.type === "kpi");
  const rest = cards.filter((c) => c.type !== "kpi");
  const linkCount = rest.reduce((n, c) => n + (c.type === "links" ? ((c.config as { links?: LinkItem[] }).links?.length ?? 0) : 1), 0);
  return (
    <div className="flex flex-col gap-6 md:grid md:grid-cols-2 md:items-start md:gap-x-8">
      {kpis.length ? (
        <dl className="grid grid-cols-1 gap-3">
          {kpis.map((c) => (
            <Kpi key={c.id} card={c} workingDays={workingDays} />
          ))}
        </dl>
      ) : null}
      {/* Phones keep the figures and fold the link lists behind one button. */}
      <MoreOnPhone count={linkCount} noun={linkCount === 1 ? "link" : "links"}>
        <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-1 xl:grid-cols-2">
          {rest.map((c) => (c.type === "links" ? <LinksGroup key={c.id} card={c} /> : <EmbedGroup key={c.id} card={c} />))}
        </div>
      </MoreOnPhone>
    </div>
  );
}
