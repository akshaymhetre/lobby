"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  CalendarClock,
  ChevronRight,
  FileText,
  MessageSquareText,
  PackagePlus,
  PlugZap,
  Plus,
  Timer,
  Users,
} from "lucide-react";
import { formatMinutes } from "@lobby/core/helpdesk/sla";
import type { FormFieldDef } from "@lobby/core/helpdesk/fields";
import { Tabs, TabsContent, TabsCount, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RoutingMap } from "./routing-map";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { toast } from "@/components/ui/toast";
import { installStarterAction, testConnectorAction } from "@/app/(app)/admin/helpdesk/_actions";
import { HelpIcon } from "../icons";
import type { Priority } from "../status";
import { RequestTypeEditor, type RequestTypeDraft } from "./request-type-editor";
import {
  CalendarEditor,
  CannedEditor,
  ConnectorEditor,
  PolicyEditor,
  TeamEditor,
  type CalendarDraft,
  type CannedDraft,
  type ConnectorDraft,
  type PolicyDraft,
  type TeamDraft,
} from "./editors";
import { RowButton, SectionHead } from "./shared";

type Targets = PolicyDraft["targets"];

export interface AdminData {
  teams: (TeamDraft & { id: string; ticketCount: number })[];
  requestTypes: (RequestTypeDraft & { id: string })[];
  policies: { id: string; name: string; targets: Targets }[];
  calendars: (CalendarDraft & { id: string })[];
  canned: (CannedDraft & { id: string })[];
  groups: { id: string; displayName: string }[];
  connectors: (ConnectorDraft & { id: string; linkedTickets: number })[];
}

