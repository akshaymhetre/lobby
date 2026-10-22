"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  Ellipsis,
  Gauge,
  LayoutGrid,
  Link2,
  Pencil,
  Plus,
  SquarePlay,
  Trash2,
  X,
} from "lucide-react";
import {
  deleteHomeCardAction,
  moveHomeCardAction,
  saveHomeCardAction,
} from "@/app/(app)/admin/home/_actions";
import { Badge, Chip } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/ui/empty-state";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SegmentedControl } from "@/components/ui/segmented-control";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/toast";

type CardType = "links" | "kpi" | "embed";
type Group = { id: string; name: string };

export interface CardRow {
  id: string;
  type: CardType;
  title: string;
  config: Record<string, unknown>;
  audienceGroupIds: string[];
}

const TYPE_INFO: Record<CardType, { label: string; icon: React.ReactNode; explain: string }> = {
  links: { label: "Links", icon: <Link2 />, explain: "A short list of useful pages and tools." },
  kpi: {
    label: "Number",
    icon: <Gauge />,
    explain: "One figure people check often, like the next payday.",
  },
  embed: {
    label: "Embed",
    icon: <SquarePlay />,
    explain: "A small web page shown inside the card, such as a status page.",
  },
};

interface Draft {
  id?: string;
  type: CardType;
  title: string;
  links: { label: string; href: string }[];
  kpiValue: string;
  kpiHint: string;
  kpiPayday: boolean;
  embedUrl: string;
  embedHeight: string;
  audienceGroupIds: string[];
}

function toDraft(c?: CardRow): Draft {
  const cfg = (c?.config ?? {}) as {
    links?: { label: string; href: string }[];
    value?: string;
    hint?: string;
    compute?: string;
    url?: string;
    height?: number;
  };
  return {
    id: c?.id,
    type: c?.type ?? "links",
    title: c?.title ?? "",
    links: cfg.links?.length
      ? cfg.links.map((l) => ({ label: l.label, href: l.href }))
      : [{ label: "", href: "" }],
    kpiValue: cfg.value ?? "",
    kpiHint: cfg.hint ?? "",
    kpiPayday: cfg.compute === "next-payday",
    embedUrl: cfg.url ?? "",
    embedHeight: String(cfg.height ?? 240),
    audienceGroupIds: c?.audienceGroupIds ?? [],
  };
}

function configFor(d: Draft): Record<string, unknown> {
  if (d.type === "links") return { links: d.links };
  if (d.type === "kpi")
    return d.kpiPayday
      ? { compute: "next-payday", hint: d.kpiHint }
      : { value: d.kpiValue, hint: d.kpiHint };
  return { url: d.embedUrl, height: Number(d.embedHeight) };
}

