"use client";

import * as React from "react";
import { Timer } from "lucide-react";
import { formatMinutes } from "@lobby/core/helpdesk/sla";
import { AnimatedBeam } from "@/components/ui/effects/animated-beam";
import { cn } from "@/lib/cn";
import { HelpIcon } from "../icons";
import type { AdminData } from "./helpdesk-admin";

/**
 * The helpdesk as a map: each team on the left, the SLA policies on the right, and a line for
 * every pairing its request types use. Lines carry one spark each on first load; pointing at a
 * team or a policy lights only its own lines (and runs a spark along them) and quiets the rest,
 * so "which clock does Finance run on" is one hover away. Desktop only; a phone gets the tabs.
 */
export function RoutingMap({ data }: { data: AdminData }) {
  const box = React.useRef<HTMLDivElement>(null);
  const teamRefs = React.useMemo(() => data.teams.map(() => React.createRef<HTMLDivElement>()), [data.teams]);
  const policyRefs = React.useMemo(() => data.policies.map(() => React.createRef<HTMLDivElement>()), [data.policies]);
  const [focus, setFocus] = React.useState<{ kind: "team" | "policy"; id: string } | null>(null);

  const edges = React.useMemo(() => {
    const out: { team: number; policy: number; types: number }[] = [];
    data.teams.forEach((t, ti) => {
      data.policies.forEach((p, pi) => {
        const n = data.requestTypes.filter((r) => r.teamId === t.id && r.slaPolicyId === p.id && r.active).length;
        if (n) out.push({ team: ti, policy: pi, types: n });
      });
    });
    return out;
  }, [data]);

  if (!data.teams.length || !data.policies.length) return null;

  const lit = (e: { team: number; policy: number }) =>
    focus
      ? focus.kind === "team"
        ? data.teams[e.team]!.id === focus.id
        : data.policies[e.policy]!.id === focus.id
      : null;

  return (
    <section aria-labelledby="routing-title" className="mb-8 hidden rounded-panel panel p-6 md:block">
      <div className="mb-5 flex items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h2 id="routing-title" className="text-h4 font-medium text-fg">
            Who handles what, on which clock
          </h2>
          <p className="text-small text-muted">Point at a team or a policy to trace its requests.</p>
        </div>
        <p className="text-small text-subtle tabular">
          {data.requestTypes.filter((r) => r.active).length} request types · {data.teams.length} teams · {data.policies.length} policies
        </p>
      </div>
      <div ref={box} className="relative grid grid-cols-[minmax(0,15rem)_1fr_minmax(0,17rem)] items-center gap-y-2">
        <ul className="col-start-1 flex flex-col gap-2" aria-label="Teams">
          {data.teams.map((t, i) => {
            const types = data.requestTypes.filter((r) => r.teamId === t.id && r.active).length;
            const dim = focus && !(focus.kind === "team" && focus.id === t.id) && !edges.some((e) => e.team === i && lit(e));
            return (
              <li key={t.id}>
                <div
                  ref={teamRefs[i]}
                  tabIndex={0}
                  onPointerEnter={() => setFocus({ kind: "team", id: t.id })}
                  onPointerLeave={() => setFocus(null)}
                  onFocus={() => setFocus({ kind: "team", id: t.id })}
                  onBlur={() => setFocus(null)}
                  aria-label={`${t.name}: ${types} request types, ${t.ticketCount} tickets`}
                  className={cn(
                    "focus-ring relative z-10 flex items-center gap-3 rounded-cell px-3 py-2.5 cell transition-[opacity,box-shadow,transform] duration-200",
                    dim && "opacity-45",
                    focus?.kind === "team" && focus.id === t.id && "-translate-y-px shadow-cell-hover",
                  )}
                >
                  <span className="cat-blue inline-flex size-8 shrink-0 items-center justify-center rounded-full shadow-cell" aria-hidden>
                    <HelpIcon name={t.icon} className="size-4 text-current" />
                  </span>
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate text-body font-medium text-fg">{t.name}</span>
                    <span className="truncate text-caption text-muted">
                      {types} {types === 1 ? "type" : "types"} · {t.ticketCount} {t.ticketCount === 1 ? "ticket" : "tickets"}
                    </span>
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
        <ul className="col-start-3 row-start-1 flex flex-col gap-3" aria-label="SLA policies">
          {data.policies.map((p, i) => {
            const dim = focus && !(focus.kind === "policy" && focus.id === p.id) && !edges.some((e) => e.policy === i && lit(e));
            return (
              <li key={p.id}>
                <div
                  ref={policyRefs[i]}
                  tabIndex={0}
                  onPointerEnter={() => setFocus({ kind: "policy", id: p.id })}
                  onPointerLeave={() => setFocus(null)}
                  onFocus={() => setFocus({ kind: "policy", id: p.id })}
                  onBlur={() => setFocus(null)}
                  aria-label={`${p.name}: normal priority, first reply in ${formatMinutes(p.targets.normal.firstResponse)}, fixed in ${formatMinutes(p.targets.normal.resolution)}`}
                  className={cn(
                    "focus-ring relative z-10 flex items-center gap-3 rounded-cell px-3 py-3 cell transition-[opacity,box-shadow,transform] duration-200",
                    dim && "opacity-45",
                    focus?.kind === "policy" && focus.id === p.id && "-translate-y-px shadow-cell-hover",
                  )}
                >
                  <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-now-soft text-now-text" aria-hidden>
                    <Timer className="size-4 stroke-[1.75]" />
                  </span>
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate text-body font-medium text-fg">{p.name}</span>
                    <span className="truncate text-caption text-muted tabular">
                      Normal: reply {formatMinutes(p.targets.normal.firstResponse)}, fix {formatMinutes(p.targets.normal.resolution)}
                    </span>
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
        {edges.map((e, k) => {
          const on = lit(e);
          return (
            <AnimatedBeam
              key={`${e.team}-${e.policy}-${on === null ? "all" : on ? "on" : "off"}`}
              containerRef={box}
              fromRef={teamRefs[e.team]!}
              toRef={policyRefs[e.policy]!}
              fromAnchor="right"
              toAnchor="left"
              shape="s"
              active={on !== false}
              repeat={on ? 2 : 1}
              delay={on === null ? 0.4 + k * 0.12 : 0}
              tone={on ? "now" : "accent"}
              width={on ? 2.25 : 1.75}
              className={cn("transition-opacity duration-200", on === false && "opacity-30")}
            />
          );
        })}
      </div>
    </section>
  );
}
