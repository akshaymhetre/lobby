"use client";

import * as React from "react";
import { Copy } from "lucide-react";
import { formatMinutes } from "@lobby/core/helpdesk/sla";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import {
  deleteCalendarAction,
  deleteCannedReplyAction,
  deleteConnectorAction,
  deleteSlaPolicyAction,
  deleteTeamAction,
  saveCalendarAction,
  saveCannedReplyAction,
  saveConnectorAction,
  saveSlaPolicyAction,
  saveTeamAction,
} from "@/app/(app)/admin/helpdesk/_actions";
import { IconPicker } from "./request-type-editor";
import { EditorSheet, slugify, useAdminAction } from "./shared";

const NONE = "__none";

/** Editors are remounted (keyed) per draft by the console, so local state starts from the draft. */
function useDraft<T>(draft: T) {
  const [v, setV] = React.useState<T>(draft);
  return [v, setV] as const;
}

// ---------------------------------------------------------------------------------------------

export interface TeamDraft {
  id?: string;
  slug: string;
  name: string;
  description: string;
  icon: string;
  agentGroupId: string | null;
  calendarId: string | null;
  roundRobin: boolean;
}

export function TeamEditor({
  draft,
  open,
  onOpenChange,
  groups,
  calendars,
}: {
  draft: TeamDraft;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  groups: { id: string; displayName: string }[];
  calendars: { id: string; name: string }[];
}) {
  const [v, setV] = useDraft(draft);
  const { pending, errors, formError, run } = useAdminAction();
  return (
    <EditorSheet
      open={open}
      onOpenChange={onOpenChange}
      title={v.id ? `Edit ${draft.name}` : "New team"}
      description="A team owns request types and works their queue."
      onSave={() =>
        run(
          () => saveTeamAction({ ...v, agentGroupId: v.agentGroupId, calendarId: v.calendarId }),
          () => onOpenChange(false),
        )
      }
      onDelete={
        v.id
          ? () =>
              run(
                () => deleteTeamAction(v.id!),
                () => onOpenChange(false),
              )
          : undefined
      }
      pending={pending}
      formError={formError}
    >
      <Field label="Name" required error={errors.name}>
        <Input
          value={v.name}
          onChange={(e) =>
            setV((p) => ({
              ...p,
              name: e.target.value,
              slug: p.id ? p.slug : slugify(e.target.value),
            }))
          }
        />
      </Field>
      <Field label="Slug" required error={errors.slug}>
        <Input value={v.slug} onChange={(e) => setV((p) => ({ ...p, slug: e.target.value }))} />
      </Field>
      <Field label="Description" help="Shown above the team's request types in Help.">
        <Textarea
          rows={2}
          value={v.description}
          onChange={(e) => setV((p) => ({ ...p, description: e.target.value }))}
        />
      </Field>
      <div className="flex flex-col gap-1.5">
        <span className="text-small font-medium text-fg">Icon</span>
        <IconPicker value={v.icon} onChange={(icon) => setV((p) => ({ ...p, icon }))} />
      </div>
      <Field
        label="Agents"
        controlId="team-group"
        help="Members of this group work the queue and get its notifications."
      >
        <Select
          value={v.agentGroupId ?? NONE}
          onValueChange={(g) => setV((p) => ({ ...p, agentGroupId: g === NONE ? null : g }))}
        >
          <SelectTrigger id="team-group">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>No group yet</SelectItem>
            {groups.map((g) => (
              <SelectItem key={g.id} value={g.id}>
                {g.displayName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field
        label="Business hours"
        controlId="team-cal"
        help="SLA targets only count time inside these hours."
      >
        <Select
          value={v.calendarId ?? NONE}
          onValueChange={(c) => setV((p) => ({ ...p, calendarId: c === NONE ? null : c }))}
        >
          <SelectTrigger id="team-cal">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>Around the clock</SelectItem>
            {calendars.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <label className="flex items-start gap-3">
        <Switch
          checked={v.roundRobin}
          onCheckedChange={(roundRobin) => setV((p) => ({ ...p, roundRobin }))}
          className="mt-0.5"
        />
        <span className="flex flex-col">
          <span className="text-body text-fg">Assign new requests in turn</span>
          <span className="text-small text-muted">
            Round robin across the agents, so nothing waits unowned.
          </span>
        </span>
      </label>
    </EditorSheet>
  );
}

// ---------------------------------------------------------------------------------------------

type Targets = Record<
  "urgent" | "high" | "normal" | "low",
  { firstResponse: number; resolution: number }
>;
export interface PolicyDraft {
  id?: string;
  name: string;
  targets: Targets;
}

export function PolicyEditor({
  draft,
  open,
  onOpenChange,
}: {
  draft: PolicyDraft;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const [v, setV] = useDraft(draft);
  const { pending, errors, formError, run } = useAdminAction();
  const set = (p: keyof Targets, k: "firstResponse" | "resolution", n: number) =>
    setV((d) => ({ ...d, targets: { ...d.targets, [p]: { ...d.targets[p], [k]: n } } }));
  return (
    <EditorSheet
      open={open}
      onOpenChange={onOpenChange}
      title={v.id ? `Edit ${draft.name}` : "New SLA policy"}
      description="Targets in working minutes. The team's business hours decide which minutes count."
      onSave={() =>
        run(
          () => saveSlaPolicyAction(v),
          () => onOpenChange(false),
        )
      }
      onDelete={
        v.id
          ? () =>
              run(
                () => deleteSlaPolicyAction(v.id!),
                () => onOpenChange(false),
              )
          : undefined
      }
      pending={pending}
      formError={formError}
    >
      <Field label="Name" required error={errors.name}>
        <Input value={v.name} onChange={(e) => setV((p) => ({ ...p, name: e.target.value }))} />
      </Field>
      <div className="overflow-hidden rounded-card bg-sunken/50 dark:bg-raised/30">
        <div className="grid grid-cols-[80px_1fr_1fr] gap-3 px-3 py-2 text-caption font-medium text-muted">
          <span>Priority</span>
          <span>First reply</span>
          <span>Resolution</span>
        </div>
        {(["urgent", "high", "normal", "low"] as const).map((p) => (
          <div
            key={p}
            className="grid grid-cols-[80px_1fr_1fr] items-start gap-3 border-t border-border px-3 py-2.5"
          >
            <span className="pt-2 text-small font-medium capitalize text-fg">{p}</span>
            {(["firstResponse", "resolution"] as const).map((k) => (
              <div key={k} className="flex flex-col gap-1">
                <Input
                  type="number"
                  min={1}
                  inputMode="numeric"
                  aria-label={`${p} ${k === "firstResponse" ? "first reply" : "resolution"} minutes`}
                  aria-invalid={errors[`targets.${p}.${k}`] ? true : undefined}
                  value={v.targets[p][k]}
                  onChange={(e) => set(p, k, Number(e.target.value))}
                  trailing={<span className="text-caption">min</span>}
                />
                <span className="tabular text-caption text-subtle">
                  {v.targets[p][k] > 0 ? formatMinutes(v.targets[p][k]) : " "}
                </span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </EditorSheet>
  );
}

// ---------------------------------------------------------------------------------------------

export interface CalendarDraft {
  id?: string;
  name: string;
  timezone: string;
  workDays: number[];
  startMinute: number;
  endMinute: number;
  holidays: string[];
}

const DAYS = [
  [1, "Mon"],
  [2, "Tue"],
  [3, "Wed"],
  [4, "Thu"],
  [5, "Fri"],
  [6, "Sat"],
  [7, "Sun"],
] as const;
const toTime = (m: number) =>
  `${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
const fromTime = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
};

export function CalendarEditor({
  draft,
  open,
  onOpenChange,
}: {
  draft: CalendarDraft;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const [v, setV] = useDraft(draft);
  const [holidays, setHolidays] = useDraft(draft.holidays.join("\n"));
  const { pending, errors, formError, run } = useAdminAction();
  const zones = React.useMemo(() => {
    try {
      return (
        (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf?.(
          "timeZone",
        ) ?? []
      );
    } catch {
      return [];
    }
  }, []);
  return (
    <EditorSheet
      open={open}
      onOpenChange={onOpenChange}
      title={v.id ? `Edit ${draft.name}` : "New business calendar"}
      description="When the team is working. SLA clocks pause outside these hours."
      onSave={() =>
        run(
          () =>
            saveCalendarAction({
              ...v,
              endMinute: v.endMinute === 0 ? 1440 : v.endMinute,
              holidays: holidays
                .split(/[\s,]+/)
                .map((h) => h.trim())
                .filter(Boolean),
            }),
          () => onOpenChange(false),
        )
      }
      onDelete={
        v.id
          ? () =>
              run(
                () => deleteCalendarAction(v.id!),
                () => onOpenChange(false),
              )
          : undefined
      }
      pending={pending}
      formError={formError}
    >
      <Field label="Name" required error={errors.name}>
        <Input value={v.name} onChange={(e) => setV((p) => ({ ...p, name: e.target.value }))} />
      </Field>
      <Field
        label="Timezone"
        required
        error={errors.timezone}
        help="An IANA name, like Europe/London."
      >
        <Input
          list="hd-timezones"
          value={v.timezone}
          onChange={(e) => setV((p) => ({ ...p, timezone: e.target.value }))}
        />
      </Field>
      <datalist id="hd-timezones">
        {zones.map((z) => (
          <option key={z} value={z} />
        ))}
      </datalist>
      <fieldset className="flex flex-col gap-1.5">
        <legend className="pb-1.5 text-small font-medium text-fg">Working days</legend>
        <div className="flex flex-wrap gap-1.5">
          {DAYS.map(([d, label]) => {
            const on = v.workDays.includes(d);
            return (
              <button
                key={d}
                type="button"
                aria-pressed={on}
                onClick={() =>
                  setV((p) => ({
                    ...p,
                    workDays: on ? p.workDays.filter((x) => x !== d) : [...p.workDays, d].sort(),
                  }))
                }
                className={cn(
                  "focus-ring touch-target press inline-flex h-9 w-12 items-center justify-center rounded-full text-small font-medium",
                  on
                    ? "bg-accent-soft text-accent-text shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--lb-accent)_30%,transparent)]"
                    : "cell text-muted hover:text-fg",
                )}
              >
                {label}
              </button>
            );
          })}
        </div>
        {errors.workDays ? <p className="text-small text-danger-text">{errors.workDays}</p> : null}
      </fieldset>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Opens at" error={errors.startMinute}>
          <Input
            type="time"
            value={toTime(v.startMinute)}
            onChange={(e) => setV((p) => ({ ...p, startMinute: fromTime(e.target.value) }))}
          />
        </Field>
        <Field
          label="Closes at"
          error={errors.endMinute}
          help={
            v.endMinute <= v.startMinute && v.endMinute !== 0
              ? "Earlier than opening: the shift runs overnight."
              : undefined
          }
        >
          <Input
            type="time"
            value={toTime(v.endMinute)}
            onChange={(e) => setV((p) => ({ ...p, endMinute: fromTime(e.target.value) }))}
          />
        </Field>
      </div>
      <Field label="Holidays" error={errors.holidays} help="One date per line, like 2026-12-25.">
        <Textarea
          rows={5}
          value={holidays}
          onChange={(e) => setHolidays(e.target.value)}
          className="tabular"
        />
      </Field>
    </EditorSheet>
  );
}

// ---------------------------------------------------------------------------------------------

export interface CannedDraft {
  id?: string;
  teamId: string | null;
  title: string;
  body: string;
}

export function CannedEditor({
  draft,
  open,
  onOpenChange,
  teams,
}: {
  draft: CannedDraft;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  teams: { id: string; name: string }[];
}) {
  const [v, setV] = useDraft(draft);
  const { pending, errors, formError, run } = useAdminAction();
  return (
    <EditorSheet
      open={open}
      onOpenChange={onOpenChange}
      title={v.id ? "Edit canned reply" : "New canned reply"}
      description="Saved replies agents can drop into a response."
      onSave={() =>
        run(
          () => saveCannedReplyAction(v),
          () => onOpenChange(false),
        )
      }
      onDelete={
        v.id
          ? () =>
              run(
                () => deleteCannedReplyAction(v.id!),
                () => onOpenChange(false),
              )
          : undefined
      }
      pending={pending}
      formError={formError}
    >
      <Field label="Title" required error={errors.title}>
        <Input value={v.title} onChange={(e) => setV((p) => ({ ...p, title: e.target.value }))} />
      </Field>
      <Field label="Available to" controlId="canned-team">
        <Select
          value={v.teamId ?? NONE}
          onValueChange={(t) => setV((p) => ({ ...p, teamId: t === NONE ? null : t }))}
        >
          <SelectTrigger id="canned-team">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>Every team</SelectItem>
            {teams.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field label="Reply" required error={errors.body}>
        <Textarea
          rows={8}
          value={v.body}
          onChange={(e) => setV((p) => ({ ...p, body: e.target.value }))}
        />
      </Field>
    </EditorSheet>
  );
}

// ---------------------------------------------------------------------------------------------

export interface ConnectorDraft {
  id?: string;
  kind: "jira_sm" | "webhook";
  name: string;
  enabled: boolean;
  requestTypeIds: string[];
  config: Record<string, unknown>;
}

export function ConnectorEditor({
  draft,
  open,
  onOpenChange,
  requestTypes,
  origin,
}: {
  draft: ConnectorDraft;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  requestTypes: { id: string; name: string }[];
  origin: string;
}) {
  const [v, setV] = useDraft(draft);
  const { pending, errors, formError, run } = useAdminAction();
  const c = v.config;
  const setC = (k: string, val: unknown) =>
    setV((p) => ({ ...p, config: { ...p.config, [k]: val } }));
  const str = (k: string) => (typeof c[k] === "string" ? (c[k] as string) : "");
  const err = (k: string) => errors[`config.${k}`];
  const secretHelp = (k: string) => (c[`${k}Set`] ? "Saved. Leave blank to keep it." : undefined);
  const inbound = v.id ? `${origin}/api/webhooks/jira-sm/${v.id}` : null;

  const save = () => {
    const config =
      v.kind === "jira_sm"
        ? {
            baseUrl: str("baseUrl"),
            email: str("email"),
            apiToken: str("apiToken"),
            serviceDeskId: str("serviceDeskId"),
            requestTypeId: str("requestTypeId"),
            raiseOnBehalfOf: c.raiseOnBehalfOf === true,
            webhookSecret: str("webhookSecret"),
          }
        : { url: str("url"), secret: str("secret") };
    run(
      () =>
        saveConnectorAction({
          id: v.id,
          kind: v.kind,
          name: v.name,
          enabled: v.enabled,
          requestTypeIds: v.requestTypeIds,
          config,
        } as Parameters<typeof saveConnectorAction>[0]),
      () => onOpenChange(false),
    );
  };

  return (
    <EditorSheet
      open={open}
      onOpenChange={onOpenChange}
      title={v.id ? `Edit ${draft.name}` : "New connector"}
      description="Send requests to another ticketing system and keep their status in sync."
      onSave={save}
      onDelete={
        v.id
          ? () =>
              run(
                () => deleteConnectorAction(v.id!),
                () => onOpenChange(false),
              )
          : undefined
      }
      pending={pending}
      formError={formError}
      wide
    >
      {!v.id ? (
        <Field label="Kind" controlId="conn-kind">
          <Select
            value={v.kind}
            onValueChange={(k) =>
              setV((p) => ({ ...p, kind: k as ConnectorDraft["kind"], config: {} }))
            }
          >
            <SelectTrigger id="conn-kind">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="jira_sm">Jira Service Management</SelectItem>
              <SelectItem value="webhook">Outbound webhook (signed JSON)</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      ) : null}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
        <Field label="Name" required error={errors.name}>
          <Input
            value={v.name}
            onChange={(e) => setV((p) => ({ ...p, name: e.target.value }))}
            placeholder={v.kind === "jira_sm" ? "IT service desk" : "Ops webhook"}
          />
        </Field>
        <label className="inline-flex items-center gap-2.5 pb-2 text-body text-fg">
          <Switch
            checked={v.enabled}
            onCheckedChange={(enabled) => setV((p) => ({ ...p, enabled }))}
          />
          On
        </label>
      </div>

      {v.kind === "jira_sm" ? (
        <>
          <Field label="Jira site URL" required error={err("baseUrl")}>
            <Input
              value={str("baseUrl")}
              onChange={(e) => setC("baseUrl", e.target.value)}
              placeholder="https://your-site.atlassian.net"
            />
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Account email" required error={err("email")}>
              <Input
                type="email"
                value={str("email")}
                onChange={(e) => setC("email", e.target.value)}
              />
            </Field>
            <Field
              label="API token"
              required={!c.apiTokenSet}
              error={err("apiToken")}
              help={secretHelp("apiToken") ?? "Stored encrypted."}
            >
              <Input
                type="password"
                autoComplete="new-password"
                value={str("apiToken")}
                onChange={(e) => setC("apiToken", e.target.value)}
              />
            </Field>
            <Field label="Service desk id" required error={err("serviceDeskId")}>
              <Input
                inputMode="numeric"
                value={str("serviceDeskId")}
                onChange={(e) => setC("serviceDeskId", e.target.value)}
              />
            </Field>
            <Field label="Jira request type id" required error={err("requestTypeId")}>
              <Input
                inputMode="numeric"
                value={str("requestTypeId")}
                onChange={(e) => setC("requestTypeId", e.target.value)}
              />
            </Field>
          </div>
          <label className="flex items-start gap-2.5">
            <Checkbox
              checked={c.raiseOnBehalfOf === true}
              onCheckedChange={(x) => setC("raiseOnBehalfOf", x === true)}
              className="mt-0.5"
            />
            <span className="flex flex-col">
              <span className="text-body text-fg">Raise as the requester</span>
              <span className="text-small text-muted">
                Each requester must already exist as a customer in Jira.
              </span>
            </span>
          </label>
          <div className="flex flex-col gap-3 rounded-card bg-sunken/50 p-4 dark:bg-raised/30">
            <div>
              <h3 className="text-body font-medium text-fg">Status updates from Jira</h3>
              <p className="text-small text-muted">
                Add a Jira webhook or automation rule that posts here when a request changes status.
              </p>
            </div>
            <Field
              label="Shared secret"
              error={err("webhookSecret")}
              help={
                secretHelp("webhookSecret") ??
                "Jira sends it as ?secret= or an X-Lobby-Webhook-Secret header."
              }
            >
              <Input
                type="password"
                autoComplete="new-password"
                value={str("webhookSecret")}
                onChange={(e) => setC("webhookSecret", e.target.value)}
              />
            </Field>
            {inbound ? (
              <div className="flex flex-col gap-1.5">
                <span className="text-small font-medium text-fg">Webhook URL</span>
                <div className="flex items-center gap-2">
                  <code className="min-w-0 flex-1 truncate rounded-control bg-raised px-2.5 py-2 font-mono text-small text-fg shadow-inset dark:bg-sunken">
                    {inbound}
                  </code>
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon"
                    aria-label="Copy webhook URL"
                    onClick={() => {
                      void navigator.clipboard?.writeText(inbound);
                      toast.success("Webhook URL copied");
                    }}
                  >
                    <Copy />
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-small text-muted">Save the connector to get its webhook URL.</p>
            )}
          </div>
        </>
      ) : (
        <>
          <Field label="Endpoint URL" required error={err("url")}>
            <Input
              value={str("url")}
              onChange={(e) => setC("url", e.target.value)}
              placeholder="https://ops.example.com/hooks/lobby"
            />
          </Field>
          <Field
            label="Signing secret"
            required={!c.secretSet}
            error={err("secret")}
            help={
              secretHelp("secret") ?? "We sign each body with HMAC-SHA256 in X-Lobby-Signature."
            }
          >
            <Input
              type="password"
              autoComplete="new-password"
              value={str("secret")}
              onChange={(e) => setC("secret", e.target.value)}
            />
          </Field>
        </>
      )}

      <fieldset className="flex flex-col gap-2">
        <legend className="pb-1 text-small font-medium text-fg">Which requests</legend>
        <label className="inline-flex items-center gap-2.5 text-body text-fg">
          <Checkbox
            checked={v.requestTypeIds.length === 0}
            onCheckedChange={(x) => x === true && setV((p) => ({ ...p, requestTypeIds: [] }))}
          />
          Every request type
        </label>
        <div className="grid grid-cols-1 gap-x-4 gap-y-1.5 rounded-card bg-sunken/50 p-3 dark:bg-raised/30 sm:grid-cols-2">
          {requestTypes.map((rt) => {
            const on = v.requestTypeIds.includes(rt.id);
            return (
              <label key={rt.id} className="inline-flex items-center gap-2.5 text-small text-fg">
                <Checkbox
                  checked={on}
                  onCheckedChange={() =>
                    setV((p) => ({
                      ...p,
                      requestTypeIds: on
                        ? p.requestTypeIds.filter((x) => x !== rt.id)
                        : [...p.requestTypeIds, rt.id],
                    }))
                  }
                />
                {rt.name}
              </label>
            );
          })}
        </div>
      </fieldset>
    </EditorSheet>
  );
}
