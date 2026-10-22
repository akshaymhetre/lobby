"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ClipboardCheck, Ellipsis, Megaphone, Pencil, Plus, Trash2 } from "lucide-react";
import {
  acknowledgementReportAction,
  deleteAnnouncementAction,
  saveAnnouncementAction,
  type ReportPerson,
} from "@/app/(app)/admin/home/_actions";
import { Avatar } from "@/components/ui/avatar";
import { BorderBeam } from "@/components/ui/effects/border-beam";
import { CountUp } from "@/components/ui/motion";
import { Badge, Chip, type BadgeTone } from "@/components/ui/badge";
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
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsCount, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";
import { formatDate, formatDateTime, timeAgo } from "@/lib/time";
import styles from "./announcements-admin.module.css";

export interface AnnouncementRow {
  id: string;
  title: string;
  body: string;
  severity: "info" | "important" | "critical";
  mustAcknowledge: boolean;
  audienceGroupIds: string[];
  startsAt: string;
  endsAt: string | null;
  authorName: string | null;
  audienceSize: number;
  acknowledged: number;
}

type Group = { id: string; name: string };

const SEVERITY: Record<AnnouncementRow["severity"], { label: string; tone: BadgeTone }> = {
  info: { label: "Info", tone: "info" },
  important: { label: "Important", tone: "warning" },
  critical: { label: "Critical", tone: "danger" },
};

function windowStatus(a: Pick<AnnouncementRow, "startsAt" | "endsAt">, now = Date.now()) {
  const start = new Date(a.startsAt).getTime();
  const end = a.endsAt ? new Date(a.endsAt).getTime() : null;
  if (start > now)
    return { label: `Starts ${formatDateTime(a.startsAt)}`, tone: "neutral" as const, live: false };
  if (end !== null && end <= now)
    return { label: `Ended ${formatDate(a.endsAt!)}`, tone: "neutral" as const, live: false };
  return {
    label: end ? `Live until ${formatDate(a.endsAt!, { day: "numeric", month: "short" })}` : "Live",
    tone: "success" as const,
    live: true,
  };
}

/** datetime-local wants "YYYY-MM-DDTHH:mm" in local time. */
function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

interface Draft {
  id?: string;
  title: string;
  body: string;
  severity: AnnouncementRow["severity"];
  mustAcknowledge: boolean;
  audienceGroupIds: string[];
  startsAt: string;
  endsAt: string;
}

