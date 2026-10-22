"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { CircleAlert, CircleCheck, LogIn, PlugZap, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { CategoryBlock } from "@/components/ui/category-block";
import { Button } from "@/components/ui/button";
import { Disclosure } from "@/components/ui/disclosure";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { BlurIn } from "@/components/ui/motion";
import { cn } from "@/lib/cn";
import { beginIdentityTestAction, probeIdentityAction, saveIdentityAction } from "@/app/(app)/admin/_actions";
import type { ProbeResult } from "@lobby/core/admin/identity";
import { CopyField } from "./copy-field";
import { FormError, fieldError, useActionFeedback } from "./form-status";
import { SaveBar } from "./save-bar";
import { SettingsGroup } from "./settings-group";
import { ProviderLogo } from "./provider-logo";
import { PROVIDERS, providerHelp, type ProviderKey } from "./identity-providers";

export interface IdentityValues {
  provider: ProviderKey;
  issuer: string;
  clientId: string;
  hasSecret: boolean;
  discoveryUrl: string;
  scopes: string;
  groupsClaim: string;
  testedAt: string | null;
}

export interface TestOutcome {
  ok: boolean;
  email?: string;
  name?: string;
  groups?: string[];
  error?: string;
}

export function IdentityForm({
  initial,
  redirectUri,
  test,
  returnTo,
}: {
  initial: IdentityValues;
  redirectUri: string;
  /** Result of the most recent "Sign in to test" round trip, if the admin just came back from one. */
  test: TestOutcome | null;
  returnTo: "/setup/identity" | "/admin/identity";
}) {
  // In the wizard the step footer's Continue is the one primary action, so the save is secondary there.
  const submitVariant = returnTo === "/setup/identity" ? "secondary" : "primary";
  const [state, action, pending] = useActionState(saveIdentityAction, null);
  useActionFeedback(state);
  const [provider, setProvider] = useState<ProviderKey>(initial.provider);
  const [values, setValues] = useState({ issuer: initial.issuer, clientId: initial.clientId, discoveryUrl: initial.discoveryUrl });
  const [dirty, setDirty] = useState(false);
  const [probe, setProbe] = useState<ProbeResult | null>(null);
  const [probing, startProbe] = useTransition();
  useEffect(() => {
    if (state?.ok) setDirty(false);
  }, [state]);
  const help = providerHelp(provider);
  const saved = !!initial.issuer && initial.hasSecret;

  const set = (k: keyof typeof values) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setValues((v) => ({ ...v, [k]: e.target.value }));
    setDirty(true);
    setProbe(null);
  };

  const stacked = returnTo === "/setup/identity";
  const testedOn = initial.testedAt ? new Date(initial.testedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : null;

  return (
    <div className="section-stack">
      <form action={action} onChange={() => setDirty(true)} className="section-stack">
        <FormError state={state} />
        <SettingsGroup stacked={stacked} title="Provider" description="Where your people already sign in. Lobby never sees their passwords.">
          <fieldset className="flex flex-col gap-2">
            <legend className="sr-only">Identity provider</legend>
            <div className={cn("grid grid-cols-1 gap-2.5 sm:grid-cols-2", !stacked && "2xl:grid-cols-3")} role="radiogroup" aria-label="Identity provider">
              {PROVIDERS.map((p) => {
                const on = p.key === provider;
                return (
                  <label
                    key={p.key}
                    className={cn(
                      "press relative flex min-h-[72px] cursor-pointer items-center gap-3.5 rounded-card px-4 py-3",
                      "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent-ring",
                      // A key on the panel: raised when idle, pressed in with an accent ring when chosen.
                      on ? "bg-accent-soft shadow-[var(--lb-shadow-inset),0_0_0_1.5px_var(--lb-accent-ring)]" : "bg-surface shadow-cell hover:bg-raised hover:shadow-cell-hover",
                    )}
                  >
                    <input
                      type="radio"
                      name="provider"
                      value={p.key}
                      checked={on}
                      onChange={() => {
                        setProvider(p.key);
                        setDirty(true);
                      }}
                      className="absolute inset-0 size-full cursor-pointer appearance-none rounded-card opacity-0"
                    />
                    <ProviderLogo provider={p.key} />
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="truncate text-row font-medium text-fg">{p.name}</span>
                      <span className="truncate text-caption text-muted">{p.blurb}</span>
                    </span>
                    {on ? <CircleCheck className="size-[18px] shrink-0 stroke-[1.75] text-accent-text" aria-hidden /> : null}
                  </label>
                );
              })}
            </div>
          </fieldset>
        </SettingsGroup>

        <SettingsGroup stacked={stacked} title={`Register Lobby in ${help.name}`} description={`About three minutes in the ${help.name} console.`}>
          <ol className="flex flex-col gap-3">
            {help.steps.map((s, i) => (
              <li key={i} className="flex gap-3 text-body text-fg">
                <span className="tabular inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-accent-soft text-caption font-medium text-accent-text">
                  {i + 1}
                </span>
                <span className="pt-0.5 text-pretty">{s}</span>
              </li>
            ))}
          </ol>
          <div className="flex flex-col gap-1.5">
            <span className="text-small font-medium text-fg">Redirect URI</span>
            <CopyField value={redirectUri} label="redirect URI" />
          </div>
        </SettingsGroup>

        <SettingsGroup stacked={stacked} title="Client details" description="Paste them from the client you just registered. The secret is encrypted at rest.">
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Issuer URL" required className="sm:col-span-2" error={fieldError(state, "issuer")}>
              <Input name="issuer" value={values.issuer} onChange={set("issuer")} placeholder={help.issuerPlaceholder} spellCheck={false} autoCapitalize="none" inputMode="url" />
            </Field>
            <Field label="Client ID" required error={fieldError(state, "clientId")}>
              <Input name="clientId" value={values.clientId} onChange={set("clientId")} spellCheck={false} autoCapitalize="none" autoComplete="off" />
            </Field>
            <Field
              label="Client secret"
              required={!initial.hasSecret}
              help={initial.hasSecret ? "Saved and encrypted. Leave blank to keep it." : "Stored encrypted. Never shown again."}
              error={fieldError(state, "clientSecret")}
            >
              <Input name="clientSecret" type="password" autoComplete="new-password" placeholder={initial.hasSecret ? "••••••••••••" : ""} />
            </Field>
            <Field label="Groups claim" help={<span className="block max-w-lg text-pretty">{help.groupsNote}</span>} className="sm:col-span-2" error={fieldError(state, "groupsClaim")}>
              <Input name="groupsClaim" defaultValue={initial.groupsClaim || help.groupsClaim} spellCheck={false} className="sm:max-w-[240px]" />
            </Field>
          </div>
          <Disclosure variant="card" title="Advanced" aside="Discovery URL, scopes" defaultOpen={!!initial.discoveryUrl} contentClassName="grid gap-5 sm:grid-cols-2">
            <Field label="Internal discovery URL" help="Only when Lobby reaches the identity provider on a different address than browsers do, for example inside Docker." error={fieldError(state, "discoveryUrl")}>
              <Input name="discoveryUrl" value={values.discoveryUrl} onChange={set("discoveryUrl")} placeholder="http://keycloak:8080/realms/acme" spellCheck={false} />
            </Field>
            <Field label="Scopes" help="openid is required. email and profile give Lobby names and addresses.">
              <Input name="scopes" defaultValue={initial.scopes || "openid email profile"} spellCheck={false} />
            </Field>
          </Disclosure>
        </SettingsGroup>

        <SaveBar dirty={dirty}>
          <Button type="submit" variant={dirty ? "primary" : submitVariant} loading={pending}>
            Save identity provider
          </Button>
        </SaveBar>
      </form>

      <SettingsGroup
        stacked={stacked}
        title="Test the connection"
        description="First check that Lobby can read the provider's configuration, then sign in once to see exactly what the token carries."
      >
        {/* The state of the connection as one block: green once a real sign-in passed, amber while it is saved but untested. */}
        {testedOn ? (
          <CategoryBlock tone="green" icon={<ShieldCheck />} title={`The last test passed on ${testedOn}`} subtitle="A real sign-in came back with a valid token." status={{ label: "Working", dot: true }} />
        ) : saved ? (
          <CategoryBlock tone="amber" icon={<PlugZap />} title="Saved, but not tested yet" subtitle="Sign in once to prove it before employees try." status={{ label: "Untested", dot: true }} />
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            loading={probing}
            onClick={() => startProbe(async () => setProbe(await probeIdentityAction(values)))}
          >
            <PlugZap aria-hidden />
            Test connection
          </Button>
          <form action={beginIdentityTestAction}>
            <input type="hidden" name="returnTo" value={returnTo} />
            <Button type="submit" variant="secondary" disabled={!saved || dirty}>
              <LogIn aria-hidden />
              Sign in to test
            </Button>
          </form>
        </div>
        {!saved ? (
          <p className="text-small text-muted">Save the provider first. Then sign in to test it with a real account.</p>
        ) : dirty ? (
          <p className="text-small text-muted">You have unsaved changes. Save them before you sign in to test.</p>
        ) : null}

        {probe ? <ProbeView probe={probe} /> : null}
        {test ? <TestView test={test} claim={initial.groupsClaim || "groups"} /> : null}
      </SettingsGroup>
    </div>
  );
}

function ProbeView({ probe }: { probe: ProbeResult }) {
  if (!probe.ok) {
    return (
      <div role="alert" className="flex items-start gap-2.5 rounded-card bg-danger-soft px-4 py-3 text-small text-danger-text">
        <CircleAlert className="mt-px size-4 shrink-0 stroke-[1.5]" aria-hidden />
        <span>{probe.error}</span>
      </div>
    );
  }
  const rows: [string, React.ReactNode][] = [
    ["Issuer", probe.issuer],
    ["Sign-in endpoint", probe.authorizationEndpoint],
    ["Token endpoint", probe.tokenEndpoint],
    [
      "PKCE",
      probe.supportsPkce ? (
        <Badge tone="success" dot size="sm">
          Supported
        </Badge>
      ) : (
        <Badge tone="warning" dot size="sm">
          Not advertised
        </Badge>
      ),
    ],
  ];
  return (
    <BlurIn role="status" className="flex flex-col gap-3 rounded-card bg-success-soft/60 p-4">
      <p className="flex items-center gap-2 text-small font-medium text-success-text">
        <CircleCheck className="size-4 stroke-[1.5]" aria-hidden />
        Lobby can reach your identity provider
      </p>
      <dl className="grid gap-x-4 gap-y-1.5 text-small sm:grid-cols-[140px_minmax(0,1fr)]">
        {rows.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-muted">{k}</dt>
            <dd className="min-w-0 break-all text-fg">{v}</dd>
          </div>
        ))}
      </dl>
    </BlurIn>
  );
}

