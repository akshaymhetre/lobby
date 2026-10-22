"use client";

import * as React from "react";
import {
  AppWindow,
  Ellipsis,
  ExternalLink,
  Pencil,
  Plus,
  Search,
  SearchX,
  Trash2,
} from "lucide-react";
import { matchesQuery } from "@lobby/core/apps/logic";
import styles from "./apps-admin.module.css";
import type { AppPreset, LaunchType } from "@lobby/core/apps/presets";
import { deleteAppAction } from "@/app/(app)/admin/apps/_actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
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
import { Input } from "@/components/ui/input";
import { CountUp } from "@/components/ui/motion";
import { Table, TBody, TD, TH, THead, TRow } from "@/components/ui/table";
import { TableToolbar } from "@/components/ui/table-toolbar";
import { toast } from "@/components/ui/toast";
import { AppIcon, type AppIconData } from "../app-icon";
import { LAUNCH_CHIP, launchHref } from "../launch";
import { AppEditor, type EditorValues } from "./app-editor";

export interface AdminApp {
  id: string;
  slug: string;
  name: string;
  description: string;
  category: string;
  iconKey: string;
  color: string;
  icon: AppIconData;
  launchUrl: string;
  launchType: LaunchType;
  ownerId: string | null;
  ownerName: string | null;
  requestAccessEnabled: boolean;
  groupIds: string[];
  presetKey: string | null;
  launches30d: number;
}

export interface PresetOption extends AppPreset {
  icon: AppIconData;
}

export interface Option {
  id: string;
  name: string;
  title?: string | null;
}

