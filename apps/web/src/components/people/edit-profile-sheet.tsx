"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, X } from "lucide-react";
import { normaliseSkills, parseWorkingHours } from "@lobby/core/people/format";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { DateField } from "@/components/ui/date-field";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { toast } from "@/components/ui/toast";
import { updateProfileAction } from "@/app/(app)/people/_actions";
import { cn } from "@/lib/cn";
import { ComboField, type ComboOption } from "./combo-field";
import { DayBand } from "./day-track";

export interface EditableProfile {
  id: string;
  displayName: string;
  pronouns: string | null;
  bio: string | null;
  skills: string[];
  timezone: string | null;
  workingHours: string | null;
  phone: string | null;
  avatarUrl: string | null;
  title: string | null;
  department: string | null;
  location: string | null;
  managerId: string | null;
  startDate: string | null;
  endDate: string | null;
}

const toHHMM = (min: number) => `${String(Math.floor(min / 60) % 24).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

let zoneCache: ComboOption[] | null = null;
function timezoneOptions(): ComboOption[] {
  if (zoneCache) return zoneCache;
  const zones = typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : ["UTC", "Europe/London"];
  const now = new Date();
  zoneCache = zones.map((z) => {
    let offset = "";
    try {
      offset =
        new Intl.DateTimeFormat("en-GB", { timeZone: z, timeZoneName: "shortOffset" })
          .formatToParts(now)
          .find((p) => p.type === "timeZoneName")?.value ?? "";
    } catch {
      /* ignore */
    }
    return { value: z, label: z.replace(/_/g, " "), hint: offset };
  });
  return zoneCache;
}

/** The "Edit profile" sheet. People edit their personal fields; admins also see job and reporting fields. */
export function EditProfileSheet({
  profile,
  admin,
  isSelf,
  managers,
}: {
  profile: EditableProfile;
  admin: boolean;
  isSelf: boolean;
  /** Manager options (admin only). */
  managers: ComboOption[];
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, start] = React.useTransition();
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const hours = parseWorkingHours(profile.workingHours);

  const [form, setForm] = React.useState(() => initial(profile, hours));
  const [skillDraft, setSkillDraft] = React.useState("");
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));

  const reset = () => {
    setForm(initial(profile, hours));
    setErrors({});
    setSkillDraft("");
  };

  const addSkill = () => {
    if (!skillDraft.trim()) return;
    set("skills", normaliseSkills([...form.skills, ...skillDraft.split(",")]));
    setSkillDraft("");
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const pendingSkills = skillDraft.trim() ? normaliseSkills([...form.skills, ...skillDraft.split(",")]) : form.skills;
    const workingHours = form.hoursStart && form.hoursEnd ? `${form.hoursStart}-${form.hoursEnd}` : "";
    if ((form.hoursStart && !form.hoursEnd) || (!form.hoursStart && form.hoursEnd)) {
      setErrors({ workingHours: "Add both a start and an end time, or leave both empty." });
      return;
    }
    const patch = {
      pronouns: form.pronouns,
      bio: form.bio,
      skills: pendingSkills,
      timezone: form.timezone,
      workingHours,
      phone: form.phone,
      avatarUrl: form.avatarUrl,
      ...(admin
        ? {
            displayName: form.displayName,
            title: form.title,
            department: form.department,
            location: form.location,
            managerId: form.managerId,
            startDate: form.startDate,
            endDate: form.endDate,
          }
        : {}),
    };
    start(async () => {
      const res = await updateProfileAction(profile.id, patch);
      if (res.ok) {
        setErrors({});
        setOpen(false);
        toast.success(isSelf ? "Your profile is updated" : `${profile.displayName}'s profile is updated`);
        router.refresh();
      } else if (res.errors) {
        setErrors(res.errors);
        toast.error("A few fields need another look.");
      } else {
        toast.error(res.error ?? "That did not save.");
      }
    });
  };

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) reset();
      }}
    >
      <SheetTrigger asChild>
        <Button variant="secondary" size="sm">
          <Pencil aria-hidden />
          Edit profile
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="max-w-[480px]">
        <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col" noValidate>
          <SheetHeader>
            <SheetTitle>{isSelf ? "Edit your profile" : `Edit ${profile.displayName}`}</SheetTitle>
            <SheetDescription>
              {admin && !isSelf
                ? "Changes show up across Lobby straight away and are recorded in the audit log."
                : "Help people know who you are and when to reach you."}
            </SheetDescription>
          </SheetHeader>
          <SheetBody className="flex flex-col gap-5">
            <Preview
              id={profile.id}
              name={(admin ? form.displayName : profile.displayName) || profile.displayName}
              pronouns={form.pronouns}
              title={admin ? form.title : (profile.title ?? "")}
              skills={form.skills}
              avatarUrl={/^https:\/\/\S+$/.test(form.avatarUrl) ? form.avatarUrl : null}
            />
            {admin ? (
              <>
                <fieldset className="flex flex-col gap-4">
                  <legend className="mb-3 text-body font-medium text-fg">Job</legend>
                  <Field label="Full name" error={errors.displayName} required>
                    <Input value={form.displayName} onChange={(e) => set("displayName", e.target.value)} autoComplete="off" />
                  </Field>
                  <Field label="Job title" error={errors.title}>
                    <Input value={form.title} onChange={(e) => set("title", e.target.value)} />
                  </Field>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Field label="Department" error={errors.department}>
                      <Input value={form.department} onChange={(e) => set("department", e.target.value)} />
                    </Field>
                    <Field label="Location" error={errors.location}>
                      <Input value={form.location} onChange={(e) => set("location", e.target.value)} />
                    </Field>
                  </div>
                  <Field label="Manager" error={errors.managerId} controlId="edit-manager">
                    <ComboField
                      id="edit-manager"
                      options={managers.filter((m) => m.value !== profile.id)}
                      value={form.managerId}
                      onChange={(v) => set("managerId", v)}
                      placeholder="No manager"
                      searchPlaceholder="Search people"
                      clearLabel="No manager"
                      invalid={!!errors.managerId}
                    />
                  </Field>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Field label="Start date" error={errors.startDate}>
                      <DateField name="startDate" value={form.startDate} max={form.endDate || undefined} onValueChange={(v) => set("startDate", v)} placeholder="No start date" />
                    </Field>
                    <Field label="Last day" error={errors.endDate} help="Only for people leaving.">
                      <DateField name="endDate" value={form.endDate} min={form.startDate || undefined} onValueChange={(v) => set("endDate", v)} placeholder="Still here" />
                    </Field>
                  </div>
                </fieldset>
                <Separator />
              </>
            ) : null}

            <fieldset className="flex flex-col gap-4">
              {admin ? <legend className="mb-3 text-body font-medium text-fg">About</legend> : null}
              <Field label="Pronouns" error={errors.pronouns} help="For example she/her, he/him or they/them.">
                <Input value={form.pronouns} onChange={(e) => set("pronouns", e.target.value)} maxLength={40} />
              </Field>
              <Field label="Bio" error={errors.bio} aside={<span className="tabular text-caption">{form.bio.length}/1200</span>}>
                <Textarea
                  value={form.bio}
                  onChange={(e) => set("bio", e.target.value)}
                  rows={5}
                  maxLength={1200}
                  placeholder="What you work on, what people can ask you about, something you enjoy outside work."
                />
              </Field>
              <div className="flex flex-col gap-1.5">
                <Field label="Skills" error={errors.skills} help="Press Enter or comma after each one. People can search for these.">
                  <Input
                    value={skillDraft}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v.endsWith(",")) {
                        set("skills", normaliseSkills([...form.skills, v.slice(0, -1)]));
                        setSkillDraft("");
                      } else setSkillDraft(v);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addSkill();
                      } else if (e.key === "Backspace" && !skillDraft && form.skills.length) {
                        set("skills", form.skills.slice(0, -1));
                      }
                    }}
                    placeholder="Postgres, hiring, public speaking"
                    trailing={
                      // Always render the trailing slot: swapping it in and out remounts the input and drops focus.
                      <button
                        type="button"
                        onClick={addSkill}
                        tabIndex={skillDraft.trim() ? 0 : -1}
                        aria-hidden={!skillDraft.trim() || undefined}
                        className={cn("focus-ring pointer-events-auto rounded-[4px] p-0.5 text-muted hover:text-fg", !skillDraft.trim() && "invisible")}
                        aria-label="Add skill"
                      >
                        <Plus />
                      </button>
                    }
                  />
                </Field>
                {form.skills.length ? (
                  <ul className="flex flex-wrap gap-1.5" aria-label="Skills">
                    {form.skills.map((s) => (
                      <li key={s} className="cell inline-flex h-8 items-center gap-1 rounded-full pl-3 pr-1 text-small font-medium text-fg">
                        {s}
                        <button
                          type="button"
                          onClick={() => set("skills", form.skills.filter((x) => x !== s))}
                          className="focus-ring touch-target inline-flex size-6 items-center justify-center rounded-full text-muted hover:bg-hover hover:text-fg"
                          aria-label={`Remove ${s}`}
                        >
                          <X className="size-3" aria-hidden />
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </fieldset>

            <Separator />

            <fieldset className="flex flex-col gap-4">
              <legend className="mb-3 text-body font-medium text-fg">Contact and hours</legend>
              <Field label="Time zone" error={errors.timezone} controlId="edit-timezone">
                <ComboField
                  id="edit-timezone"
                  options={timezoneOptions()}
                  value={form.timezone}
                  onChange={(v) => set("timezone", v)}
                  placeholder="Pick a time zone"
                  searchPlaceholder="Search a city or zone"
                  clearLabel="Not set"
                  invalid={!!errors.timezone}
                />
              </Field>
              <div className="flex flex-col gap-1.5">
                <span className="text-small font-medium text-fg" id="edit-hours-label">
                  Working hours
                </span>
                <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2" role="group" aria-labelledby="edit-hours-label">
                  <Input type="time" aria-label="Start time" value={form.hoursStart} onChange={(e) => set("hoursStart", e.target.value)} aria-invalid={!!errors.workingHours || undefined} />
                  <span className="text-small text-muted">to</span>
                  <Input type="time" aria-label="End time" value={form.hoursEnd} onChange={(e) => set("hoursEnd", e.target.value)} aria-invalid={!!errors.workingHours || undefined} />
                </div>
                {errors.workingHours ? (
                  <p className="text-small text-danger-text">{errors.workingHours}</p>
                ) : (
                  <p className="text-small text-muted">In {isSelf ? "your" : "their"} own time zone. Shown on the profile so people know when to expect a reply.</p>
                )}
                {/* A live preview of the day these hours draw on the profile. */}
                <div className="mt-2 shrink-0 rounded-card bg-sunken/70 px-3.5 pb-2.5 pt-3 shadow-inset">
                  <DayBand
                    timezone={form.timezone || null}
                    workingHours={form.hoursStart && form.hoursEnd ? `${form.hoursStart}-${form.hoursEnd}` : null}
                    viewerTimezone={form.timezone || null}
                    name={isSelf ? null : profile.displayName.split(/\s+/)[0] ?? null}
                  />
                </div>
              </div>
              <Field label="Phone" error={errors.phone}>
                <Input type="tel" value={form.phone} onChange={(e) => set("phone", e.target.value)} autoComplete="tel" placeholder="+44 20 7946 0000" />
              </Field>
              <Field label="Photo address" error={errors.avatarUrl} help="An https:// link to a square image. Leave empty to keep the generated avatar.">
                <Input type="url" value={form.avatarUrl} onChange={(e) => set("avatarUrl", e.target.value)} placeholder="https://" />
              </Field>
            </fieldset>
            {errors.form ? <p className="text-small text-danger-text">{errors.form}</p> : null}
          </SheetBody>
          <SheetFooter>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" loading={pending}>
              Save changes
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

/** "How people see you": the profile's identity line, updating as the form changes. */
function Preview({ id, name, pronouns, title, skills, avatarUrl }: { id: string; name: string; pronouns: string; title: string; skills: string[]; avatarUrl: string | null }) {
  return (
    <section aria-label="Preview" className="relative isolate flex shrink-0 items-center gap-3.5 overflow-hidden rounded-card bg-raised p-3.5 shadow-cell">
      <Avatar name={name} seed={id} src={avatarUrl} size="xl" className="size-14" aria-hidden />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="flex min-w-0 items-baseline gap-2">
          <span className="truncate text-body-lg font-medium text-fg">{name}</span>
          {pronouns.trim() ? <span className="shrink-0 text-small text-muted">{pronouns.trim()}</span> : null}
        </p>
        <p className="truncate text-small text-muted">{title.trim() || "No title yet"}</p>
        {skills.length ? (
          <p className="flex min-w-0 items-center gap-1" aria-label="Skills">
            {skills.slice(0, 2).map((s) => (
              <span key={s} className="min-w-0 max-w-[45%] truncate rounded-full bg-sunken px-2 py-0.5 text-caption text-muted">
                {s}
              </span>
            ))}
            {skills.length > 2 ? <span className="shrink-0 px-1 py-0.5 text-caption text-muted">+{skills.length - 2}</span> : null}
          </p>
        ) : null}
      </div>
      <span className="shrink-0 self-start text-caption text-muted">Preview</span>
    </section>
  );
}

function initial(p: EditableProfile, hours: { start: number; end: number } | null) {
  return {
    displayName: p.displayName,
    pronouns: p.pronouns ?? "",
    bio: p.bio ?? "",
    skills: p.skills,
    timezone: p.timezone ?? "",
    hoursStart: hours ? toHHMM(hours.start) : "",
    hoursEnd: hours ? toHHMM(hours.end) : "",
    phone: p.phone ?? "",
    avatarUrl: p.avatarUrl ?? "",
    title: p.title ?? "",
    department: p.department ?? "",
    location: p.location ?? "",
    managerId: p.managerId ?? "",
    startDate: p.startDate ?? "",
    endDate: p.endDate ?? "",
  };
}
