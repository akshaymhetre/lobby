"use client";

import * as React from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { FIELD_TYPES, fieldKeyFromLabel, type FormFieldDef } from "@lobby/core/helpdesk/fields";
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
import { cn } from "@/lib/cn";
import {
  deleteRequestTypeAction,
  saveRequestTypeAction,
} from "@/app/(app)/admin/helpdesk/_actions";
import { HELPDESK_ICONS, ICON_NAMES } from "../icons";
import { PRIORITY_OPTIONS, type Priority } from "../status";
import { EditorSheet, slugify, useAdminAction } from "./shared";

export interface RequestTypeDraft {
  id?: string;
  slug: string;
  teamId: string;
  name: string;
  description: string;
  icon: string;
  fields: FormFieldDef[];
  approval: { mode: "none" | "manager" | "group" | "manager_then_group"; groupId?: string };
  slaPolicyId: string | null;
  defaultPriority: Priority;
  active: boolean;
}

const NONE = "__none";
const NEW_PREFIX = "new_field_";
const APPROVAL_MODES = [
  { value: "none", label: "No approval" },
  { value: "manager", label: "The requester's manager" },
  { value: "group", label: "A group" },
  { value: "manager_then_group", label: "Manager, then a group" },
] as const;

export function IconPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div role="radiogroup" aria-label="Icon" className="grid grid-cols-8 gap-1.5 sm:grid-cols-10">
      {ICON_NAMES.map((name) => {
        const Icon = HELPDESK_ICONS[name]!;
        const on = value === name;
        return (
          <button
            key={name}
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={name.replace(/-/g, " ")}
            onClick={() => onChange(name)}
            className={cn(
              "focus-ring touch-target press inline-flex size-9 items-center justify-center rounded-full",
              on
                ? "bg-accent-soft text-accent-text shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--lb-accent)_30%,transparent)]"
                : "cell text-muted hover:text-fg",
            )}
          >
            <Icon className="size-4 stroke-[1.5]" aria-hidden />
          </button>
        );
      })}
    </div>
  );
}

