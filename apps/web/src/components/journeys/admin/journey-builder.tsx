"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Check, ChevronDown, GripVertical, ListChecks, MoreHorizontal, Plus, Trash2, X } from "lucide-react";
import type { BuilderOptions, EditableJourney, EditableStep } from "@lobby/core/journeys";
import type { JourneyFormQuestion, JourneyStepConfig } from "@lobby/db/schema";
import { describeOffset, phaseFor } from "@lobby/core/journeys/dates";
import { ASSIGNEE_LABELS, OFFBOARDING_ASSIGNEE_LABELS, type AssigneeKind } from "@lobby/core/journeys/rules";
import { Badge } from "@/components/ui/badge";
import { Breadcrumb, PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { saveJourneyAction } from "@/app/(app)/admin/journeys/_actions";
import { STEP_TYPE_META, StepIcon } from "../step-icon";
import { DeleteJourneyButton, StartForPersonButton } from "./journey-actions";
import { MultiSelect, OffsetInput, PersonSelect } from "./pickers";
import { JourneyPreview } from "./journey-preview";

type DraftStep = EditableStep & { key: string; isNew: boolean };
type StepType = EditableStep["type"];

let counter = 0;
const newKey = () => `new-${Date.now().toString(36)}-${counter++}`;

const STEP_TYPES = Object.keys(STEP_TYPE_META) as StepType[];
const ASSIGNEES: AssigneeKind[] = ["subject", "manager", "buddy", "it", "people", "specific"];

function blankStep(kind: "onboarding" | "offboarding"): DraftStep {
  return {
    key: newKey(),
    isNew: true,
    id: "",
    title: "",
    description: "",
    type: "task",
    dayOffset: kind === "offboarding" ? -3 : 0,
    assignee: "subject",
    assigneeUserId: null,
    config: {},
  };
}

export function JourneyBuilder({
  initial,
  options,
  workingDays,
  defaultPreviewDate,
}: {
  initial: EditableJourney;
  options: BuilderOptions;
  workingDays: number[];
  defaultPreviewDate: string;
}) {
  const router = useRouter();
  const [name, setName] = React.useState(initial.name);
  const [description, setDescription] = React.useState(initial.description);
  const [kind, setKind] = React.useState(initial.kind);
  const [active, setActive] = React.useState(initial.active);
  const [departments, setDepartments] = React.useState(initial.conditions.departments ?? []);
  const [locations, setLocations] = React.useState(initial.conditions.locations ?? []);
  const [groupIds, setGroupIds] = React.useState(initial.conditions.groupIds ?? []);
  const [steps, setSteps] = React.useState<DraftStep[]>(() => initial.steps.map((s) => ({ ...s, key: s.id, isNew: false })));
  const [expanded, setExpanded] = React.useState<string | null>(null);
  const [errors, setErrors] = React.useState<{ name?: string; form?: string; steps: Record<string, string> }>({ steps: {} });
  const [saving, startSaving] = React.useTransition();
  const [dirty, setDirty] = React.useState(!initial.id);
  const [dragKey, setDragKey] = React.useState<string | null>(null);
  const [overKey, setOverKey] = React.useState<string | null>(null);
  const [announce, setAnnounce] = React.useState("");
  const stepRefs = React.useRef(new Map<string, HTMLElement>());

  const touch = () => setDirty(true);

  React.useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const updateStep = (key: string, patch: Partial<DraftStep>) => {
    setSteps((all) => all.map((s) => (s.key === key ? { ...s, ...patch } : s)));
    setErrors((e) => ({ ...e, steps: { ...e.steps, [key]: "" } }));
    touch();
  };
  const updateConfig = (key: string, patch: Partial<JourneyStepConfig>) => {
    setSteps((all) => all.map((s) => (s.key === key ? { ...s, config: { ...s.config, ...patch } } : s)));
    setErrors((e) => ({ ...e, steps: { ...e.steps, [key]: "" } }));
    touch();
  };

  /** Puts a step at a new index. The drag handle, its arrow keys and the row menu all end here. */
  const moveTo = (key: string, to: number) => {
    const i = steps.findIndex((s) => s.key === key);
    const j = Math.max(0, Math.min(steps.length - 1, to));
    if (i < 0 || i === j) return;
    const next = [...steps];
    const [item] = next.splice(i, 1);
    next.splice(j, 0, item!);
    setSteps(next);
    touch();
    setAnnounce(`Moved "${item!.title || "Untitled step"}" to position ${j + 1} of ${next.length}.`);
    // Keep focus on the handle that moved, so keyboard reordering can continue.
    requestAnimationFrame(() => stepRefs.current.get(key)?.querySelector<HTMLButtonElement>("[data-handle]")?.focus());
  };
  const move = (key: string, dir: -1 | 1) => moveTo(key, steps.findIndex((s) => s.key === key) + dir);

  const onHandleKey = (key: string, i: number) => (e: React.KeyboardEvent) => {
    const map: Record<string, number | undefined> = { ArrowUp: i - 1, ArrowDown: i + 1, Home: 0, End: steps.length - 1 };
    const to = map[e.key];
    if (to === undefined) return;
    e.preventDefault();
    moveTo(key, to);
  };

  const dropOn = (key: string) => {
    if (dragKey && dragKey !== key) moveTo(dragKey, steps.findIndex((s) => s.key === key));
    setDragKey(null);
    setOverKey(null);
  };

  const remove = (key: string) => {
    const idx = steps.findIndex((s) => s.key === key);
    const removed = steps[idx];
    setSteps((all) => all.filter((s) => s.key !== key));
    touch();
    if (removed) {
      toast(`Removed "${removed.title || "Untitled step"}"`, {
        action: { label: "Undo", onClick: () => setSteps((all) => [...all.slice(0, idx), removed, ...all.slice(idx)]) },
      });
    }
  };

  const add = () => {
    const s = blankStep(kind);
    setSteps((all) => [...all, s]);
    setExpanded(s.key);
    touch();
    requestAnimationFrame(() => stepRefs.current.get(s.key)?.querySelector<HTMLInputElement>("input")?.focus());
  };

  const save = () =>
    startSaving(async () => {
      if (!name.trim()) {
        setErrors({ name: "Give the journey a name.", steps: {} });
        return;
      }
      const res = await saveJourneyAction({
        id: initial.id,
        name,
        description,
        kind,
        active,
        conditions: { departments, locations, groupIds },
        steps: steps.map((s) => ({
          id: s.isNew ? undefined : s.id,
          title: s.title,
          description: s.description,
          type: s.type,
          dayOffset: s.dayOffset,
          assignee: s.assignee,
          assigneeUserId: s.assigneeUserId,
          config: s.config,
        })),
      });
      if (!res.ok) {
        const byKey: Record<string, string> = {};
        for (const [i, msg] of Object.entries(res.stepErrors ?? {})) {
          const st = steps[Number(i)];
          if (st) byKey[st.key] = msg;
        }
        setErrors({ form: res.error, steps: byKey });
        const first = Object.keys(byKey)[0];
        if (first) setExpanded(first);
        toast.error(res.error);
        return;
      }
      setErrors({ steps: {} });
      setDirty(false);
      toast.success(initial.id ? "Journey saved" : "Journey created");
      if (!initial.id) router.replace(`/admin/journeys/${res.id}`);
      else router.refresh();
    });

  const labels = kind === "offboarding" ? OFFBOARDING_ASSIGNEE_LABELS : ASSIGNEE_LABELS;
  const pagesBySpace = React.useMemo(() => {
    const m = new Map<string, { name: string; pages: BuilderOptions["pages"] }>();
    for (const p of options.pages) {
      const g = m.get(p.spaceSlug) ?? { name: p.spaceName, pages: [] };
      g.pages.push(p);
      m.set(p.spaceSlug, g);
    }
    return [...m.entries()];
  }, [options.pages]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        className="pb-0"
        breadcrumb={<Breadcrumb items={[{ label: "Journeys", href: "/admin/journeys" }, { label: initial.id ? initial.name : "New journey" }]} />}
        title={initial.id ? initial.name : "New journey"}
        description={
          initial.id && initial.activeRuns
            ? `${initial.activeRuns} ${initial.activeRuns === 1 ? "person is" : "people are"} on this journey. Changes apply to people who start it from now on.`
            : "Steps are due relative to the person's start date, or their last day for offboarding."
        }
        actions={
          <>
            {initial.id ? (
              <>
                <DeleteJourneyButton id={initial.id} name={initial.name} hasRuns={initial.activeRuns > 0} />
                <StartForPersonButton journeyId={initial.id} journeyName={initial.name} kind={kind} people={options.people} disabled={dirty} />
              </>
            ) : null}
            {initial.id && !dirty ? (
              <span role="status" className="inline-flex h-10 items-center gap-1.5 px-1 text-small font-medium text-success-text md:h-9">
                <Check className="size-4 stroke-[2]" aria-hidden />
                Saved
              </span>
            ) : (
              <Button onClick={save} loading={saving}>
                {initial.id ? "Save changes" : "Create journey"}
              </Button>
            )}
          </>
        }
      />

      <div className="grid gap-10 xl:grid-cols-[minmax(0,760px)_minmax(320px,1fr)] xl:gap-12">
        <div className="@container section-stack min-w-0">
          <section aria-labelledby="details-heading" className="panel flex flex-col gap-5 rounded-panel p-5 md:p-6">
            <h2 id="details-heading" className="text-h4 font-medium text-fg">
              Details
            </h2>
            <div className="grid gap-5 @lg:grid-cols-[minmax(0,1fr)_auto]">
              <Field label="Name" required error={errors.name}>
                <Input
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    setErrors((er) => ({ ...er, name: undefined }));
                    touch();
                  }}
                  placeholder="For example: Welcome to Northwind"
                  maxLength={120}
                />
              </Field>
              <div className="flex flex-col gap-1.5">
                <Label id="kind-label">Kind</Label>
                <SegmentedControl
                  aria-label="Kind"
                  value={kind}
                  onValueChange={(v) => {
                    setKind(v as typeof kind);
                    touch();
                  }}
                  options={[
                    { value: "onboarding", label: "Onboarding" },
                    { value: "offboarding", label: "Offboarding" },
                  ]}
                  className="self-start"
                />
              </div>
            </div>
            <Field label="Description" help="Shown to the People team and on each person's journey.">
              <Textarea
                rows={2}
                value={description}
                onChange={(e) => {
                  setDescription(e.target.value);
                  touch();
                }}
                maxLength={1000}
              />
            </Field>
            <div className="flex flex-col gap-3 border-t border-border pt-5">
              <div className="flex flex-col gap-0.5">
                <h3 className="text-body font-medium text-fg">Who it is for</h3>
                <p className="text-small text-muted">Leave everything empty for everyone. Within a box, anyone listed matches; across boxes, all must match.</p>
              </div>
              <div className="grid gap-4 @2xl:grid-cols-3">
                <Field label="Departments" controlId="cond-dept">
                  <MultiSelect
                    id="cond-dept"
                    options={options.departments.map((d) => ({ value: d, label: d }))}
                    value={departments}
                    onChange={(v) => {
                      setDepartments(v);
                      touch();
                    }}
                    placeholder="Any department"
                  />
                </Field>
                <Field label="Locations" controlId="cond-loc">
                  <MultiSelect
                    id="cond-loc"
                    options={options.locations.map((d) => ({ value: d, label: d }))}
                    value={locations}
                    onChange={(v) => {
                      setLocations(v);
                      touch();
                    }}
                    placeholder="Any location"
                  />
                </Field>
                <Field label="Groups" controlId="cond-groups">
                  <MultiSelect
                    id="cond-groups"
                    options={options.groups.map((g) => ({ value: g.id, label: g.name }))}
                    value={groupIds}
                    onChange={(v) => {
                      setGroupIds(v);
                      touch();
                    }}
                    placeholder="Any group"
                  />
                </Field>
              </div>
              <label className="flex items-center gap-3 pt-1">
                <Switch
                  checked={active}
                  onCheckedChange={(v) => {
                    setActive(v);
                    touch();
                  }}
                />
                <span className="flex flex-col">
                  <span className="text-body text-fg">Start automatically</span>
                  <span className="text-small text-muted">
                    {kind === "offboarding" ? "Two weeks before a matching person's last day." : "Two weeks before a matching person's first day."}
                  </span>
                </span>
              </label>
            </div>
          </section>

          <section aria-labelledby="steps-heading" className="flex flex-col gap-3">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <h2 id="steps-heading" className="text-h4 font-medium text-fg">
                Steps{" "}
                <span className="tabular text-body font-normal text-muted">
                  {steps.length} {steps.length === 1 ? "step" : "steps"} ({steps.filter((x) => x.assignee === "subject").length} for the new hire)
                </span>
              </h2>
              <p id="steps-hint" className="text-small text-muted">
                Drag the handle to reorder, or press its arrow keys. Steps run by due date, then this order.
              </p>
            </div>
            <p aria-live="polite" className="sr-only">
              {announce}
            </p>

            {steps.length ? (
              <ol className="panel flex flex-col divide-y divide-border rounded-card">
                {steps.map((s, i) => {
                  const open = expanded === s.key;
                  const err = errors.steps[s.key];
                  const label = s.title || "Untitled step";
                  const phase = phaseFor(s.dayOffset, kind);
                  const assigneeName =
                    s.assigneeUserId && (s.assignee === "specific" || s.assignee === "it" || s.assignee === "people")
                      ? options.people.find((p) => p.id === s.assigneeUserId)?.name
                      : null;
                  return (
                    <li
                      key={s.key}
                      ref={(el) => {
                        if (el) stepRefs.current.set(s.key, el);
                        else stepRefs.current.delete(s.key);
                      }}
                      onDragOver={(e) => {
                        if (!dragKey) return;
                        e.preventDefault();
                        if (overKey !== s.key) setOverKey(s.key);
                      }}
                      onDragLeave={() => overKey === s.key && setOverKey(null)}
                      onDrop={(e) => {
                        e.preventDefault();
                        dropOn(s.key);
                      }}
                      className={cn(
                        "transition-colors duration-120",
                        dragKey === s.key && "opacity-50",
                        overKey === s.key && dragKey !== s.key && "bg-accent-soft/60",
                      )}
                    >
                      <div className={cn("flex min-h-14 items-center gap-1 py-1.5 pl-1.5 pr-2", err && "bg-danger-soft/40")}>
                        <button
                          type="button"
                          data-handle
                          draggable
                          onDragStart={(e) => {
                            setDragKey(s.key);
                            e.dataTransfer.effectAllowed = "move";
                            e.dataTransfer.setData("text/plain", s.key);
                            const li = stepRefs.current.get(s.key);
                            if (li) e.dataTransfer.setDragImage(li, 24, 28);
                          }}
                          onDragEnd={() => {
                            setDragKey(null);
                            setOverKey(null);
                          }}
                          onKeyDown={onHandleKey(s.key, i)}
                          aria-label={`Reorder "${label}", position ${i + 1} of ${steps.length}`}
                          aria-describedby="steps-hint"
                          className="focus-ring touch-target inline-flex size-9 shrink-0 cursor-grab items-center justify-center rounded-control text-subtle transition-colors duration-120 hover:bg-hover hover:text-muted active:cursor-grabbing md:size-8"
                        >
                          <GripVertical className="size-4 stroke-[1.5]" aria-hidden />
                        </button>
                        <span className="tabular hidden w-5 shrink-0 text-center text-caption text-subtle sm:inline">{i + 1}</span>
                        <span
                          aria-hidden
                          className={cn(
                            "mx-1 inline-flex size-9 shrink-0 items-center justify-center rounded-full [&_svg]:size-4 [&_svg]:stroke-[1.75]",
                            phase.key === "day-1" ? "bg-cat-green-soft text-cat-green-text" : kind === "onboarding" ? "bg-cat-violet-soft text-cat-violet-text" : "bg-sunken text-muted",
                          )}
                        >
                          <StepIcon type={s.type} />
                        </span>
                        <button
                          type="button"
                          onClick={() => setExpanded(open ? null : s.key)}
                          aria-expanded={open}
                          aria-controls={`step-body-${s.key}`}
                          className="focus-ring flex min-w-0 flex-1 flex-col rounded-control px-1 py-1 text-left"
                        >
                          <span className={cn("truncate text-body font-medium", s.title ? "text-fg" : "text-subtle")}>{label}</span>
                          <span className="truncate text-small text-muted">
                            {describeOffset(s.dayOffset, kind)} · {assigneeName ?? labels[s.assignee]} · {STEP_TYPE_META[s.type]?.label}
                          </span>
                        </button>
                        {err ? (
                          <Badge tone="danger" size="sm" className="hidden sm:inline-flex">
                            Needs detail
                          </Badge>
                        ) : (
                          <span
                            className={cn(
                              "hidden h-6 shrink-0 items-center rounded-full px-2.5 text-caption font-medium md:inline-flex",
                              phase.key === "day-1" ? "bg-cat-green-soft text-cat-green-text" : "bg-sunken text-muted dark:bg-surface/60",
                            )}
                          >
                            {phase.label}
                          </span>
                        )}
                        <div className="flex shrink-0 items-center">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon-sm" className="text-muted" aria-label={`More actions for "${label}"`}>
                                <MoreHorizontal />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem disabled={i === 0} onSelect={() => move(s.key, -1)}>
                                <ArrowUp />
                                Move up
                              </DropdownMenuItem>
                              <DropdownMenuItem disabled={i === steps.length - 1} onSelect={() => move(s.key, 1)}>
                                <ArrowDown />
                                Move down
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onSelect={() => remove(s.key)} className="text-danger-text">
                                <Trash2 />
                                Remove step
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                          <Button variant="ghost" size="icon-sm" onClick={() => setExpanded(open ? null : s.key)} aria-label={open ? "Collapse step" : "Edit step"} aria-expanded={open}>
                            <ChevronDown className={cn("transition-transform duration-180", open && "rotate-180")} />
                          </Button>
                        </div>
                      </div>

                      {open ? (
                        <div id={`step-body-${s.key}`} className="flex flex-col gap-4 border-t border-border p-4 sm:p-5">
                          {err ? (
                            <p role="alert" className="rounded-control bg-danger-soft px-3 py-2 text-small text-danger-text">
                              {err}
                            </p>
                          ) : null}
                          <div className="grid gap-4 @lg:grid-cols-2">
                            <Field label="Title" required help="Use {firstName} for the person's name.">
                              <Input value={s.title} onChange={(e) => updateStep(s.key, { title: e.target.value })} maxLength={200} placeholder="For example: Set up 1Password" />
                            </Field>
                            <Field label="Type" controlId={`type-${s.key}`}>
                              <Select value={s.type} onValueChange={(v) => updateStep(s.key, { type: v as StepType, config: {} })}>
                                <SelectTrigger id={`type-${s.key}`}>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {STEP_TYPES.map((t) => (
                                    <SelectItem key={t} value={t}>
                                      {STEP_TYPE_META[t]!.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </Field>
                          </div>
                          <Field label="Description" help="Optional. What good looks like, or why it matters.">
                            <Textarea rows={2} value={s.description} onChange={(e) => updateStep(s.key, { description: e.target.value })} maxLength={2000} />
                          </Field>
                          <div className="grid gap-4 @lg:grid-cols-2">
                            <Field label="When" controlId={`when-${s.key}`}>
                              <OffsetInput id={`when-${s.key}`} value={s.dayOffset} kind={kind} onChange={(v) => updateStep(s.key, { dayOffset: v })} />
                            </Field>
                            <div className="flex flex-col gap-3">
                              <Field label="Who does it" controlId={`who-${s.key}`}>
                                <Select value={s.assignee} onValueChange={(v) => updateStep(s.key, { assignee: v as AssigneeKind, assigneeUserId: null })}>
                                  <SelectTrigger id={`who-${s.key}`}>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {ASSIGNEES.map((a) => (
                                      <SelectItem key={a} value={a}>
                                        {labels[a]}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </Field>
                              {s.assignee === "specific" || s.assignee === "it" || s.assignee === "people" ? (
                                <Field
                                  label={s.assignee === "specific" ? "Person" : "Named person"}
                                  required={s.assignee === "specific"}
                                  help={s.assignee === "specific" ? undefined : `Optional. Leave empty to put it in the ${s.assignee === "it" ? "IT" : "People team"} queue.`}
                                  controlId={`person-${s.key}`}
                                >
                                  <PersonSelect
                                    id={`person-${s.key}`}
                                    people={options.people}
                                    value={s.assigneeUserId}
                                    onChange={(v) => updateStep(s.key, { assigneeUserId: v })}
                                    allowClear={s.assignee !== "specific"}
                                    clearLabel="Anyone in the queue"
                                    placeholder={s.assignee === "specific" ? "Choose a person" : "Anyone in the queue"}
                                  />
                                </Field>
                              ) : null}
                            </div>
                          </div>

                          <TypeConfig step={s} options={options} pagesBySpace={pagesBySpace} onConfig={(p) => updateConfig(s.key, p)} />

                          <div className="flex justify-end border-t border-border pt-3">
                            <Button variant="ghost" size="sm" onClick={() => remove(s.key)} className="text-danger-text">
                              <Trash2 aria-hidden />
                              Remove step
                            </Button>
                          </div>
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ol>
            ) : (
              <div className="panel flex flex-col items-center gap-3 rounded-panel px-6 py-10 text-center">
                <span className="cat-violet inline-flex size-12 items-center justify-center rounded-full shadow-cell" aria-hidden>
                  <ListChecks className="size-5 stroke-[1.75]" />
                </span>
                <div className="flex flex-col gap-1">
                  <p className="text-body-lg font-medium text-fg">No steps yet</p>
                  <p className="max-w-[46ch] text-small text-muted text-pretty">Add the first thing that should happen, for example ordering a laptop a week before day 1.</p>
                </div>
                <Button variant="secondary" onClick={add}>
                  <Plus aria-hidden />
                  Add the first step
                </Button>
              </div>
            )}

            {steps.length ? (
              <Button variant="secondary" onClick={add} className="self-start">
                <Plus aria-hidden />
                Add step
              </Button>
            ) : null}
          </section>
        </div>

        <aside className="min-w-0 xl:sticky xl:top-20 xl:self-start">
          <JourneyPreview steps={steps} kind={kind} workingDays={workingDays} defaultDate={defaultPreviewDate} labels={labels} people={options.people} />
        </aside>
      </div>
    </div>
  );
}

function TypeConfig({
  step,
  options,
  pagesBySpace,
  onConfig,
}: {
  step: DraftStep;
  options: BuilderOptions;
  pagesBySpace: [string, { name: string; pages: BuilderOptions["pages"] }][];
  onConfig: (patch: Partial<JourneyStepConfig>) => void;
}) {
  const c = step.config;
  const k = step.key;
  switch (step.type) {
    case "read_page":
    case "acknowledge_page": {
      const value = c.spaceSlug && c.pageSlug ? `${c.spaceSlug}/${c.pageSlug}` : "";
      const known = options.pages.some((p) => `${p.spaceSlug}/${p.pageSlug}` === value);
      return (
        <Field label="Page" required controlId={`page-${k}`} help={step.type === "acknowledge_page" ? "They confirm they have read it. The acknowledgement is recorded on the page." : undefined}>
          <Select
            value={value}
            onValueChange={(v) => {
              const [spaceSlug, pageSlug] = v.split("/");
              onConfig({ spaceSlug, pageSlug });
            }}
          >
            <SelectTrigger id={`page-${k}`}>
              <SelectValue placeholder={options.pages.length ? "Choose a page" : "No Knowledge pages yet"} />
            </SelectTrigger>
            <SelectContent>
              {value && !known ? <SelectItem value={value}>{value} (not published)</SelectItem> : null}
              {pagesBySpace.map(([slug, g]) => (
                <SelectGroup key={slug}>
                  <SelectLabel>{g.name}</SelectLabel>
                  {g.pages.map((p) => (
                    <SelectItem key={`${p.spaceSlug}/${p.pageSlug}`} value={`${p.spaceSlug}/${p.pageSlug}`}>
                      {p.title}
                    </SelectItem>
                  ))}
                </SelectGroup>
              ))}
            </SelectContent>
          </Select>
        </Field>
      );
    }
    case "launch_app":
      return (
        <Field label="App" required controlId={`app-${k}`}>
          <Select value={c.appSlug ?? ""} onValueChange={(v) => onConfig({ appSlug: v })}>
            <SelectTrigger id={`app-${k}`}>
              <SelectValue placeholder={options.apps.length ? "Choose an app" : "No apps in the launcher yet"} />
            </SelectTrigger>
            <SelectContent>
              {options.apps.map((a) => (
                <SelectItem key={a.slug} value={a.slug}>
                  {a.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      );
    case "meet_person": {
      const mode = c.personRole ?? (c.personId ? "person" : "");
      return (
        <div className="grid gap-4 @lg:grid-cols-2">
          <Field label="Who to meet" required controlId={`meet-${k}`}>
            <Select
              value={mode}
              onValueChange={(v) => onConfig(v === "person" ? { personRole: undefined } : { personRole: v as "manager" | "buddy", personId: undefined })}
            >
              <SelectTrigger id={`meet-${k}`}>
                <SelectValue placeholder="Choose" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="manager">Their manager</SelectItem>
                <SelectItem value="buddy">Their buddy</SelectItem>
                <SelectItem value="person">A specific person</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          {mode === "person" ? (
            <Field label="Person" required controlId={`meet-person-${k}`}>
              <PersonSelect id={`meet-person-${k}`} people={options.people} value={c.personId ?? null} onChange={(v) => onConfig({ personId: v ?? undefined, personRole: undefined })} />
            </Field>
          ) : null}
        </div>
      );
    }
    case "create_ticket":
      return (
        <div className="grid gap-4 @lg:grid-cols-2">
          <Field label="Request" required controlId={`rt-${k}`} help="Raised in the helpdesk on the person's behalf. The step completes when the ticket is resolved.">
            <Select value={c.requestTypeSlug ?? ""} onValueChange={(v) => onConfig({ requestTypeSlug: v })}>
              <SelectTrigger id={`rt-${k}`}>
                <SelectValue placeholder={options.requestTypes.length ? "Choose a request type" : "No request types yet"} />
              </SelectTrigger>
              <SelectContent>
                {c.requestTypeSlug && !options.requestTypes.some((r) => r.slug === c.requestTypeSlug) ? (
                  <SelectItem value={c.requestTypeSlug}>{c.requestTypeSlug} (not set up)</SelectItem>
                ) : null}
                {options.requestTypes.map((r) => (
                  <SelectItem key={r.slug} value={r.slug}>
                    {r.name} · {r.team}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Raise it" help="How many days before the due date the ticket is opened.">
            <Input
              type="number"
              min={0}
              max={60}
              value={c.leadDays ?? 3}
              onChange={(e) => onConfig({ leadDays: Math.max(0, Math.min(60, Number(e.target.value) || 0)) })}
              trailing={<span className="text-small">days early</span>}
            />
          </Field>
          <Field label="Ticket subject" help="Optional. Defaults to the step title. {name} works here." className="md:col-span-2">
            <Input value={c.ticketSubject ?? ""} onChange={(e) => onConfig({ ticketSubject: e.target.value })} maxLength={200} placeholder="Laptop and accounts for {name}" />
          </Field>
        </div>
      );
    case "form":
      return <QuestionsEditor questions={c.questions ?? []} onChange={(questions) => onConfig({ questions })} />;
    case "task":
      return (
        <div className="grid gap-4 @lg:grid-cols-2">
          <Field label="Link" help="Optional. A page or tool that helps.">
            <Input value={c.linkUrl ?? ""} onChange={(e) => onConfig({ linkUrl: e.target.value })} placeholder="https://" maxLength={500} />
          </Field>
          <Field label="Link label">
            <Input value={c.linkLabel ?? ""} onChange={(e) => onConfig({ linkLabel: e.target.value })} placeholder="Open link" maxLength={60} />
          </Field>
        </div>
      );
    default:
      return null;
  }
}

function QuestionsEditor({ questions, onChange }: { questions: JourneyFormQuestion[]; onChange: (q: JourneyFormQuestion[]) => void }) {
  const set = (i: number, patch: Partial<JourneyFormQuestion>) => onChange(questions.map((q, j) => (j === i ? { ...q, ...patch } : q)));
  const add = () => onChange([...questions, { key: `q${Date.now().toString(36)}`, label: "", type: "textarea" }]);
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="pb-2 text-small font-medium text-fg">Questions</legend>
      {questions.map((q, i) => (
        <div key={q.key} className="flex flex-col gap-3 rounded-cell bg-sunken p-3 dark:bg-raised">
          <div className="flex items-start gap-2">
            <Input value={q.label} onChange={(e) => set(i, { label: e.target.value })} placeholder="Question" aria-label={`Question ${i + 1}`} maxLength={200} />
            <Button variant="ghost" size="icon-sm" onClick={() => onChange(questions.filter((_, j) => j !== i))} aria-label={`Remove question ${i + 1}`}>
              <X />
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Select value={q.type} onValueChange={(v) => set(i, { type: v as JourneyFormQuestion["type"] })}>
              <SelectTrigger aria-label="Answer type" className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="textarea">Paragraph</SelectItem>
                <SelectItem value="text">Short answer</SelectItem>
                <SelectItem value="select">Choice</SelectItem>
              </SelectContent>
            </Select>
            <label className="flex items-center gap-2 text-small text-muted">
              <Switch size="sm" checked={!!q.required} onCheckedChange={(v) => set(i, { required: v })} />
              Required
            </label>
          </div>
          {q.type === "select" ? (
            <ChoicesInput value={q.options ?? []} onChange={(options) => set(i, { options })} label={`Choices for question ${i + 1}`} />
          ) : null}
        </div>
      ))}
      <Button variant="ghost" size="sm" onClick={add} className="self-start">
        <Plus aria-hidden />
        Add question
      </Button>
    </fieldset>
  );
}

/** Comma-separated choices, kept as typed until the field loses focus. */
function ChoicesInput({ value, onChange, label }: { value: string[]; onChange: (v: string[]) => void; label: string }) {
  const [text, setText] = React.useState(value.join(", "));
  const commit = (raw: string) => onChange(raw.split(",").map((o) => o.trim()).filter(Boolean));
  return (
    <Input
      value={text}
      onChange={(e) => {
        setText(e.target.value);
        commit(e.target.value);
      }}
      onBlur={() => setText(value.join(", "))}
      placeholder="Choices, separated by commas"
      aria-label={label}
    />
  );
}
