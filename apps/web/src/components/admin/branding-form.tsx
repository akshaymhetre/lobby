"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { saveBrandingAction } from "@/app/(app)/admin/_actions";
import { accentTokens, type AccentTokens } from "@lobby/core/color";
import { AccentPreview, ContrastNote } from "./accent-preview";
import { SettingsGroup } from "./settings-group";
import { StepBar } from "@/components/setup/step-nav";
import { AsideSlot } from "@/components/setup/aside-slot";
import type { SetupStep } from "@lobby/core/settings";
import { LogoUpload } from "./logo-upload";
import { FormError, fieldError, useActionFeedback } from "./form-status";
import { SaveBar } from "./save-bar";

export interface BrandingValues {
  companyName: string;
  productName: string;
  logoUrl: string | null;
  accentColor: string;
  timezone: string;
  workingDays: number[];
  emailDomain: string | null;
}

const DAYS = [
  { n: 1, short: "Mon", long: "Monday" },
  { n: 2, short: "Tue", long: "Tuesday" },
  { n: 3, short: "Wed", long: "Wednesday" },
  { n: 4, short: "Thu", long: "Thursday" },
  { n: 5, short: "Fri", long: "Friday" },
  { n: 6, short: "Sat", long: "Saturday" },
  { n: 7, short: "Sun", long: "Sunday" },
];

const SWATCHES = ["#2A5FE6", "#2F5D50", "#1F4E79", "#6B3FA0", "#B4232C", "#C2410C", "#0F766E", "#1C1B19"];