function FieldCard({
  f,
  i,
  count,
  others,
  onChange,
  onMove,
  onRemove,
}: {
  f: FormFieldDef;
  i: number;
  count: number;
  others: FormFieldDef[];
  onChange: (f: FormFieldDef) => void;
  onMove: (dir: -1 | 1) => void;
  onRemove: () => void;
}) {
  const parent = others.find((o) => o.key === f.showIf?.key);
  return (
    <li className="flex flex-col gap-3 rounded-card bg-sunken/50 p-3 dark:bg-raised/30">
      <div className="flex items-start gap-2">
        <span className="tabular mt-2 w-5 shrink-0 text-caption text-subtle">{i + 1}</span>
        <div className="grid min-w-0 flex-1 grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_150px]">
          <Input
            aria-label={`Field ${i + 1} label`}
            value={f.label}
            placeholder="Label, like Needed by"
            onChange={(e) => onChange({ ...f, label: e.target.value })}
          />
          <Select
            value={f.type}
            onValueChange={(t) =>
              onChange({
                ...f,
                type: t as FormFieldDef["type"],
                options: t === "select" ? (f.options ?? ["Option one"]) : undefined,
              })
            }
          >
            <SelectTrigger aria-label={`Field ${i + 1} type`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FIELD_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex shrink-0 items-center">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Move up"
            disabled={i === 0}
            onClick={() => onMove(-1)}
          >
            <ArrowUp />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Move down"
            disabled={i === count - 1}
            onClick={() => onMove(1)}
          >
            <ArrowDown />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={`Remove ${f.label || "field"}`}
            onClick={onRemove}
          >
            <Trash2 />
          </Button>
        </div>
      </div>
      <div className="flex flex-col gap-3 pl-7">
        {f.type === "select" ? (
          <Textarea
            aria-label="Options, one per line"
            rows={3}
            value={(f.options ?? []).join("\n")}
            onChange={(e) => onChange({ ...f, options: e.target.value.split("\n") })}
            placeholder="One option per line"
          />
        ) : null}
        <Input
          aria-label="Help text"
          value={f.help ?? ""}
          placeholder="Help text (optional)"
          onChange={(e) => onChange({ ...f, help: e.target.value || undefined })}
        />
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <label className="inline-flex items-center gap-2 text-small text-fg">
            <Checkbox
              checked={!!f.required}
              onCheckedChange={(c) => onChange({ ...f, required: c === true || undefined })}
            />
            Required
          </label>
          <div className="flex min-w-0 flex-wrap items-center gap-2 text-small text-muted">
            <span>Show only when</span>
            <Select
              value={f.showIf?.key ?? NONE}
              onValueChange={(k) => {
                if (k === NONE) return onChange({ ...f, showIf: undefined });
                const p = others.find((o) => o.key === k);
                onChange({
                  ...f,
                  showIf: {
                    key: k,
                    equals: p?.type === "checkbox" ? true : (p?.options?.[0] ?? ""),
                  },
                });
              }}
            >
              <SelectTrigger className="h-8 w-[160px] md:h-8" aria-label="Condition field">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Always shown</SelectItem>
                {others
                  .filter((o) => o.type === "checkbox" || o.type === "select")
                  .map((o) => (
                    <SelectItem key={o.key} value={o.key}>
                      {o.label || o.key}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            {parent && parent.type === "select" ? (
              <>
                <span>is</span>
                <Select
                  value={String(f.showIf?.equals ?? "")}
                  onValueChange={(v) => onChange({ ...f, showIf: { key: parent.key, equals: v } })}
                >
                  <SelectTrigger className="h-8 w-[160px] md:h-8" aria-label="Condition value">
                    <SelectValue placeholder="Choose" />
                  </SelectTrigger>
                  <SelectContent>
                    {(parent.options ?? []).filter(Boolean).map((o) => (
                      <SelectItem key={o} value={o}>
                        {o}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </>
            ) : parent ? (
              <span>is ticked</span>
            ) : null}
          </div>
        </div>
      </div>
    </li>
  );
}

export function RequestTypeEditor({
  draft,
  open,
  onOpenChange,
  teams,
  groups,
  policies,
}: {
  draft: RequestTypeDraft;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  teams: { id: string; name: string }[];
  groups: { id: string; displayName: string }[];
  policies: { id: string; name: string }[];
}) {
  const [v, setV] = React.useState<RequestTypeDraft>(draft);
  const [slugTouched, setSlugTouched] = React.useState(!!draft.id);
  const { pending, errors, formError, run } = useAdminAction();

  const setField = (i: number, f: FormFieldDef) =>
    setV((p) => ({ ...p, fields: p.fields.map((x, j) => (j === i ? f : x)) }));
  const move = (i: number, dir: -1 | 1) =>
    setV((p) => {
      const fields = [...p.fields];
      const [x] = fields.splice(i, 1);
      fields.splice(i + dir, 0, x!);
      return { ...p, fields };
    });
  const addField = () =>
    setV((p) => ({
      ...p,
      fields: [
        ...p.fields,
        { key: `${NEW_PREFIX}${Math.random().toString(36).slice(2, 8)}`, label: "", type: "text" },
      ],
    }));
  const needsGroup = v.approval.mode === "group" || v.approval.mode === "manager_then_group";

  const save = () => {
    // New fields get a key from their label on save; saved keys never change, because stored answers use them.
    const rename = new Map(
      v.fields
        .filter((f) => f.key.startsWith(NEW_PREFIX))
        .map((f) => [f.key, fieldKeyFromLabel(f.label)]),
    );
    const fields = v.fields.map((f) => ({
      ...f,
      key: rename.get(f.key) ?? f.key,
      options:
        f.type === "select" ? (f.options ?? []).map((o) => o.trim()).filter(Boolean) : undefined,
      showIf: f.showIf ? { ...f.showIf, key: rename.get(f.showIf.key) ?? f.showIf.key } : undefined,
    }));
    run(
      () => saveRequestTypeAction({ ...v, fields }),
      () => onOpenChange(false),
    );
  };

  return (
    <EditorSheet
      open={open}
      onOpenChange={onOpenChange}
      title={v.id ? `Edit ${draft.name}` : "New request type"}
      description="What people can ask for, who handles it, and what the form asks."
      onSave={save}
      onDelete={
        v.id
          ? () =>
              run(
                () => deleteRequestTypeAction(v.id!),
                () => onOpenChange(false),
              )
          : undefined
      }
      pending={pending}
      formError={formError}
      wide
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Name" required error={errors.name}>
          <Input
            value={v.name}
            onChange={(e) =>
              setV((p) => ({
                ...p,
                name: e.target.value,
                slug: slugTouched ? p.slug : slugify(e.target.value),
              }))
            }
          />
        </Field>
        <Field label="Slug" required error={errors.slug} help="Used in links: /help/new?type=slug">
          <Input
            value={v.slug}
            onChange={(e) => {
              setSlugTouched(true);
              setV((p) => ({ ...p, slug: e.target.value }));
            }}
          />
        </Field>
      </div>
      <Field label="Description" error={errors.description} help="One line on the catalog card.">
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
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Team" required controlId="rt-team" error={errors.teamId}>
          <Select value={v.teamId} onValueChange={(teamId) => setV((p) => ({ ...p, teamId }))}>
            <SelectTrigger id="rt-team">
              <SelectValue placeholder="Choose a team" />
            </SelectTrigger>
            <SelectContent>
              {teams.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Default priority" controlId="rt-priority">
          <Select
            value={v.defaultPriority}
            onValueChange={(d) => setV((p) => ({ ...p, defaultPriority: d as Priority }))}
          >
            <SelectTrigger id="rt-priority">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PRIORITY_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Approval" controlId="rt-approval">
          <Select
            value={v.approval.mode}
            onValueChange={(mode) =>
              setV((p) => ({
                ...p,
                approval: { ...p.approval, mode: mode as RequestTypeDraft["approval"]["mode"] },
              }))
            }
          >
            <SelectTrigger id="rt-approval">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {APPROVAL_MODES.map((m) => (
                <SelectItem key={m.value} value={m.value}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        {needsGroup ? (
          <Field
            label="Approving group"
            controlId="rt-group"
            error={errors["approval.groupId"]}
            help="Leave as the team's agents to use the team."
          >
            <Select
              value={v.approval.groupId ?? NONE}
              onValueChange={(g) =>
                setV((p) => ({
                  ...p,
                  approval: { ...p.approval, groupId: g === NONE ? undefined : g },
                }))
              }
            >
              <SelectTrigger id="rt-group">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>The team&apos;s agents</SelectItem>
                {groups.map((g) => (
                  <SelectItem key={g.id} value={g.id}>
                    {g.displayName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        ) : (
          <div />
        )}
        <Field label="SLA policy" controlId="rt-sla">
          <Select
            value={v.slaPolicyId ?? NONE}
            onValueChange={(s) => setV((p) => ({ ...p, slaPolicyId: s === NONE ? null : s }))}
          >
            <SelectTrigger id="rt-sla">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>No targets</SelectItem>
              {policies.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <div className="flex flex-col gap-1.5">
          <span className="text-small font-medium text-fg">Catalog</span>
          <label className="inline-flex h-10 items-center gap-2.5 text-body text-fg md:h-9">
            <Switch
              checked={v.active}
              onCheckedChange={(active) => setV((p) => ({ ...p, active }))}
            />
            Shown in the catalog
          </label>
        </div>
      </div>

      <div className="flex flex-col gap-3 border-t border-border pt-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-body font-medium text-fg">Form fields</h3>
            <p className="text-small text-muted">
              Everyone gets a summary and a details box. Add what this team needs on top.
            </p>
          </div>
          <Button type="button" variant="secondary" size="sm" onClick={addField}>
            <Plus />
            Add field
          </Button>
        </div>
        {errors.fields ? <p className="text-small text-danger-text">{errors.fields}</p> : null}
        {v.fields.length ? (
          <ol className="flex flex-col gap-2">
            {v.fields.map((f, i) => (
              <FieldCard
                key={i}
                f={f}
                i={i}
                count={v.fields.length}
                others={v.fields.filter((_, j) => j !== i)}
                onChange={(nf) => setField(i, nf)}
                onMove={(d) => move(i, d)}
                onRemove={() => setV((p) => ({ ...p, fields: p.fields.filter((_, j) => j !== i) }))}
              />
            ))}
          </ol>
        ) : (
          <p className="rounded-card bg-sunken/50 px-4 py-5 text-center text-small text-muted dark:bg-raised/30">
            No extra fields. People will just write a summary and details.
          </p>
        )}
      </div>
    </EditorSheet>
  );
}