function CardEditor({
  initial,
  groups,
  onClose,
}: {
  initial: Draft;
  groups: Group[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [v, setV] = React.useState(initial);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [pending, start] = React.useTransition();
  const set = <K extends keyof Draft>(k: K, val: Draft[K]) => setV((p) => ({ ...p, [k]: val }));
  const setLink = (i: number, key: "label" | "href", val: string) =>
    setV((p) => ({ ...p, links: p.links.map((l, j) => (j === i ? { ...l, [key]: val } : l)) }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    start(async () => {
      const res = await saveHomeCardAction({
        id: v.id,
        type: v.type,
        title: v.title,
        config: configFor(v),
        audienceGroupIds: v.audienceGroupIds,
      });
      if (!res.ok) {
        setErrors(res.fieldErrors ?? {});
        if (!res.fieldErrors) toast.error(res.error);
        return;
      }
      toast.success(v.id ? "Card saved" : "Card added", {
        description: "It is on the home page now.",
      });
      onClose();
      router.refresh();
    });
  };

  return (
    <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col" noValidate>
      <SheetHeader>
        <SheetTitle>{v.id ? "Edit card" : "New card"}</SheetTitle>
        <SheetDescription>Cards sit in the right-hand column of the home page.</SheetDescription>
      </SheetHeader>
      <SheetBody className="flex flex-col gap-5">
        {!v.id ? (
          <div className="flex flex-col gap-2">
            <Label>Kind of card</Label>
            <SegmentedControl
              aria-label="Kind of card"
              value={v.type}
              onValueChange={(t) => {
                set("type", t as CardType);
                setErrors({});
              }}
              options={(Object.keys(TYPE_INFO) as CardType[]).map((t) => ({
                value: t,
                label: TYPE_INFO[t].label,
                icon: TYPE_INFO[t].icon,
              }))}
            />
            <p className="text-small text-muted">{TYPE_INFO[v.type].explain}</p>
          </div>
        ) : null}
        <Field label="Title" error={errors.title} required>
          <Input
            value={v.title}
            onChange={(e) => set("title", e.target.value)}
            maxLength={60}
            autoFocus
          />
        </Field>

        {v.type === "links" ? (
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-small font-medium text-fg">Links</legend>
            {v.links.map((l, i) => (
              <div key={i} className="flex flex-col gap-1">
                <div className="flex items-start gap-2">
                  <Input
                    value={l.label}
                    onChange={(e) => setLink(i, "label", e.target.value)}
                    placeholder="Label"
                    aria-label={`Link ${i + 1} label`}
                    aria-invalid={errors[`links.${i}.label`] ? true : undefined}
                    className="flex-1"
                  />
                  <Input
                    value={l.href}
                    onChange={(e) => setLink(i, "href", e.target.value)}
                    placeholder="/help or https://"
                    aria-label={`Link ${i + 1} address`}
                    aria-invalid={errors[`links.${i}.href`] ? true : undefined}
                    className="flex-[1.3]"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Remove link ${i + 1}`}
                    disabled={v.links.length === 1}
                    onClick={() =>
                      set(
                        "links",
                        v.links.filter((_, j) => j !== i),
                      )
                    }
                  >
                    <X aria-hidden />
                  </Button>
                </div>
                {errors[`links.${i}.label`] || errors[`links.${i}.href`] ? (
                  <p className="text-small text-danger-text">
                    {errors[`links.${i}.label`] ?? errors[`links.${i}.href`]}
                  </p>
                ) : null}
              </div>
            ))}
            {errors.links ? <p className="text-small text-danger-text">{errors.links}</p> : null}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="self-start"
              disabled={v.links.length >= 12}
              onClick={() => set("links", [...v.links, { label: "", href: "" }])}
            >
              <Plus aria-hidden />
              Add a link
            </Button>
          </fieldset>
        ) : v.type === "kpi" ? (
          <>
            <div className="flex items-start justify-between gap-4 rounded-cell bg-sunken/60 px-3.5 py-3">
              <div className="flex flex-col gap-0.5">
                <Label htmlFor="kpi-payday">Work out the next payday</Label>
                <p className="text-small text-muted">
                  Uses the last working day of each month, from your company settings.
                </p>
              </div>
              <Switch
                id="kpi-payday"
                checked={v.kpiPayday}
                onCheckedChange={(c) => set("kpiPayday", c)}
                className="mt-0.5"
              />
            </div>
            {!v.kpiPayday ? (
              <Field
                label="Value"
                help="Short, like 4 of 4 open or 98.2%."
                error={errors.value}
                required
              >
                <Input
                  value={v.kpiValue}
                  onChange={(e) => set("kpiValue", e.target.value)}
                  maxLength={40}
                />
              </Field>
            ) : null}
            <Field label="Note underneath" help="Optional context for the number.">
              <Input
                value={v.kpiHint}
                onChange={(e) => set("kpiHint", e.target.value)}
                maxLength={120}
              />
            </Field>
          </>
        ) : (
          <>
            <Field
              label="Page address"
              help="Must start with https://. Some sites refuse to be shown inside other pages."
              error={errors.url}
              required
            >
              <Input
                value={v.embedUrl}
                onChange={(e) => set("embedUrl", e.target.value)}
                placeholder="https://"
                inputMode="url"
              />
            </Field>
            <Field label="Height in pixels" help="Between 120 and 600.">
              <Input
                type="number"
                min={120}
                max={600}
                value={v.embedHeight}
                onChange={(e) => set("embedHeight", e.target.value)}
                className="w-32"
              />
            </Field>
          </>
        )}

        <div className="flex flex-col gap-2">
          <Label id="card-audience">Who sees it</Label>
          <div className="flex flex-wrap gap-1.5" role="group" aria-labelledby="card-audience">
            <Chip
              selected={v.audienceGroupIds.length === 0}
              onClick={() => set("audienceGroupIds", [])}
            >
              Everyone
            </Chip>
            {groups.map((g) => {
              const on = v.audienceGroupIds.includes(g.id);
              return (
                <Chip
                  key={g.id}
                  selected={on}
                  onClick={() =>
                    set(
                      "audienceGroupIds",
                      on
                        ? v.audienceGroupIds.filter((x) => x !== g.id)
                        : [...v.audienceGroupIds, g.id],
                    )
                  }
                >
                  {g.name}
                </Chip>
              );
            })}
          </div>
        </div>
      </SheetBody>
      <SheetFooter>
        <Button type="button" variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" loading={pending}>
          {v.id ? "Save card" : "Add card"}
        </Button>
      </SheetFooter>
    </form>
  );
}

function summary(c: CardRow): string {
  const cfg = c.config as { links?: unknown[]; value?: string; compute?: string; url?: string };
  if (c.type === "links") return `${cfg.links?.length ?? 0} links`;
  if (c.type === "kpi")
    return cfg.compute === "next-payday" ? "Next payday, worked out each day" : (cfg.value ?? "");
  try {
    return new URL(cfg.url ?? "").host;
  } catch {
    return "No address";
  }
}

export function CardsAdmin({ cards, groups }: { cards: CardRow[]; groups: Group[] }) {
  const router = useRouter();
  const [editing, setEditing] = React.useState<Draft | null>(null);
  const [deleting, setDeleting] = React.useState<CardRow | null>(null);
  const [busy, startBusy] = React.useTransition();
  const groupName = new Map(groups.map((g) => [g.id, g.name]));

  const move = (c: CardRow, delta: -1 | 1) =>
    startBusy(async () => {
      const res = await moveHomeCardAction(c.id, delta);
      if (!res.ok) toast.error(res.error);
      else router.refresh();
    });

  const confirmDelete = () => {
    const c = deleting;
    if (!c) return;
    startBusy(async () => {
      const res = await deleteHomeCardAction(c.id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setDeleting(null);
      toast.success("Card removed");
      router.refresh();
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-body text-muted">
          Shown in this order down the right-hand column, after New joiners.
        </p>
        <Button onClick={() => setEditing(toDraft())} className="shrink-0">
          <Plus aria-hidden />
          New card
        </Button>
      </div>
      {cards.length ? (
        <ol className="panel flex flex-col divide-y divide-border overflow-hidden rounded-panel">
          {cards.map((c, i) => (
            <li key={c.id} className="flex items-center gap-3 px-4 py-3">
              <span className="tabular w-5 shrink-0 text-center text-small text-subtle">
                {i + 1}
              </span>
              <span
                className="inline-flex size-9 shrink-0 items-center justify-center text-muted [&_svg]:size-[18px] [&_svg]:stroke-[1.5]"
                aria-hidden
              >
                {TYPE_INFO[c.type].icon}
              </span>
              <div className="flex min-w-0 flex-1 flex-col">
                <button
                  type="button"
                  onClick={() => setEditing(toDraft(c))}
                  className="focus-ring w-fit truncate rounded-[4px] text-left text-body font-medium text-fg hover:underline"
                >
                  {c.title}
                </button>
                <span className="truncate text-small text-muted">
                  {TYPE_INFO[c.type].label} · {summary(c)}
                </span>
              </div>
              <Badge size="sm" className="hidden sm:inline-flex">
                {c.audienceGroupIds.length
                  ? `Only ${c.audienceGroupIds.map((g) => groupName.get(g) ?? "removed group").join(", ")}`
                  : "Everyone"}
              </Badge>
              <div className="flex items-center">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Move ${c.title} up`}
                  disabled={i === 0 || busy}
                  onClick={() => move(c, -1)}
                >
                  <ArrowUp aria-hidden />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Move ${c.title} down`}
                  disabled={i === cards.length - 1 || busy}
                  onClick={() => move(c, 1)}
                >
                  <ArrowDown aria-hidden />
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${c.title}`}>
                      <Ellipsis aria-hidden />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onSelect={() => setEditing(toDraft(c))}>
                      <Pencil aria-hidden />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem destructive onSelect={() => setDeleting(c)}>
                      <Trash2 aria-hidden />
                      Remove
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <EmptyState
          icon={<LayoutGrid />}
          title="No home cards"
          description="Add useful links, a number people check often, or a small embedded page."
          action={
            <Button onClick={() => setEditing(toDraft())}>
              <Plus aria-hidden />
              New card
            </Button>
          }
        />
      )}

      <Sheet open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <SheetContent className="sm:max-w-[520px]" aria-describedby={undefined}>
          {editing ? (
            <CardEditor
              key={editing.id ?? "new"}
              initial={editing}
              groups={groups}
              onClose={() => setEditing(null)}
            />
          ) : null}
        </SheetContent>
      </Sheet>

      <Dialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>Remove {deleting?.title}?</DialogTitle>
            <DialogDescription>It comes off everyone&apos;s home page.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setDeleting(null)}>
              Keep it
            </Button>
            <Button variant="danger" loading={busy} onClick={confirmDelete}>
              Remove card
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