function AnnouncementEditor({
  draft,
  groups,
  onClose,
}: {
  draft: Draft;
  groups: Group[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [v, setV] = React.useState(draft);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [pending, start] = React.useTransition();
  const set = <K extends keyof Draft>(k: K, val: Draft[K]) => {
    setV((p) => ({ ...p, [k]: val }));
    if (errors[k as string]) setErrors(({ [k as string]: _x, ...rest }) => rest);
  };
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    start(async () => {
      const res = await saveAnnouncementAction({
        id: v.id,
        title: v.title,
        body: v.body,
        severity: v.severity,
        mustAcknowledge: v.mustAcknowledge,
        audienceGroupIds: v.audienceGroupIds,
        startsAt: v.startsAt ? new Date(v.startsAt).toISOString() : "invalid",
        endsAt: v.endsAt ? new Date(v.endsAt).toISOString() : null,
      });
      if (!res.ok) {
        setErrors(res.fieldErrors ?? {});
        if (!res.fieldErrors) toast.error(res.error);
        return;
      }
      toast.success(v.id ? "Announcement updated" : "Announcement posted", {
        description: v.mustAcknowledge
          ? "People will be asked to confirm they have read it."
          : undefined,
      });
      onClose();
      router.refresh();
    });
  };
  return (
    <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col" noValidate>
      <SheetHeader>
        <SheetTitle>{v.id ? "Edit announcement" : "New announcement"}</SheetTitle>
        <SheetDescription>Shows as a banner at the top of the home page.</SheetDescription>
      </SheetHeader>
      <SheetBody className="flex flex-col gap-5">
        <Field label="Title" error={errors.title} required>
          <Input
            value={v.title}
            onChange={(e) => set("title", e.target.value)}
            maxLength={140}
            autoFocus
          />
        </Field>
        <Field
          label="Message"
          help="Keep it short. Write [label](/path) to add a link."
          error={errors.body}
          required
        >
          <Textarea
            value={v.body}
            onChange={(e) => set("body", e.target.value)}
            rows={4}
            maxLength={1000}
          />
        </Field>
        <div className="flex flex-col gap-2">
          <Label id="ann-severity">How important</Label>
          <SegmentedControl
            aria-label="How important"
            value={v.severity}
            onValueChange={(s) => set("severity", s as Draft["severity"])}
            options={[
              { value: "info", label: "Info" },
              { value: "important", label: "Important" },
              { value: "critical", label: "Critical" },
            ]}
          />
        </div>
        <div className="flex items-start justify-between gap-4 rounded-cell bg-sunken/60 px-3.5 py-3">
          <div className="flex flex-col gap-0.5">
            <Label htmlFor="ann-ack">Ask people to confirm they have read it</Label>
            <p className="text-small text-muted">
              It stays on their home page, without a close button, until they press &ldquo;I have
              read this&rdquo;.
            </p>
          </div>
          <Switch
            id="ann-ack"
            checked={v.mustAcknowledge}
            onCheckedChange={(c) => set("mustAcknowledge", c)}
            className="mt-0.5"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label id="ann-audience">Who sees it</Label>
          <div className="flex flex-wrap gap-1.5" role="group" aria-labelledby="ann-audience">
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
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Show from" error={errors.startsAt} required>
            <Input
              type="datetime-local"
              value={v.startsAt}
              onChange={(e) => set("startsAt", e.target.value)}
            />
          </Field>
          <Field label="Until" help="Leave empty to keep it up." error={errors.endsAt}>
            <Input
              type="datetime-local"
              value={v.endsAt}
              onChange={(e) => set("endsAt", e.target.value)}
            />
          </Field>
        </div>
      </SheetBody>
      <SheetFooter>
        <Button type="button" variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" loading={pending}>
          {v.id ? "Save changes" : "Post announcement"}
        </Button>
      </SheetFooter>
    </form>
  );
}

function PersonRow({ p, meta }: { p: ReportPerson; meta?: string }) {
  return (
    <li className="flex min-h-12 items-center gap-3 py-2">
      <Avatar name={p.name} src={p.avatarUrl} seed={p.id} />
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-body font-medium text-fg">{p.name}</span>
        <span className="truncate text-caption text-muted">
          {[p.title, p.department].filter(Boolean).join(" · ")}
        </span>
      </div>
      {meta ? <span className="shrink-0 text-caption text-muted">{meta}</span> : null}
    </li>
  );
}

function ReportDialog({ row, onClose }: { row: AnnouncementRow; onClose: () => void }) {
  const [data, setData] = React.useState<{
    total: number;
    acknowledged: ReportPerson[];
    pending: ReportPerson[];
  } | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  React.useEffect(() => {
    let live = true;
    acknowledgementReportAction(row.id).then((res) => {
      if (!live) return;
      if (res.ok) setData(res);
      else setError(res.error);
    });
    return () => {
      live = false;
    };
  }, [row.id]);
  const done = data?.acknowledged.length ?? row.acknowledged;
  const total = data?.total ?? row.audienceSize;
  const pct = total ? Math.round((done / total) * 100) : 0;
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>Who has read it</DialogTitle>
          <DialogDescription>{row.title}</DialogDescription>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-4">
          <div className="flex flex-col gap-2 cell rounded-card p-4">
            <div className="flex items-baseline justify-between gap-3">
              <span className="tabular text-h3 font-medium text-fg">
                <CountUp value={done} duration={0.8} /> of {total}
              </span>
              <span className="tabular text-small text-muted">{pct}% confirmed</span>
            </div>
            <Progress
              value={done}
              max={Math.max(total, 1)}
              tone={pct === 100 ? "success" : "accent"}
              aria-label="Confirmed so far"
            />
          </div>
          {error ? (
            <p role="alert" className="text-body text-danger-text">
              {error}
            </p>
          ) : !data ? (
            <div className="flex flex-col gap-3" aria-busy>
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-10" />
              ))}
            </div>
          ) : (
            <Tabs defaultValue={data.pending.length ? "pending" : "done"}>
              <TabsList>
                <TabsTrigger value="pending">
                  Not yet <TabsCount>{data.pending.length}</TabsCount>
                </TabsTrigger>
                <TabsTrigger value="done">
                  Read it <TabsCount>{data.acknowledged.length}</TabsCount>
                </TabsTrigger>
              </TabsList>
              <TabsContent value="pending">
                {data.pending.length ? (
                  <ul className="flex max-h-[320px] flex-col divide-y divide-border overflow-y-auto">
                    {data.pending.map((p) => (
                      <PersonRow key={p.id} p={p} />
                    ))}
                  </ul>
                ) : (
                  <p className="py-6 text-center text-body text-muted">Everyone has confirmed.</p>
                )}
              </TabsContent>
              <TabsContent value="done">
                {data.acknowledged.length ? (
                  <ul className="flex max-h-[320px] flex-col divide-y divide-border overflow-y-auto">
                    {data.acknowledged.map((p) => (
                      <PersonRow key={p.id} p={p} meta={p.at ? timeAgo(p.at) : undefined} />
                    ))}
                  </ul>
                ) : (
                  <p className="py-6 text-center text-body text-muted">Nobody has confirmed yet.</p>
                )}
              </TabsContent>
            </Tabs>
          )}
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}

