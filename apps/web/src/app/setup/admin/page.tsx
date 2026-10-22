import { ArrowRight, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { CategoryBlock } from "@/components/ui/category-block";
import { StepHeader } from "@/components/setup/step-header";
import { StepBar } from "@/components/setup/step-nav";
import { AdminDoors } from "@/components/setup/step-visuals";
import { AdminAccountForm } from "@/components/setup/admin-account-form";
import { guardSetup, setupTokenRequired } from "../_guard";

export const metadata = { title: "Administrator" };

export default async function AdminStep() {
  const ctx = await guardSetup("admin");
  if (ctx) {
    return (
      <StepHeader step="admin" aside={<AdminDoors done />}>
        <div className="flex flex-col gap-3">
          {/* The state, as a filled block: green is done. */}
          <CategoryBlock
            tone="green"
            icon={<ShieldCheck />}
            title="The administrator account is set up"
            subtitle={ctx.user.isBreakGlass ? "It works even when single sign-on does not" : "Single sign-on can never lock everyone out"}
            status={{ label: "Done", dot: true }}
          />
          <dl className="cell grid gap-x-6 gap-y-3 rounded-card p-5 sm:grid-cols-[150px_minmax(0,1fr)]">
            <dt className="text-small text-muted">Signed in as</dt>
            <dd className="flex min-w-0 flex-col">
              <span className="text-row font-medium text-fg">{ctx.user.displayName}</span>
              <span className="break-words text-small text-muted">{ctx.user.email}</span>
            </dd>
            <dt className="text-small text-muted">Account type</dt>
            <dd className="text-body text-fg">{ctx.user.isBreakGlass ? "Break-glass administrator, with a password and no single sign-on" : "Administrator through single sign-on"}</dd>
            {ctx.user.isBreakGlass ? (
              <>
                <dt className="text-small text-muted">To get back in</dt>
                <dd className="text-body text-fg">Open Sign in, then Administrator sign-in.</dd>
              </>
            ) : null}
          </dl>
        </div>
        <StepBar step="admin">
          <Button asChild>
            <Link href="/setup/company">
              Continue
              <ArrowRight aria-hidden />
            </Link>
          </Button>
        </StepBar>
      </StepHeader>
    );
  }
  return (
    <StepHeader step="admin" aside={<AdminDoors done={false} />}>
      <AdminAccountForm needsToken={await setupTokenRequired()} />
    </StepHeader>
  );
}