const APPROVAL_LABEL = {
  none: "No approval",
  manager: "Manager",
  group: "Group",
  manager_then_group: "Manager, then group",
} as const;
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
const DAY = ["", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const hhmm = (m: number) =>
  `${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

type Editing =
  | { kind: "rt"; draft: RequestTypeDraft }
  | { kind: "team"; draft: TeamDraft }
  | { kind: "policy"; draft: PolicyDraft }
  | { kind: "calendar"; draft: CalendarDraft }
  | { kind: "canned"; draft: CannedDraft }
  | { kind: "connector"; draft: ConnectorDraft };

export function HelpdeskAdmin({
  data,
  origin,
  initialTab,
}: {
  data: AdminData;
  origin: string;
  initialTab: string;
}) {
  const router = useRouter();
  const [editing, setEditing] = React.useState<(Editing & { key: number }) | null>(null);
  const [open, setOpen] = React.useState(false);
  const [testing, setTesting] = React.useState<string | null>(null);
  const [installing, startInstall] = React.useTransition();
  const edit = (e: Editing) => {
    setEditing({ ...e, key: Date.now() } as Editing & { key: number });
    setOpen(true);
  };
  const teamName = (id: string | null) => data.teams.find((t) => t.id === id)?.name ?? "Every team";
  const groupName = (id: string | null) =>
    data.groups.find((g) => g.id === id)?.displayName ?? null;

  const newRt = (): RequestTypeDraft => ({
    slug: "",
    teamId: data.teams[0]?.id ?? "",
    name: "",
    description: "",
    icon: "life-buoy",
    fields: [],
    approval: { mode: "none" },
    slaPolicyId: data.policies[0]?.id ?? null,
    defaultPriority: "normal",
    active: true,
  });

  const test = async (id: string) => {
    setTesting(id);
    try {
      const r = await testConnectorAction(id);
      if (r.ok) toast.success(r.message);
      else toast.error(r.message);
    } finally {
      setTesting(null);
    }
  };

  return (
    <>
      <RoutingMap data={data} />
      <Tabs
        defaultValue={initialTab}
        onValueChange={(t) => {
          const u = new URL(window.location.href);
          u.searchParams.set("tab", t);
          window.history.replaceState(null, "", u);
        }}
      >
        <TabsList aria-label="Helpdesk settings">
          <TabsTrigger value="types">
            <FileText />
            Request types <TabsCount>{data.requestTypes.length}</TabsCount>
          </TabsTrigger>
          <TabsTrigger value="teams">
            <Users />
            Teams <TabsCount>{data.teams.length}</TabsCount>
          </TabsTrigger>
          <TabsTrigger value="sla">
            <Timer />
            SLA policies
          </TabsTrigger>
          <TabsTrigger value="calendars">
            <CalendarClock />
            Business hours
          </TabsTrigger>
          <TabsTrigger value="canned">
            <MessageSquareText />
            Canned replies
          </TabsTrigger>
          <TabsTrigger value="connectors">
            <PlugZap />
            Connectors <TabsCount>{data.connectors.length}</TabsCount>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="types" className="pt-6">
          <SectionHead
            title="Request types"
            description="What people can ask for. Each one belongs to a team, has its own form, and can need approval."
            action={
              <Button
                onClick={() => edit({ kind: "rt", draft: newRt() })}
                disabled={!data.teams.length}
              >
                <Plus />
                New request type
              </Button>
            }
          />
          {data.requestTypes.length ? (
            <Card className="overflow-hidden">
              <ul className="divide-y divide-border">
                {data.requestTypes.map((rt) => (
                  <li key={rt.id}>
                    <RowButton onClick={() => edit({ kind: "rt", draft: rt })}>
                      <HelpIcon name={rt.icon} />
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="flex items-center gap-2">
                          <span className="truncate text-body font-medium text-fg">{rt.name}</span>
                          {!rt.active ? (
                            <Badge size="sm" tone="neutral">
                              Off
                            </Badge>
                          ) : null}
                        </span>
                        <span className="truncate text-small text-muted">
                          {teamName(rt.teamId)} · {rt.fields.length}{" "}
                          {rt.fields.length === 1 ? "field" : "fields"} ·{" "}
                          {APPROVAL_LABEL[rt.approval.mode]}
                        </span>
                      </span>
                      <span className="hidden items-center gap-1.5 text-small text-muted sm:inline-flex">
                        <Timer className="size-3.5 stroke-[1.5] text-subtle" aria-hidden />
                        {data.policies.find((p) => p.id === rt.slaPolicyId)?.name ?? "No targets"}
                      </span>
                      <ChevronRight
                        className="size-4 shrink-0 stroke-[1.5] text-subtle"
                        aria-hidden
                      />
                    </RowButton>
                  </li>
                ))}
              </ul>
            </Card>
          ) : (
            <EmptyState
              icon={<PackagePlus />}
              title="No request types yet"
              description="Start with fifteen common ones for IT, People, Workplace and Finance, then make them yours."
              action={
                <Button
                  loading={installing}
                  onClick={() =>
                    startInstall(async () => {
                      const r = await installStarterAction();
                      if (r.ok) toast.success("Starter catalog installed");
                      else toast.error(r.error);
                      router.refresh();
                    })
                  }
                >
                  Install the starter catalog
                </Button>
              }
            />
          )}
        </TabsContent>

        <TabsContent value="teams" className="pt-6">
          <SectionHead
            title="Teams"
            description="Who works which queue, during which hours."
            action={
              <Button
                onClick={() =>
                  edit({
                    kind: "team",
                    draft: {
                      slug: "",
                      name: "",
                      description: "",
                      icon: "life-buoy",
                      agentGroupId: null,
                      calendarId: data.calendars[0]?.id ?? null,
                      roundRobin: false,
                    },
                  })
                }
              >
                <Plus />
                New team
              </Button>
            }
          />
          <Card className="overflow-hidden">
            <ul className="divide-y divide-border">
              {data.teams.map((t) => (
                <li key={t.id}>
                  <RowButton
                    onClick={() => edit({ kind: "team", draft: t })}
                    className="items-center"
                  >
                    <HelpIcon name={t.icon} />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="text-body font-medium text-fg">{t.name}</span>
                      <span className="truncate text-small text-muted">
                        {groupName(t.agentGroupId)
                          ? `Worked by ${groupName(t.agentGroupId)}`
                          : "No agents yet"}
                        {" · "}
                        {data.calendars.find((c) => c.id === t.calendarId)?.name ??
                          "Around the clock"}
                        {t.roundRobin ? " · Round robin" : ""}
                      </span>
                    </span>
                    <span className="tabular hidden shrink-0 text-small text-muted sm:flex sm:gap-4">
                      <span>
                        {plural(
                          data.requestTypes.filter((r) => r.teamId === t.id).length,
                          "request type",
                        )}
                      </span>
                      <span>{plural(t.ticketCount, "request")}</span>
                    </span>
                    <ChevronRight
                      className="size-4 shrink-0 stroke-[1.5] text-subtle"
                      aria-hidden
                    />
                  </RowButton>
                </li>
              ))}
            </ul>
          </Card>
        </TabsContent>

        <TabsContent value="sla" className="pt-6">
          <SectionHead
            title="SLA policies"
            description="How fast the first reply and the fix should come, by priority. Counted in each team's working hours."
            action={
              <Button
                onClick={() =>
                  edit({
                    kind: "policy",
                    draft: {
                      name: "",
                      targets: {
                        urgent: { firstResponse: 30, resolution: 240 },
                        high: { firstResponse: 60, resolution: 510 },
                        normal: { firstResponse: 240, resolution: 1530 },
                        low: { firstResponse: 510, resolution: 2550 },
                      },
                    },
                  })
                }
              >
                <Plus />
                New policy
              </Button>
            }
          />
          <Card className="overflow-hidden">
            <ul className="divide-y divide-border">
              {data.policies.map((p) => (
                <li key={p.id}>
                  <RowButton
                    onClick={() => edit({ kind: "policy", draft: p })}
                    className="flex-col items-stretch gap-3 py-4 lg:flex-row lg:items-center lg:gap-6"
                  >
                    <span className="flex min-w-0 flex-col lg:w-56 lg:shrink-0">
                      <span className="text-body font-medium text-fg">{p.name}</span>
                      <span className="text-small text-muted">
                        {plural(
                          data.requestTypes.filter((r) => r.slaPolicyId === p.id).length,
                          "request type",
                        )}
                      </span>
                    </span>
                    <span
                      className="grid flex-1 grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4"
                      aria-label="Targets by priority"
                    >
                      {(["urgent", "high", "normal", "low"] as Priority[]).map((pr) => (
                        <span key={pr} className="flex min-w-0 flex-col gap-0.5">
                          <span className="text-caption capitalize text-subtle">{pr}</span>
                          <span className="tabular whitespace-nowrap text-small text-fg">
                            {formatMinutes(p.targets[pr].firstResponse)}{" "}
                            <span className="text-subtle">reply</span>
                          </span>
                          <span className="tabular whitespace-nowrap text-small text-fg">
                            {formatMinutes(p.targets[pr].resolution)}{" "}
                            <span className="text-subtle">fix</span>
                          </span>
                        </span>
                      ))}
                    </span>
                    <ChevronRight
                      className="hidden size-4 shrink-0 stroke-[1.5] text-subtle lg:block"
                      aria-hidden
                    />
                  </RowButton>
                </li>
              ))}
            </ul>
          </Card>
        </TabsContent>

        <TabsContent value="calendars" className="pt-6">
          <SectionHead
            title="Business hours"
            description="When each team is working. SLA clocks only run inside these hours, and skip holidays."
            action={
              <Button
                onClick={() =>
                  edit({
                    kind: "calendar",
                    draft: {
                      name: "",
                      timezone: "Europe/London",
                      workDays: [1, 2, 3, 4, 5],
                      startMinute: 540,
                      endMinute: 1050,
                      holidays: [],
                    },
                  })
                }
              >
                <Plus />
                New calendar
              </Button>
            }
          />
          <Card className="overflow-hidden">
            <ul className="divide-y divide-border">
              {data.calendars.map((c) => (
                <li key={c.id}>
                  <RowButton onClick={() => edit({ kind: "calendar", draft: c })}>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="text-body font-medium text-fg">{c.name}</span>
                      <span className="text-small text-muted">
                        {c.timezone} · {c.workDays.map((d) => DAY[d]).join(", ")} ·{" "}
                        {c.startMinute === 0 && c.endMinute === 1440
                          ? "All day"
                          : `${hhmm(c.startMinute)} to ${hhmm(c.endMinute)}`}
                        {c.holidays.length ? ` · ${c.holidays.length} holidays` : ""}
                      </span>
                    </span>
                    <ChevronRight
                      className="size-4 shrink-0 stroke-[1.5] text-subtle"
                      aria-hidden
                    />
                  </RowButton>
                </li>
              ))}
            </ul>
          </Card>
        </TabsContent>

        <TabsContent value="canned" className="pt-6">
          <SectionHead
            title="Canned replies"
            description="Answers agents give often, one click away in the reply box."
            action={
              <Button
                onClick={() =>
                  edit({ kind: "canned", draft: { teamId: null, title: "", body: "" } })
                }
              >
                <Plus />
                New reply
              </Button>
            }
          />
          {data.canned.length ? (
            <Card className="overflow-hidden">
              <ul className="divide-y divide-border">
                {data.canned.map((c) => (
                  <li key={c.id}>
                    <RowButton onClick={() => edit({ kind: "canned", draft: c })}>
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="text-body font-medium text-fg">{c.title}</span>
                        <span className="truncate text-small text-muted">{c.body}</span>
                      </span>
                      <Badge size="sm" tone="neutral" className="hidden sm:inline-flex">
                        {teamName(c.teamId)}
                      </Badge>
                      <ChevronRight
                        className="size-4 shrink-0 stroke-[1.5] text-subtle"
                        aria-hidden
                      />
                    </RowButton>
                  </li>
                ))}
              </ul>
            </Card>
          ) : (
            <EmptyState
              compact
              icon={<MessageSquareText />}
              title="No canned replies"
              description="Save the answers your team types every week."
            />
          )}
        </TabsContent>

        <TabsContent value="connectors" className="pt-6">
          <SectionHead
            title="Connectors"
            description="Already run Jira Service Management, or another tool? Lobby can raise every request there too and follow its status."
            action={
              <Button
                onClick={() =>
                  edit({
                    kind: "connector",
                    draft: {
                      kind: "jira_sm",
                      name: "",
                      enabled: true,
                      requestTypeIds: [],
                      config: {},
                    },
                  })
                }
              >
                <Plus />
                New connector
              </Button>
            }
          />
          {data.connectors.length ? (
            <Card className="overflow-hidden">
              <ul className="divide-y divide-border">
                {data.connectors.map((c) => (
                  <li
                    key={c.id}
                    className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center"
                  >
                    <button
                      type="button"
                      onClick={() => edit({ kind: "connector", draft: c })}
                      className="focus-ring flex min-w-0 flex-1 items-center gap-3 rounded-control text-left"
                    >
                      <PlugZap className="size-4 shrink-0 stroke-[1.5] text-muted" aria-hidden />
                      <span className="flex min-w-0 flex-col">
                        <span className="flex items-center gap-2">
                          <span className="truncate text-body font-medium text-fg">{c.name}</span>
                          <Badge size="sm" tone={c.enabled ? "success" : "neutral"} dot>
                            {c.enabled ? "On" : "Off"}
                          </Badge>
                        </span>
                        <span className="truncate text-small text-muted">
                          {c.kind === "jira_sm"
                            ? `Jira Service Management · ${String(c.config.baseUrl ?? "")}`
                            : `Webhook · ${String(c.config.url ?? "")}`}{" "}
                          ·{" "}
                          {c.requestTypeIds.length
                            ? `${c.requestTypeIds.length} request ${c.requestTypeIds.length === 1 ? "type" : "types"}`
                            : "every request type"}{" "}
                          · {c.linkedTickets} linked
                        </span>
                      </span>
                    </button>
                    <Button
                      variant="secondary"
                      size="sm"
                      loading={testing === c.id}
                      onClick={() => test(c.id)}
                      className="self-start sm:self-center"
                    >
                      Test connection
                    </Button>
                  </li>
                ))}
              </ul>
            </Card>
          ) : (
            <EmptyState
              compact
              icon={<PlugZap />}
              title="No connectors"
              description="Lobby's own helpdesk works without one. Add a connector to mirror requests into Jira Service Management or post them to a webhook."
            />
          )}
        </TabsContent>
      </Tabs>

      {editing?.kind === "rt" ? (
        <RequestTypeEditor
          key={editing.key}
          draft={editing.draft}
          open={open}
          onOpenChange={setOpen}
          teams={data.teams}
          groups={data.groups}
          policies={data.policies}
        />
      ) : null}
      {editing?.kind === "team" ? (
        <TeamEditor
          key={editing.key}
          draft={editing.draft}
          open={open}
          onOpenChange={setOpen}
          groups={data.groups}
          calendars={data.calendars}
        />
      ) : null}
      {editing?.kind === "policy" ? (
        <PolicyEditor key={editing.key} draft={editing.draft} open={open} onOpenChange={setOpen} />
      ) : null}
      {editing?.kind === "calendar" ? (
        <CalendarEditor
          key={editing.key}
          draft={editing.draft}
          open={open}
          onOpenChange={setOpen}
        />
      ) : null}
      {editing?.kind === "canned" ? (
        <CannedEditor
          key={editing.key}
          draft={editing.draft}
          open={open}
          onOpenChange={setOpen}
          teams={data.teams}
        />
      ) : null}
      {editing?.kind === "connector" ? (
        <ConnectorEditor
          key={editing.key}
          draft={editing.draft}
          open={open}
          onOpenChange={setOpen}
          requestTypes={data.requestTypes}
          origin={origin}
        />
      ) : null}
    </>
  );
}

export type { FormFieldDef };