function host(url: string) {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

function PresetPicker({
  open,
  onOpenChange,
  presets,
  onPick,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  presets: PresetOption[];
  onPick: (p: PresetOption) => void;
}) {
  const [q, setQ] = React.useState("");
  const list = presets.filter((p) => p.key === "custom" || matchesQuery(p, q));
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) setQ("");
      }}
    >
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>Add an app</DialogTitle>
          <DialogDescription>
            Start from a common app and we fill in the sign-in details, or add any other app.
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-4">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search apps, e.g. Slack"
            aria-label="Search the app catalog"
            leading={<Search />}
            autoFocus
          />
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {list.map((p) => (
              <li key={p.key}>
                <button
                  type="button"
                  onClick={() => onPick(p)}
                  className="cell focus-ring press flex min-h-[60px] w-full items-center gap-3 rounded-card px-3 py-2.5 text-left hover:shadow-cell-hover"
                >
                  <AppIcon
                    icon={
                      p.key === "custom" ? { kind: "monogram", letters: "+", color: null } : p.icon
                    }
                  />
                  <span className="flex min-w-0 flex-col">
                    <span className="text-body font-medium text-fg">{p.name}</span>
                    <span className="truncate text-small text-muted">{p.description}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}

/** An app's own colour for charts: its brand glyph or monogram colour, else the ink colour. */
function chartColour(a: AdminApp): string {
  const c = (a.icon.kind !== "image" && a.icon.color) || a.color;
  // Near-black brand colours (GitHub, Notion) vanish on the dark theme: use the ink token, which flips.
  const m = /^#?([0-9a-f]{6})$/i.exec(c ?? "");
  if (!m) return "var(--lb-fg)";
  const n = parseInt(m[1]!, 16);
  const lum = 0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255);
  return lum < 40 ? "var(--lb-fg)" : `#${m[1]}`;
}

/**
 * The page's lead: how much the launcher is used. The month's opens count up, and a ribbon splits
 * them by app in each app's own colour (the five busiest named, the rest as one quiet segment).
 * Real numbers from the launch log; nothing here is decorative.
 */
function UsageHero({ apps }: { apps: AdminApp[] }) {
  // Two ink-coloured brands side by side would read as one segment: step the later ones down.
  const inks = ["var(--lb-fg)", "var(--lb-muted)", "var(--lb-subtle)"];
  let ink = 0;
  const colourOf = (a: AdminApp) => {
    const c = chartColour(a);
    return c === "var(--lb-fg)" ? inks[Math.min(ink++, inks.length - 1)]! : c;
  };
  const total = apps.reduce((n, a) => n + a.launches30d, 0);
  const ranked = [...apps].filter((a) => a.launches30d > 0).sort((a, b) => b.launches30d - a.launches30d);
  const top = ranked.slice(0, 5);
  const rest = total - top.reduce((n, a) => n + a.launches30d, 0);
  const sso = apps.filter((a) => a.launchType !== "bookmark").length;
  return (
    <section aria-labelledby="usage-hero-title" className="rounded-panel cell p-5 sm:p-6">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between sm:gap-6">
        <div>
          <h2 id="usage-hero-title" className="text-small text-muted">
            Opens from the launcher, last 30 days
          </h2>
          <p className="mt-1 flex items-baseline gap-2 tabular">
            <span className="text-[44px] font-medium leading-[48px] tracking-[-0.03em] text-fg">
              <CountUp value={total} duration={1.1} delay={0.15} />
            </span>
            <span className="text-body text-muted">
              across the {apps.length} {apps.length === 1 ? "app" : "apps"} in the catalogue, {sso} with single sign-on
            </span>
          </p>
        </div>
        {top[0] ? (
          <p className="text-small text-muted">
            <span className="font-medium text-fg">{top[0].name}</span> is opened most
          </p>
        ) : null}
      </div>
      {total > 0 ? (
        <>
          <div aria-hidden className="mt-5 flex h-3 gap-1 overflow-hidden rounded-full">
            {top.map((a, i) => (
              <span
                key={a.id}
                className={`${styles.seg} h-full rounded-full`}
                style={{
                  flex: a.launches30d,
                  background: colourOf(a),
                  animationDelay: `${0.25 + i * 0.08}s`,
                }}
              />
            ))}
            {rest > 0 ? (
              <span
                className={`${styles.seg} h-full rounded-full bg-border-strong`}
                style={{ flex: rest, animationDelay: `${0.25 + top.length * 0.08}s` }}
              />
            ) : null}
          </div>
          <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-2">
            {top.map((a) => (
              <li key={a.id} className="flex items-center gap-2 text-small">
                <AppIcon icon={a.icon} size="sm" />
                <span className="text-fg">{a.name}</span>
                <span className="tabular text-muted">{a.launches30d}</span>
              </li>
            ))}
            {rest > 0 ? (
              <li className="flex items-center gap-2 text-small text-muted">
                <span aria-hidden className="size-2.5 rounded-full bg-border-strong" />
                Everything else <span className="tabular">{rest}</span>
              </li>
            ) : null}
          </ul>
        </>
      ) : (
        <p className="mt-3 text-small text-muted">Nobody has opened an app from the launcher in the last 30 days.</p>
      )}
    </section>
  );
}

export function AppsAdmin({
  apps,
  presets,
  categories,
  groups,
  people,
}: {
  apps: AdminApp[];
  presets: PresetOption[];
  categories: string[];
  groups: Option[];
  people: Option[];
}) {
  const [q, setQ] = React.useState("");
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<EditorValues | null>(null);
  const [deleting, setDeleting] = React.useState<AdminApp | null>(null);
  const [deletePending, startDelete] = React.useTransition();
  const groupName = React.useMemo(() => new Map(groups.map((g) => [g.id, g.name])), [groups]);
  const glyphs = React.useMemo(
    () =>
      Object.fromEntries(
        presets.filter((p) => p.icon.kind === "glyph").map((p) => [`preset:${p.key}`, p.icon]),
      ),
    [presets],
  );

  const shown = apps.filter((a) => matchesQuery(a, q));

  const openNew = (p: PresetOption) => {
    setPickerOpen(false);
    const hasGlyph = p.icon.kind === "glyph";
    setEditing({
      name: p.key === "custom" ? "" : p.name,
      description: p.key === "custom" ? "" : p.description,
      category: p.category,
      iconKey: hasGlyph ? `preset:${p.key}` : "",
      color: p.color,
      launchUrl: p.launchUrl,
      launchType: p.launchType,
      ownerId: null,
      requestAccessEnabled: true,
      groupIds: [],
      presetKey: p.key,
      urlHint: p.urlHint,
    });
  };

  const openEdit = (a: AdminApp) =>
    setEditing({
      id: a.id,
      name: a.name,
      description: a.description,
      category: a.category,
      iconKey: a.iconKey,
      color: a.color,
      launchUrl: a.launchUrl,
      launchType: a.launchType,
      ownerId: a.ownerId,
      requestAccessEnabled: a.requestAccessEnabled,
      groupIds: a.groupIds,
      presetKey: a.presetKey,
      urlHint: presets.find((p) => p.key === a.presetKey)?.urlHint,
    });

  const confirmDelete = () => {
    if (!deleting) return;
    const app = deleting;
    startDelete(async () => {
      const res = await deleteAppAction(app.id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setDeleting(null);
      toast.success(`Deleted ${app.name}`, {
        description: "It no longer shows in anyone's launcher.",
      });
    });
  };

  return (
    <div className="flex flex-col gap-4">
      {apps.length ? <UsageHero apps={apps} /> : null}
      <TableToolbar
        search={
          <Input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Filter apps"
            aria-label="Filter apps"
            leading={<Search />}
          />
        }
        action={
          <Button onClick={() => setPickerOpen(true)}>
            <Plus aria-hidden />
            Add app
          </Button>
        }
      />

      {apps.length === 0 ? (
        <EmptyState
          icon={<AppWindow />}
          title="No apps in the launcher yet"
          description="Add the tools your company uses. Each one becomes a tile people can open with one click."
          action={
            <Button onClick={() => setPickerOpen(true)}>
              <Plus aria-hidden />
              Add your first app
            </Button>
          }
        />
      ) : shown.length === 0 ? (
        <EmptyState
          variant="filtered"
          icon={<SearchX />}
          title={`No apps match "${q.trim()}"`}
          action={
            <Button variant="secondary" onClick={() => setQ("")}>
              Clear filter
            </Button>
          }
        />
      ) : (
        <>
          {/* Desktop: a dense table. */}
          <Table wrapperClassName="hidden md:block">
            <THead>
              <tr>
                <TH>App</TH>
                <TH>Category</TH>
                <TH>Sign-in</TH>
                <TH>Visible to</TH>
                <TH className="hidden 2xl:table-cell">Owner</TH>
                <TH align="right" title="Opens in the last 30 days">
                  Opens, 30d
                </TH>
                <TH>
                  <span className="sr-only">Actions</span>
                </TH>
              </tr>
            </THead>
            <TBody>
              {shown.map((a) => (
                <TRow key={a.id}>
                  <TD className="py-2">
                    <div className="flex min-w-0 items-center gap-3">
                      <AppIcon icon={a.icon} size="sm" />
                      <div className="flex min-w-0 flex-col">
                        <button
                          type="button"
                          onClick={() => openEdit(a)}
                          className="focus-ring w-fit truncate rounded-[4px] text-left font-medium text-fg hover:underline"
                        >
                          {a.name}
                        </button>
                        <span className="max-w-[260px] truncate text-small text-muted">
                          {host(a.launchUrl)}
                        </span>
                      </div>
                    </div>
                  </TD>
                  <TD className="whitespace-nowrap text-muted">{a.category}</TD>
                  <TD>
                    {LAUNCH_CHIP[a.launchType] ? (
                      <Badge tone={a.launchType === "sso_link" ? "accent" : "info"} size="sm">
                        {LAUNCH_CHIP[a.launchType]!.label}
                      </Badge>
                    ) : (
                      <Badge size="sm">Bookmark</Badge>
                    )}
                  </TD>
                  <TD>
                    {a.groupIds.length ? (
                      <div className="flex max-w-[220px] flex-wrap gap-1">
                        {a.groupIds.map((g) => (
                          <Badge key={g} size="sm">
                            {groupName.get(g) ?? "Unknown group"}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <span className="text-muted">Everyone</span>
                    )}
                  </TD>
                  <TD className="hidden whitespace-nowrap text-muted 2xl:table-cell">
                    {a.ownerName ?? "No owner"}
                  </TD>
                  <TD numeric>
                    {a.launches30d}
                  </TD>
                  <TD className="w-12">
                    <RowMenu app={a} onEdit={() => openEdit(a)} onDelete={() => setDeleting(a)} />
                  </TD>
                </TRow>
              ))}
            </TBody>
          </Table>

          {/* Mobile: one card per app. */}
          <ul className="panel flex flex-col divide-y divide-border overflow-hidden rounded-panel md:hidden">
            {shown.map((a) => (
              <li key={a.id} className="flex items-center gap-3 px-4 py-3">
                <AppIcon icon={a.icon} size="sm" />
                <button
                  type="button"
                  onClick={() => openEdit(a)}
                  className="focus-ring flex min-w-0 flex-1 flex-col rounded-[4px] text-left"
                >
                  <span className="truncate font-medium text-fg">{a.name}</span>
                  <span className="truncate text-small text-muted">
                    {a.category} ·{" "}
                    {a.groupIds.length
                      ? `Only ${a.groupIds.map((g) => groupName.get(g)).join(", ")}`
                      : "Everyone"}
                  </span>
                </button>
                <RowMenu app={a} onEdit={() => openEdit(a)} onDelete={() => setDeleting(a)} />
              </li>
            ))}
          </ul>
        </>
      )}

      <PresetPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        presets={presets}
        onPick={openNew}
      />

      <AppEditor
        values={editing}
        onClose={() => setEditing(null)}
        categories={categories}
        groups={groups}
        people={people}
        presets={presets}
        glyphs={glyphs}
      />

      <Dialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>Delete {deleting?.name}?</DialogTitle>
            <DialogDescription>
              It disappears from everyone&apos;s launcher, along with their pins and launch history.
              People keep their accounts in {deleting?.name} itself.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setDeleting(null)}>
              Keep it
            </Button>
            <Button variant="danger" loading={deletePending} onClick={confirmDelete}>
              Delete app
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RowMenu({
  app,
  onEdit,
  onDelete,
}: {
  app: AdminApp;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${app.name}`}>
          <Ellipsis aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={onEdit}>
          <Pencil aria-hidden />
          Edit
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() => window.open(launchHref(app.slug), "_blank", "noopener,noreferrer")}
        >
          <ExternalLink aria-hidden />
          Test launch
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem destructive onSelect={onDelete}>
          <Trash2 aria-hidden />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
