"use client";

import { useActionState, useState } from "react";
import { ArrowRight, Eye, EyeOff } from "lucide-react";
import { passwordStrength } from "@lobby/core/admin/password";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/cn";
import { createAdminAction } from "@/app/setup/_actions";
import { StepBar } from "./step-nav";
import { FormError, fieldError } from "@/components/admin/form-status";

const METER = ["bg-danger", "bg-danger", "bg-warning", "bg-success", "bg-success"];
const TEXT = ["text-danger-text", "text-danger-text", "text-warning-text", "text-success-text", "text-success-text"];

export function AdminAccountForm({ needsToken }: { needsToken: boolean }) {
  const [state, action, pending] = useActionState(createAdminAction, null);
  // Controlled, so a refused submit (React resets uncontrolled fields after an action) keeps what was typed.
  const [name, setName] = useState("");
  const [token, setToken] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const strength = passwordStrength(password, [email.split("@")[0] ?? ""]);

  return (
    <form action={action} className="flex flex-col gap-4">
      <FormError state={state} />
      <div className="cell flex flex-col gap-5 rounded-panel p-5 sm:p-7">
      {needsToken ? (
        <Field
          label="Setup token"
          required
          help="Printed by deploy/setup.sh, also in deploy/.env as LOBBY_SETUP_TOKEN."
          error={fieldError(state, "setupToken")}
        >
          <Input name="setupToken" required autoComplete="off" spellCheck={false} autoFocus className="font-mono" value={token} onChange={(e) => setToken(e.target.value)} />
        </Field>
      ) : null}
      <Field label="Your name" required error={fieldError(state, "name")}>
        <Input name="name" autoComplete="name" required autoFocus={!needsToken} value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      <Field label="Work email" required help="You sign in with this if single sign-on is unavailable." error={fieldError(state, "email")}>
        <Input name="email" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </Field>
      <Field
        label="Password"
        required
        error={fieldError(state, "password")}
        help={
          <span className="flex flex-col gap-1.5" aria-live="polite">
            <span className="flex gap-1" aria-hidden>
              {[1, 2, 3, 4].map((n) => (
                <span key={n} className={cn("h-1 flex-1 rounded-full transition-colors duration-120", password && strength.score >= n ? METER[strength.score] : "bg-border")} />
              ))}
            </span>
            <span>
              {password ? <span className={cn("font-medium", TEXT[strength.score])}>{strength.label}. </span> : null}
              {strength.hint}
            </span>
          </span>
        }
      >
        <Input
          name="password"
          type={show ? "text" : "password"}
          autoComplete="new-password"
          required
          minLength={12}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          trailing={
            <button
              type="button"
              onClick={() => setShow((s) => !s)}
              className="focus-ring touch-target pointer-events-auto inline-flex size-7 items-center justify-center rounded-[4px] text-muted hover:text-fg"
              aria-label={show ? "Hide password" : "Show password"}
            >
              {show ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
            </button>
          }
        />
      </Field>
      </div>
      <StepBar step="admin" note="Twelve characters or more. A passphrase works well.">
        <Button type="submit" loading={pending} disabled={!!password && !strength.acceptable}>
          Create account and continue
          <ArrowRight aria-hidden />
        </Button>
      </StepBar>
    </form>
  );
}