/**
 * The page's lead: the live announcement still waiting on read confirmations. One cell per person
 * in its audience, the confirmed ones filled amber (the acknowledgement category colour), a count
 * that runs up to the real number, and the page's one beam travelling the card twice.
 * Audiences over 120 people are drawn as 120 cells, each standing for an equal share.
 */
function ReadConfirmationHero({ row, onReport }: { row: AnnouncementRow; onReport: () => void }) {
  const total = Math.max(row.audienceSize, 1);
  const cells = Math.min(total, 120);
  const on = Math.round((row.acknowledged / total) * cells);
  const pct = Math.round((row.acknowledged / total) * 100);
  return (
    <section
      aria-labelledby="ack-hero-title"
      className="relative isolate overflow-hidden rounded-panel cell p-5 sm:p-6"
    >
      <BorderBeam tone="amber" intensity="vivid" loops={2} duration={2.6} delay={0.9} />
      <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between md:gap-8">
        <div className="flex min-w-0 items-start gap-3.5">
          <span aria-hidden className="cat-amber inline-flex size-10 shrink-0 items-center justify-center rounded-full shadow-cell">
            <ClipboardCheck className="size-[18px] stroke-[1.75]" />
          </span>
          <div className="min-w-0">
            <p className="text-small text-muted">
              Waiting on read confirmations{row.endsAt ? ` · until ${formatDate(row.endsAt, { day: "numeric", month: "short" })}` : ""}
            </p>
            <h2 id="ack-hero-title" className="mt-0.5 text-h3 font-medium text-fg text-pretty">
              {row.title}
            </h2>
          </div>
        </div>
        <div className="flex shrink-0 items-end gap-4">
          <p className="flex items-baseline gap-2 tabular">
            <span className="text-[44px] font-medium leading-[44px] tracking-[-0.03em] text-fg">
              <CountUp value={row.acknowledged} duration={1.1} delay={0.2} />
            </span>
            <span className="text-body text-muted">
              of {row.audienceSize} confirmed · {pct}%
            </span>
          </p>
        </div>
      </div>
      <div aria-hidden className={`${styles.cells} mt-5`}>
        {Array.from({ length: cells }, (_, i) => (
          <span
            key={i}
            className={styles.cell}
            data-on={i < on ? "" : undefined}
            style={i < on ? { animationDelay: `${0.25 + i * (0.9 / Math.max(on, 1))}s` } : undefined}
          />
        ))}
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-small text-muted">
          {row.audienceSize - row.acknowledged} {row.audienceSize - row.acknowledged === 1 ? "person has" : "people have"} not
          confirmed yet. They see it at the top of their home page until they do.
        </p>
        <Button variant="secondary" size="sm" onClick={onReport}>
          See who has read it
        </Button>
      </div>
    </section>
  );
}

