import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, ChevronRight, KeyRound, ShieldCheck } from "lucide-react";
import { db, s, eq } from "@lobby/db";
import { env, getOrgSettings, resolveIdentity, safeReturnTo } from "@lobby/core";
import { FrontDoor } from "@/components/brand-mark";
import { Avatar } from "@/components/ui/avatar";
import { formatDateline } from "@/components/ui/dateline";
import { Button } from "@/components/ui/button";
import { Disclosure } from "@/components/ui/disclosure";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { currentUser } from "@/server/auth";

export const metadata = { title: "Sign in" };

/** The quiet rows under the main action: same shape as the development disclosure's summary row. */
const quietRow =
  "focus-ring flex min-h-11 items-center gap-2.5 rounded-control px-1 text-body font-medium text-fg transition-colors duration-120 hover:bg-hover";

/** Providers with a name people recognise get it on the button; anything else is "<Company> SSO". */
const providerLabel: Record<string, string> = {
  okta: "Okta",
  entra: "Microsoft",
  google: "Google",
};

export default async function SignInPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  const returnTo = safeReturnTo(params.returnTo);
  if (await currentUser()) redirect(returnTo);

  const org = await getOrgSettings();
  const identity = await resolveIdentity();
  const hasAdmin = !!(await db.query.users.findFirst({ where: eq(s.users.isBreakGlass, true), columns: { id: true } }));
  if (!identity && !hasAdmin) redirect("/setup");

  const adminMode = params.mode === "admin" || !identity;
  const ssoLabel = identity ? (providerLabel[identity.provider] ?? `${org.companyName} SSO`) : null;
  const devUsers = env.devLogin
    ? await db.query.users.findMany({
        columns: { id: true, email: true, displayName: true, title: true, avatarUrl: true },
        orderBy: (u, { asc }) => asc(u.displayName),
        limit: 50,
      })
    : [];
  const back = encodeURIComponent(returnTo);

  return (
    <FrontDoor name={org.companyName} logoUrl={org.logoUrl} dateline={formatDateline(new Date(), org.timezone)} productName={org.productName}>
      <h1 className="text-h1 font-medium text-fg text-balance lg:text-display">{adminMode ? "Administrator sign-in" : `Sign in to ${org.companyName}`}</h1>
      <p className="mt-3 text-body-lg text-muted text-pretty">
        {adminMode
          ? "For setup and emergencies only. Everyone else signs in with their work account."
          : "Use your work account. You stay signed in to every app you open from here."}
      </p>

      {params.error && (
        <div role="alert" className="mt-6 rounded-cell bg-danger-soft px-3.5 py-3 text-small text-danger-text">
          {params.error}
        </div>
      )}

      {!adminMode && identity && (
        <div className="mt-7 space-y-4">
          {/* The one action on the page. Rendered as a link (not a button) because it navigates to the IdP. */}
          <Button asChild size="lg" className="w-full">
            <a href={`/auth/login?returnTo=${back}`}>
              <ShieldCheck aria-hidden />
              Continue with {ssoLabel}
            </a>
          </Button>
          <p className="text-small text-muted">Trouble signing in? Ask your IT team.</p>
        </div>
      )}

      {adminMode && (
        <form action="/auth/password" method="post" className="mt-7 space-y-5">
          <input type="hidden" name="returnTo" value={returnTo} />
          <Field label="Email">
            <Input id="email" name="email" type="email" autoComplete="username" required autoFocus />
          </Field>
          <Field label="Password">
            <Input id="password" name="password" type="password" autoComplete="current-password" required />
          </Field>
          <Button type="submit" size="lg" className="w-full">
            <KeyRound aria-hidden />
            Sign in
          </Button>
        </form>
      )}

      {(identity || devUsers.length > 0) && (
        <div className="mt-7 divide-y divide-border border-t border-border">
          {identity &&
            (adminMode ? (
              <Link href={`/sign-in?returnTo=${back}`} className={quietRow}>
                <ArrowLeft aria-hidden className="size-4 shrink-0 stroke-[1.75] text-subtle" />
                <span className="min-w-0 flex-1 truncate">Back to {ssoLabel}</span>
              </Link>
            ) : (
              <Link href={`/sign-in?mode=admin&returnTo=${back}`} className={quietRow}>
                <KeyRound aria-hidden className="size-4 shrink-0 stroke-[1.75] text-subtle" />
                <span className="min-w-0 flex-1 truncate">Administrator sign-in</span>
                <span className="hidden shrink-0 text-small font-normal text-muted sm:inline">Email and password</span>
                <ChevronRight aria-hidden className="size-4 shrink-0 stroke-[1.75] text-subtle" />
              </Link>
            ))}
          {devUsers.length > 0 && (
            <Disclosure
              className="border-y-0"
              title="Demo users (development only)"
              aside={`${devUsers.length} people`}
              contentClassName="px-0 pb-0 pt-0"
            >
              {/* Faces, not names alone: the demo list is a people list, so each row carries its generated avatar. */}
              <ul className="-mx-2 max-h-72 divide-y divide-border overflow-y-auto border-t border-border px-2">
                {devUsers.map((u) => (
                  <li key={u.email}>
                    <a
                      href={`/auth/dev-login?email=${encodeURIComponent(u.email)}&returnTo=${back}`}
                      aria-label={`Sign in as ${u.displayName}`}
                      className="focus-ring flex h-12 items-center gap-3 rounded-control px-1 text-small transition-colors duration-120 hover:bg-hover"
                    >
                      <Avatar name={u.displayName} src={u.avatarUrl} seed={u.id} size="sm" />
                      <span className="min-w-0 flex-1 truncate font-medium text-fg">{u.displayName}</span>
                      <span className="truncate text-caption text-subtle">{u.title}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </Disclosure>
          )}
        </div>
      )}
    </FrontDoor>
  );
}
