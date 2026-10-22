"use client";

import { useState, useTransition } from "react";
import { KeyRound, TriangleAlert } from "lucide-react";
import { BorderBeam } from "@/components/ui/effects/border-beam";
import { BlurIn } from "@/components/ui/motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";
import { createScimTokenAction, revokeScimTokenAction } from "@/app/(app)/admin/_actions";
import { formatDate, timeAgo } from "@/lib/time";
import { CellList, CellMeta, RowCell } from "@/components/ui/cells";
import { cn } from "@/lib/cn";
import { CopyField } from "./copy-field";

export interface ScimTokenRow {
  id: string;
  name: string;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
}

/** Generates a SCIM bearer token (shown once) and lists existing ones with revoke. */
export function ScimPanel({
  baseUrl,
  tokens,
  defaultName,
  generateVariant = "primary",
}: {
  baseUrl: string;
  tokens: ScimTokenRow[];
  defaultName: string;
  /** "secondary" inside the setup wizard, where the step footer's Continue is the one primary. */
  generateVariant?: "primary" | "secondary";
}) {
  const [name, setName] = useState(defaultName);
  const [fresh, setFresh] = useState<{ token: string; name: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const active = tokens.filter((t) => !t.revokedAt);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <span className="text-small font-medium text-fg">SCIM base URL</span>
        <CopyField value={baseUrl} label="SCIM base URL" />
      </div>

      {fresh ? (
        // The one moment on this panel: the token materialises and a light travels once around it, because it is shown exactly once.
        <BlurIn className="relative isolate flex flex-col gap-2.5 rounded-card bg-warning-soft/70 p-4">
          <BorderBeam settle="none" tone="amber" loops={1} intensity="vivid" />
          <p className="flex items-start gap-2 text-small font-medium text-warning-text">
            <TriangleAlert className="mt-px size-4 shrink-0 stroke-[1.5]" aria-hidden />
            Copy this token now. Lobby stores only a fingerprint of it, so it cannot be shown again.
          </p>
          <CopyField value={fresh.token} label={`SCIM token ${fresh.name}`} secret />
        </BlurIn>
      ) : (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="scim-token-name" className="text-small font-medium text-fg">
            Token name
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input id="scim-token-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} className="sm:max-w-[280px]" />
            <Button
              type="button"
              variant={name.trim() ? generateVariant : "secondary"}
              disabled={!name.trim()}
              loading={pending}
              onClick={() =>
                start(async () => {
                  setError(null);
                  const r = await createScimTokenAction(name);
                  if (r.ok && r.data) setFresh(r.data);
                  else if (!r.ok) setError(r.error);
                })
              }
            >
              <KeyRound aria-hidden />
              Generate SCIM token
            </Button>
          </div>
          <p className="text-small text-muted">Name it after the system that will use it, so you know which one to revoke later.</p>
          {error ? <p role="alert" className="text-small text-danger-text">{error}</p> : null}
        </div>
      )}

      {!tokens.length && !fresh ? (
        <p className="text-small text-muted">No tokens yet. Generate one so your identity provider can push people into Lobby.</p>
      ) : null}
      {tokens.length ? (
        <div className="flex flex-col gap-2">
          <h3 className="text-small font-medium text-fg">
            Tokens <span className="tabular text-muted">({active.length} active)</span>
          </h3>
          <CellList density="compact">
            {tokens.map((t) => (
              <TokenRow key={t.id} token={t} />
            ))}
          </CellList>
        </div>
      ) : null}
    </div>
  );
}

function TokenRow({ token }: { token: ScimTokenRow }) {
  const [pending, start] = useTransition();
  const [confirm, setConfirm] = useState(false);
  return (
    <RowCell
      leading={
        <span aria-hidden className={cn("grid size-9 place-items-center rounded-full", token.revokedAt ? "bg-sunken text-subtle" : token.lastUsedAt ? "cat-green" : "cat-amber")}>
          <KeyRound className="size-4 stroke-[1.75]" />
        </span>
      }
      title={token.name}
      meta={<CellMeta items={[`Created ${formatDate(token.createdAt)}`, token.lastUsedAt ? `Last used ${timeAgo(token.lastUsedAt)}` : "Never used"]} />}
      trailing={
        token.revokedAt ? (
          <Badge tone="neutral" dot>
            Revoked
          </Badge>
        ) : confirm ? (
          <span className="flex items-center gap-1.5">
            <Button size="sm" variant="ghost" onClick={() => setConfirm(false)}>
              Keep
            </Button>
            <Button
              size="sm"
              variant="danger"
              loading={pending}
              onClick={() =>
                start(async () => {
                  const r = await revokeScimTokenAction(token.id);
                  if (r.ok) toast.success(r.message ?? "Token revoked.");
                  else toast.error(r.error);
                  setConfirm(false);
                })
              }
            >
              Revoke token
            </Button>
          </span>
        ) : (
          <Button size="sm" variant="secondary" onClick={() => setConfirm(true)}>
            Revoke
          </Button>
        )
      }
    />
  );
}