export function AnnouncementsAdmin({ rows, groups }: { rows: AnnouncementRow[]; groups: Group[] }) {
  const router = useRouter();
  const [editing, setEditing] = React.useState<Draft | null>(null);
  const [reporting, setReporting] = React.useState<AnnouncementRow | null>(null);
  const [deleting, setDeleting] = React.useState<AnnouncementRow | null>(null);
  const [deletePending, startDelete] = React.useTransition();
  const groupName = new Map(groups.map((g) => [g.id, g.name]));
  const needsAttention =
    rows.find((a) => a.mustAcknowledge && windowStatus(a).live && a.acknowledged < a.audienceSize)?.id ?? null;

  const openNew = () =>
    setEditing({
      title: "",
      body: "",
      severity: "info",
      mustAcknowledge: false,
      audienceGroupIds: [],
      startsAt: toLocalInput(new Date().toISOString()),
      endsAt: toLocalInput(new Date(Date.now() + 14 * 86_400_000).toISOString()),
    });
  const openEdit = (a: AnnouncementRow) =>
    setEditing({
      id: a.id,
      title: a.title,
      body: a.body,
      severity: a.severity,
      mustAcknowledge: a.mustAcknowledge,
      audienceGroupIds: a.audienceGroupIds,
      startsAt: toLocalInput(a.startsAt),
      endsAt: toLocalInput(a.endsAt),
    });

  const confirmDelete = () => {
    const a = deleting;
    if (!a) return;
    startDelete(async () => {
      const res = await deleteAnnouncementAction(a.id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setDeleting(null);
      toast.success("Announcement deleted");
      router.refresh();
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
        <p className="text-body text-muted">
          Banners at the top of the home page, with optional read confirmation.
        </p>
        <Button onClick={openNew} className="shrink-0">
          <Plus aria-hidden />
          New announcement
        </Button>
      </div>
      {needsAttention ? (
        <ReadConfirmationHero
          row={rows.find((r) => r.id === needsAttention)!}
          onReport={() => setReporting(rows.find((r) => r.id === needsAttention)!)}
        />
      ) : null}
      {rows.length ? (
        <ul className="panel flex flex-col divide-y divide-border overflow-hidden rounded-panel">
          {rows.map((a) => {
            const st = windowStatus(a);
            const pct = a.audienceSize ? Math.round((a.acknowledged / a.audienceSize) * 100) : 0;
            return (
              <li
                key={a.id}
                className="relative flex flex-col gap-3 px-4 py-4 pr-12 md:flex-row md:items-center md:gap-6 md:pr-4"
              >
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge size="sm" tone={SEVERITY[a.severity].tone} dot>
                      {SEVERITY[a.severity].label}
                    </Badge>
                    <Badge size="sm" tone={st.tone}>
                      {st.label}
                    </Badge>
                  </div>
                  <button
                    type="button"
                    onClick={() => openEdit(a)}
                    className="focus-ring w-fit rounded-[4px] text-left text-body font-medium text-fg hover:underline"
                  >
                    {a.title}
                  </button>
                  <p className="text-small text-muted">
                    {a.audienceGroupIds.length
                      ? `Only ${a.audienceGroupIds.map((g) => groupName.get(g) ?? "a removed group").join(", ")}`
                      : "Everyone"}
                    {a.authorName ? ` · by ${a.authorName}` : ""}
                  </p>
                </div>
                {a.mustAcknowledge ? (
                  <button
                    type="button"
                    onClick={() => setReporting(a)}
                    className="focus-ring relative isolate flex w-full flex-col gap-1.5 rounded-cell px-2.5 py-2 text-left hover:bg-hover md:w-[200px]"
                    aria-label={`${a.acknowledged} of ${a.audienceSize} have confirmed. Open the report.`}
                  >
                    <span className="flex items-baseline justify-between gap-2 text-small">
                      <span className="tabular font-medium text-fg">
                        <CountUp value={a.acknowledged} duration={0.9} delay={0.2} /> of {a.audienceSize} read
                      </span>
                      <span className="text-accent-text">Report</span>
                    </span>
                    <Progress
                      value={a.acknowledged}
                      max={Math.max(a.audienceSize, 1)}
                      tone={pct === 100 ? "success" : "accent"}
                      size="sm"
                    />
                  </button>
                ) : (
                  <span className="hidden text-small text-subtle md:block md:w-[200px]">
                    No read confirmation
                  </span>
                )}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Actions for ${a.title}`}
                      className="absolute right-2 top-3 md:static"
                    >
                      <Ellipsis aria-hidden />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onSelect={() => openEdit(a)}>
                      <Pencil aria-hidden />
                      Edit
                    </DropdownMenuItem>
                    {a.mustAcknowledge ? (
                      <DropdownMenuItem onSelect={() => setReporting(a)}>
                        <ClipboardCheck aria-hidden />
                        Read report
                      </DropdownMenuItem>
                    ) : null}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem destructive onSelect={() => setDeleting(a)}>
                      <Trash2 aria-hidden />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState
          icon={<Megaphone />}
          title="No announcements"
          description="Post one when everyone needs to know something today, like a policy change or an office closure."
          action={
            <Button onClick={openNew}>
              <Plus aria-hidden />
              New announcement
            </Button>
          }
        />
      )}

      <Sheet open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <SheetContent className="sm:max-w-[520px]" aria-describedby={undefined}>
          {editing ? (
            <AnnouncementEditor
              key={editing.id ?? "new"}
              draft={editing}
              groups={groups}
              onClose={() => setEditing(null)}
            />
          ) : null}
        </SheetContent>
      </Sheet>

      {reporting ? <ReportDialog row={reporting} onClose={() => setReporting(null)} /> : null}

      <Dialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>Delete this announcement?</DialogTitle>
            <DialogDescription>
              It comes off everyone&apos;s home page, and its read confirmations are deleted with
              it.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setDeleting(null)}>
              Keep it
            </Button>
            <Button variant="danger" loading={deletePending} onClick={confirmDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
