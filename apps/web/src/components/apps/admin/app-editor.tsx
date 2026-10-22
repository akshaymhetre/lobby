"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { hasPlaceholder, monogram, safeLaunchUrl } from "@lobby/core/apps/logic";
import { LAUNCH_TYPE_INFO, type LaunchType } from "@lobby/core/apps/presets";
import { saveAppAction } from "@/app/(app)/admin/apps/_actions";
import { Chip } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { cn } from "@/lib/cn";
import { AppIcon, type AppIconData } from "../app-icon";
import type { Option, PresetOption } from "./apps-admin";

export interface EditorValues {
  id?: string;
  name: string;
  description: string;
  category: string;
  /** "preset:<key>" for a brand glyph, an https image URL, or "" for a monogram. */
  iconKey: string;
  color: string;
  launchUrl: string;
  launchType: LaunchType;
  ownerId: string | null;
  requestAccessEnabled: boolean;
  groupIds: string[];
  presetKey: string | null;
  urlHint?: string;
}

const MONOGRAM = "monogram";
const IMAGE = "image";

export function AppEditor({
  values,
  onClose,
  categories,
  groups,
  people,
  presets,
  glyphs,
}: {
  values: EditorValues | null;
  onClose: () => void;
  categories: string[];
  groups: Option[];
  people: Option[];
  presets: PresetOption[];
  glyphs: Record<string, AppIconData>;
}) {
  return (
    <Sheet open={!!values} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="sm:max-w-[520px]" aria-describedby={undefined}>
        {values ? (
          <EditorForm
            key={values.id ?? `new-${values.presetKey}`}
            initial={values}
            onClose={onClose}
            categories={categories}
            groups={groups}
            people={people}
            presets={presets}
            glyphs={glyphs}
          />
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function EditorForm({
  initial,
  onClose,
  categories,
  groups,
  people,
  presets,
  glyphs,
}: {
  initial: EditorValues;
  onClose: () => void;
  categories: string[];
  groups: Option[];
  people: Option[];
  presets: PresetOption[];
  glyphs: Record<string, AppIconData>;
}) {
  const router = useRouter();
  const [v, setV] = React.useState<EditorValues>(initial);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [pending, startTransition] = React.useTransition();
  const set = <K extends keyof EditorValues>(k: K, val: EditorValues[K]) => {
    setV((p) => ({ ...p, [k]: val }));
    setErrors((e) => {
      if (!e[k as string]) return e;
      const next = { ...e };
      delete next[k as string];
      return next;
    });
  };

  const iconMode = v.iconKey.startsWith("preset:") ? v.iconKey : v.iconKey ? IMAGE : MONOGRAM;
  const preview: AppIconData =
    iconMode === MONOGRAM
      ? {
          kind: "monogram",
          letters: monogram(v.name || "App"),
          color: /^#[0-9a-f]{6}$/i.test(v.color) ? v.color : null,
        }
      : iconMode === IMAGE
        ? v.iconKey.startsWith("https://")
          ? { kind: "image", url: v.iconKey }
          : { kind: "monogram", letters: monogram(v.name || "App"), color: null }
        : (glyphs[v.iconKey] ?? {
            kind: "monogram",
            letters: monogram(v.name || "App"),
            color: null,
          });

  const urlProblem = !v.launchUrl.trim()
    ? null
    : hasPlaceholder(v.launchUrl)
      ? "Replace the part in curly brackets with your company's own value."
      : !safeLaunchUrl(v.launchUrl)
        ? "Use a full web address that starts with https:// or http://."
        : null;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (urlProblem) {
      setErrors((x) => ({ ...x, launchUrl: urlProblem }));
      return;
    }
    startTransition(async () => {
      const res = await saveAppAction({
        id: v.id,
        name: v.name,
        description: v.description,
        category: v.category,
        icon: v.iconKey,
        color: v.color,
        launchUrl: v.launchUrl,
        launchType: v.launchType,
        ownerId: v.ownerId,
        requestAccessEnabled: v.requestAccessEnabled,
        groupIds: v.groupIds,
        presetKey: v.presetKey,
      });
      if (!res.ok) {
        setErrors(res.fieldErrors ?? {});
        if (!res.fieldErrors) toast.error(res.error);
        return;
      }
      toast.success(v.id ? `Saved ${v.name}` : `Added ${v.name}`, {
        description: v.groupIds.length
          ? "Only the groups you picked can see it."
          : "Everyone can see it in their launcher.",
      });
      onClose();
      router.refresh();
    });
  };

  const categoryListId = React.useId();

  return (
    <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col" noValidate>
      <SheetHeader>
        <div className="flex items-center gap-3">
          <AppIcon icon={preview} />
          <div className="flex min-w-0 flex-col">
            <SheetTitle className="truncate">
              {v.id ? `Edit ${initial.name}` : `Add ${v.name || "an app"}`}
            </SheetTitle>
            <SheetDescription>
              {v.id ? "Changes apply to everyone straight away." : "Fill in how people reach it."}
            </SheetDescription>
          </div>
        </div>
      </SheetHeader>
      <SheetBody className="flex flex-col gap-5">
        <Field label="Name" error={errors.name} required>
          <Input
            value={v.name}
            onChange={(e) => set("name", e.target.value)}
            maxLength={80}
            autoFocus={!v.id}
          />
        </Field>
        <Field
          label="Short description"
          help="One line about what people use it for."
          error={errors.description}
        >
          <Input
            value={v.description}
            onChange={(e) => set("description", e.target.value)}
            maxLength={200}
          />
        </Field>
        <Field
          label="Category"
          help="Tiles are grouped by category in the launcher."
          error={errors.category}
          required
        >
          <Input
            value={v.category}
            onChange={(e) => set("category", e.target.value)}
            list={categoryListId}
            maxLength={40}
          />
        </Field>
        <datalist id={categoryListId}>
          {categories.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>

        <div className="flex flex-col gap-3">
          <Field label="Icon" controlId="app-icon-select" error={errors.icon}>
            <Select
              value={iconMode}
              onValueChange={(val) => {
                if (val === MONOGRAM) set("iconKey", "");
                else if (val === IMAGE) set("iconKey", "https://");
                else set("iconKey", val);
              }}
            >
              <SelectTrigger id="app-icon-select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={MONOGRAM}>Letters in a brand colour</SelectItem>
                <SelectItem value={IMAGE}>Image from a web address</SelectItem>
                {presets
                  .filter((p) => glyphs[`preset:${p.key}`])
                  .map((p) => (
                    <SelectItem key={p.key} value={`preset:${p.key}`}>
                      {p.name} logo
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </Field>
          {iconMode === MONOGRAM ? (
            <div className="flex items-center gap-3">
              <input
                type="color"
                aria-label="Monogram colour"
                value={/^#[0-9a-f]{6}$/i.test(v.color) ? v.color : "#6b675f"}
                onChange={(e) => set("color", e.target.value)}
                className="focus-ring h-9 w-12 cursor-pointer rounded-control bg-raised p-1 shadow-inset dark:bg-sunken"
              />
              <Input
                value={v.color}
                onChange={(e) => set("color", e.target.value)}
                aria-label="Monogram colour as hex"
                placeholder="#2A5FE6"
                className="w-32 font-mono"
                aria-invalid={errors.color ? true : undefined}
              />
              {errors.color ? (
                <span className="text-small text-danger-text">{errors.color}</span>
              ) : null}
            </div>
          ) : iconMode === IMAGE ? (
            <Input
              value={v.iconKey}
              onChange={(e) => set("iconKey", e.target.value)}
              aria-label="Icon image address"
              placeholder="https://..."
            />
          ) : null}
        </div>

        <Field
          label="Launch address"
          help={
            v.urlHint ??
            "The page people land on. For single sign-on, use the app's own login address."
          }
          error={
            errors.launchUrl ?? (v.launchUrl.length > 8 ? (urlProblem ?? undefined) : undefined)
          }
          required
        >
          <Input
            value={v.launchUrl}
            onChange={(e) => set("launchUrl", e.target.value)}
            inputMode="url"
            spellCheck={false}
          />
        </Field>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-small font-medium text-fg">How people sign in</legend>
          <RadioGroup
            value={v.launchType}
            onValueChange={(val) => set("launchType", val as LaunchType)}
            className="gap-2"
          >
            {(Object.keys(LAUNCH_TYPE_INFO) as LaunchType[]).map((t) => (
              <label
                key={t}
                className={cn(
                  "cell flex cursor-pointer items-start gap-3 rounded-card px-3.5 py-3 transition-[box-shadow,background-color] duration-160 ease-standard hover:shadow-cell-hover",
                  v.launchType === t && "bg-accent-soft/50 outline-2 -outline-offset-2 outline-accent dark:bg-accent-soft/30",
                )}
              >
                <RadioGroupItem value={t} className="mt-0.5" aria-describedby={`lt-${t}`} />
                <span className="flex flex-col gap-0.5">
                  <span className="text-body font-medium text-fg">{LAUNCH_TYPE_INFO[t].label}</span>
                  <span id={`lt-${t}`} className="text-small text-muted">
                    {LAUNCH_TYPE_INFO[t].explain}
                  </span>
                </span>
              </label>
            ))}
          </RadioGroup>
        </fieldset>

        <div className="flex flex-col gap-2">
          <Label id="visible-to-label">Who can see it</Label>
          <div className="flex flex-wrap gap-2" role="group" aria-labelledby="visible-to-label">
            <Chip selected={v.groupIds.length === 0} onClick={() => set("groupIds", [])}>
              Everyone
            </Chip>
            {groups.map((g) => {
              const on = v.groupIds.includes(g.id);
              return (
                <Chip
                  key={g.id}
                  selected={on}
                  onClick={() =>
                    set(
                      "groupIds",
                      on ? v.groupIds.filter((x) => x !== g.id) : [...v.groupIds, g.id],
                    )
                  }
                >
                  {g.name}
                </Chip>
              );
            })}
          </div>
          <p className="text-small text-muted">
            {v.groupIds.length
              ? "Only members of these groups see the tile. Everyone else can ask for access if you allow it below."
              : "Every signed-in person sees the tile."}
          </p>
        </div>

        <Field
          label="Owner"
          controlId="app-owner"
          help="The person who approves access and answers questions."
        >
          <Select
            value={v.ownerId ?? "none"}
            onValueChange={(val) => set("ownerId", val === "none" ? null : val)}
          >
            <SelectTrigger id="app-owner">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No owner</SelectItem>
              {people.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                  {p.title ? ` · ${p.title}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <div className="flex items-start justify-between gap-4 rounded-cell bg-sunken/60 px-3.5 py-3">
          <div className="flex flex-col gap-0.5">
            <Label htmlFor="request-access">Let people ask for access</Label>
            <p className="text-small text-muted">
              People who cannot see it get a Request access button that opens a Help request.
            </p>
          </div>
          <Switch
            id="request-access"
            checked={v.requestAccessEnabled}
            onCheckedChange={(c) => set("requestAccessEnabled", c)}
            className="mt-0.5"
          />
        </div>
      </SheetBody>
      <SheetFooter>
        <Button variant="secondary" type="button" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" loading={pending}>
          {v.id ? "Save changes" : "Add app"}
        </Button>
      </SheetFooter>
    </form>
  );
}