export function BrandingForm({
  initial,
  setupStep,
  footer,
}: {
  initial: BrandingValues;
  /** Set when rendered in the wizard: the action marks the step done and moves on. */
  setupStep?: string;
  /** Extra controls rendered left of the submit button (e.g. "Skip for now"). */
  footer?: React.ReactNode;
}) {
  const [state, action, pending] = useActionState(saveBrandingAction, null);
  useActionFeedback(state);
  const [companyName, setCompanyName] = useState(initial.companyName);
  const [productName, setProductName] = useState(initial.productName);
  const [color, setColor] = useState(initial.accentColor);
  const [days, setDays] = useState<number[]>(initial.workingDays);
  const [timezone, setTimezone] = useState(initial.timezone);
  const zones = useMemo(() => {
    try {
      const list = Intl.supportedValuesOf("timeZone");
      return list.includes("UTC") ? list : ["UTC", ...list];
    } catch {
      return ["UTC", "Europe/London", "America/New_York"];
    }
  }, []);
  const validHex = /^#[0-9a-f]{6}$/i.test(color);
  const [dirty, setDirty] = useState(false);
  useEffect(() => {
    if (state?.ok) setDirty(false);
  }, [state]);

  const stacked = !!setupStep;
  const colourControls = (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <input
            type="color"
            aria-label="Pick a brand colour"
            value={validHex ? color : "#2A5FE6"}
            onChange={(e) => setColor(e.target.value.toUpperCase())}
            className="focus-ring press size-11 cursor-pointer rounded-control bg-raised p-1 shadow-cell md:size-10"
          />
          <Input
            id="accentColor"
            name="accentColor"
            aria-label="Brand colour"
            value={color}
            onChange={(e) => setColor(e.target.value.trim())}
            className="w-28 font-mono uppercase"
            maxLength={7}
            aria-invalid={!validHex || !!fieldError(state, "accentColor") || undefined}
            spellCheck={false}
          />
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Suggested colours">
          {SWATCHES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => {
                setColor(s);
                setDirty(true);
              }}
              aria-label={`Use ${s}`}
              aria-pressed={color.toUpperCase() === s}
              className="focus-ring touch-target press size-8 rounded-full shadow-cell aria-pressed:ring-2 aria-pressed:ring-fg aria-pressed:ring-offset-2 aria-pressed:ring-offset-raised"
              style={{ backgroundColor: s }}
            />
          ))}
        </div>
      </div>
      {fieldError(state, "accentColor") || !validHex ? (
        <p className="text-small text-danger-text">{fieldError(state, "accentColor") ?? "Use a hex colour such as #2A5FE6."}</p>
      ) : null}
    </div>
  );

  // The draft colour drives this page's own accent (the save button, rings, the hero), so changing it is felt
  // here first, in both themes, through the same accessible generator the whole product uses.
  const draft = useMemo(() => accentTokens(validHex ? color : initial.accentColor), [color, validHex, initial.accentColor]);
  const scope = `.brand-draft{${cssVars(draft.light)}}.dark .brand-draft{${cssVars(draft.dark)}}`;

  return (
    <form action={action} onChange={() => setDirty(true)} className="brand-draft section-stack">
      <style>{scope}</style>
      {setupStep ? <input type="hidden" name="_setupStep" value={setupStep} /> : null}
      <FormError state={state} />

      {/* The console's hero: the company as employees will see it, both themes side by side, updating as you type. */}
      {!stacked ? (
        <section aria-label="Live preview" className="relative isolate overflow-hidden rounded-panel panel dark:glass">
          {/* The hero's light is the brand colour itself, so it recolours as you pick. */}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 -z-10 transition-[background] duration-500"
            style={{ background: `radial-gradient(70% 95% at 8% 0%, color-mix(in oklch, var(--lb-accent) 22%, transparent), transparent 70%)` }}
          />
          <div className="grid gap-8 p-6 sm:p-8 xl:grid-cols-[minmax(0,1fr)_minmax(0,640px)] xl:items-center xl:gap-12">
            <div className="flex min-w-0 flex-col gap-3">
              <span className="inline-flex h-7 items-center gap-2 self-start rounded-full bg-raised px-3 text-caption font-medium text-muted shadow-cell">
                <span aria-hidden className="size-2.5 rounded-full" style={{ backgroundColor: validHex ? color : "#2A5FE6" }} />
                Live preview
              </span>
              <h2 className="text-balance text-h2 font-medium text-fg md:text-hero">{companyName.trim() || "Your company"}</h2>
              <p className="max-w-md text-row text-muted text-pretty">
                Employees know it as <span className="font-medium text-fg">{productName.trim() || "Lobby"}</span>. Change anything below and both themes follow at once.
              </p>
            </div>
            <AccentPreview color={color} companyName={companyName} note={false} />
          </div>
        </section>
      ) : null}

      <SettingsGroup stacked={stacked} title="Name and logo" description="Shown in the top bar, on sign-in and in every email Lobby sends.">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Company name" required error={fieldError(state, "companyName")}>
            <Input name="companyName" value={companyName} onChange={(e) => setCompanyName(e.target.value)} autoComplete="organization" required maxLength={80} />
          </Field>
          <Field label="Product name" help="What employees call this intranet." error={fieldError(state, "productName")}>
            <Input name="productName" value={productName} onChange={(e) => setProductName(e.target.value)} placeholder="Lobby" maxLength={40} />
          </Field>
          <div className="sm:col-span-2">
            <LogoUpload name="logoUrl" companyName={companyName} defaultValue={initial.logoUrl} />
            {fieldError(state, "logoUrl") ? <p className="mt-1 text-small text-danger-text">{fieldError(state, "logoUrl")}</p> : null}
          </div>
        </div>
      </SettingsGroup>

      <SettingsGroup stacked={stacked} title="Brand colour" description="Buttons, links and the active tab. Any colour works: Lobby adjusts it so text stays readable.">
        {colourControls}
        {stacked ? (
          <>
            {/* Phones: the preview inline. From lg it lives in the step's preview pane, beside the whole form. */}
            <div className="lg:hidden">
              <AccentPreview color={color} companyName={companyName} />
            </div>
            <div className="hidden lg:block">
              <ContrastNote color={color} />
            </div>
            <AsideSlot>
              <section className="relative isolate flex flex-col gap-5 overflow-hidden rounded-panel panel p-6 dark:glass">
                <div className="flex flex-col gap-1">
                  <h2 className="text-h3 font-medium text-fg">{companyName.trim() || "Your company"}</h2>
                  <p className="text-body text-muted">Both themes, live, as employees will see them.</p>
                </div>
                <AccentPreview color={color} companyName={companyName} stack note={false} />
              </section>
            </AsideSlot>
          </>
        ) : (
          <ContrastNote color={color} />
        )}
      </SettingsGroup>

      <SettingsGroup stacked={stacked} title="Time and working week" description="Due dates, SLAs, onboarding tasks and the home greeting all follow these.">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Timezone" controlId="timezone" help="Used for due dates, SLAs and the home greeting." error={fieldError(state, "timezone")}>
            <Select
              value={timezone}
              onValueChange={(z) => {
                setTimezone(z);
                setDirty(true);
              }}
              name="timezone"
            >
              <SelectTrigger id="timezone">
                <SelectValue placeholder="Pick a timezone" />
              </SelectTrigger>
              <SelectContent>
                {zones.map((z) => (
                  <SelectItem key={z} value={z}>
                    {z.replace(/_/g, " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Email domain" help="People with this domain are your employees." error={fieldError(state, "emailDomain")}>
            <Input name="emailDomain" defaultValue={initial.emailDomain ?? ""} placeholder="yourcompany.com" spellCheck={false} autoCapitalize="none" />
          </Field>
          <fieldset className="flex flex-col gap-1.5 sm:col-span-2">
            <legend className="mb-1.5 text-small font-medium text-fg">Working days</legend>
            {/* A seven-key row on a sunken track: a working day is a raised key, a non-working day is hatched, the way weekends are drawn on the Home planner. */}
            <div className="inline-flex w-full max-w-md items-center gap-1 self-start rounded-full bg-sunken p-1 shadow-inset" role="group" aria-label="Working days">
              {DAYS.map((d) => {
                const on = days.includes(d.n);
                return (
                  <button
                    key={d.n}
                    type="button"
                    aria-pressed={on}
                    aria-label={d.long}
                    onClick={() => {
                      setDirty(true);
                      setDays((cur) => (on ? cur.filter((x) => x !== d.n) : [...cur, d.n].sort()));
                    }}
                    className={cn(
                      "focus-ring press tabular inline-flex h-10 min-w-0 flex-1 items-center justify-center rounded-full text-small font-medium md:h-9",
                      on ? "cell text-fg" : "hatch text-muted hover:text-fg",
                    )}
                  >
                    {d.short}
                  </button>
                );
              })}
            </div>
            {days.map((d) => (
              <input key={d} type="hidden" name="workingDays" value={d} />
            ))}
            <p className="text-small text-muted">Onboarding tasks and request deadlines skip the other days.</p>
            {fieldError(state, "workingDays") ? <p className="text-small text-danger-text">{fieldError(state, "workingDays")}</p> : null}
          </fieldset>
        </div>
      </SettingsGroup>

      {/* In the wizard the foot is the same step bar as every other step; in the console it is the save bar. */}
      {setupStep ? (
        <StepBar step={setupStep as SetupStep}>
          {footer}
          <Button type="submit" loading={pending} disabled={!validHex || !days.length}>
            Save and continue
          </Button>
        </StepBar>
      ) : (
        <SaveBar dirty={dirty} left={footer}>
          <Button type="submit" loading={pending} disabled={!validHex || !days.length}>
            Save changes
          </Button>
        </SaveBar>
      )}
    </form>
  );
}

const cssVars = (t: AccentTokens) =>
  `--lb-accent:${t.accent};--lb-accent-hover:${t.accentHover};--lb-accent-fg:${t.accentFg};--lb-accent-soft:${t.accentSoft};--lb-accent-text:${t.accentText};--lb-accent-ring:${t.accentRing};`;