function TestView({ test, claim }: { test: TestOutcome; claim: string }) {
  if (!test.ok) {
    return (
      <div role="alert" className="flex items-start gap-2.5 rounded-card bg-danger-soft px-4 py-3 text-small text-danger-text">
        <CircleAlert className="mt-px size-4 shrink-0 stroke-[1.5]" aria-hidden />
        <span>
          <span className="font-medium">The test sign-in did not complete.</span> {test.error}
        </span>
      </div>
    );
  }
  return (
    <BlurIn role="status" className="flex flex-col gap-3 rounded-card bg-success-soft/60 p-4">
      <p className="flex items-center gap-2 text-small font-medium text-success-text">
        <ShieldCheck className="size-4 stroke-[1.5]" aria-hidden />
        Signed in as {test.name ? `${test.name} (${test.email})` : test.email}
      </p>
      <div className="flex flex-col gap-1.5 text-small">
        <span className="text-muted">
          Groups in the <code className="font-mono text-fg">{claim}</code> claim
        </span>
        {test.groups?.length ? (
          <ul className="flex flex-wrap gap-1.5">
            {test.groups.map((g) => (
              <li key={g}>
                <Badge>{g}</Badge>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-fg">
            None. Sign-in works, but roles cannot come from groups until the provider adds a groups claim.
          </p>
        )}
      </div>
      <p className="text-small text-muted">Your own Lobby session was not changed by this test.</p>
    </BlurIn>
  );
}
