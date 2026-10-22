import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { getOrgSettings, SETUP_STEPS } from "@lobby/core";
import { hasBreakGlassAdmin } from "@lobby/core/admin";
import { BrandMark } from "@/components/brand-mark";
import { Progress } from "@/components/ui/progress";
import { Toaster } from "@/components/ui/toast";
import { TooltipProvider } from "@/components/ui/tooltip";
import { StepList } from "@/components/setup/step-list";
import { ScrollToTopOnStep } from "@/components/setup/scroll-to-top";
import { STEPS } from "@/components/setup/steps";
import { ThemeToggle } from "@/components/setup/theme-toggle";
import { currentUser } from "@/server/auth";

export const metadata = { title: "Set up" };

/**
 * The wizard, wave 3: the same floating slab and the same navigation model as the app. The six
 * steps are the pill track in the top bar (the app's main nav material), with progress as one
 * quiet line under it and the task centred below. On phones the track scrolls sideways under the
 * brand row and keeps the current step in view.
 */
export default async function SetupLayout({ children }: { children: React.ReactNode }) {
  const [org, hasAdmin, ctx] = await Promise.all([getOrgSettings(), hasBreakGlassAdmin(), currentUser()]);
  const settled = SETUP_STEPS.filter((k) => org.setupSteps[k]).length;
  const left = STEPS.filter((st) => !org.setupSteps[st.key]).reduce((n, st) => n + st.minutes, 0);
  const named = org.companyName !== "Your company";
  const name = named ? org.companyName : org.productName;
  return (
    <TooltipProvider>
      <ScrollToTopOnStep />
      <div className="min-h-dvh md:p-3 lg:p-4">
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-raised focus:px-4 focus:py-2 focus:shadow-popover">
          Skip to content
        </a>
        {/* The same floating slab and the same top bar as the app: brand left, the steps as the pill
            track in the middle (the app's main nav), and "Open Lobby" plus the theme on the right. */}
        <div className="slab relative mx-auto flex min-h-dvh w-full max-w-[1280px] flex-col bg-page md:min-h-[calc(100dvh-1.5rem)] md:rounded-slab md:shadow-slab lg:min-h-[calc(100dvh-2rem)]">
          <header className="flex flex-col gap-3 px-3 pt-3 sm:px-4 md:px-5 lg:flex-row lg:items-center lg:gap-3 lg:pt-3">
            <div className="flex min-w-0 items-center gap-3 lg:shrink-0">
              <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-raised shadow-cell">
                <BrandMark name={name} logoUrl={org.logoUrl} size={28} />
              </span>
              <div className="flex min-w-0 flex-1 flex-col lg:hidden xl:flex">
                <span className="truncate text-row font-medium text-fg">{name}</span>
                <span className="text-caption text-subtle">Setting up {org.productName}</span>
              </div>
              <div className="ml-auto flex items-center gap-1 lg:hidden">
                {ctx && hasAdmin ? (
                  <Link href="/" aria-label={`Open ${org.productName}`} className="focus-ring touch-target inline-flex size-10 items-center justify-center rounded-full text-muted hover:bg-hover hover:text-fg">
                    <ArrowUpRight className="size-[18px] stroke-[1.75]" aria-hidden />
                  </Link>
                ) : null}
                <ThemeToggle />
              </div>
            </div>
            <StepList status={org.setupSteps} locked={!hasAdmin} />
            <div className="hidden shrink-0 items-center gap-1 lg:ml-auto lg:flex">
              {ctx && hasAdmin ? (
                <Link href="/" className="focus-ring press inline-flex h-10 items-center gap-1.5 rounded-full bg-raised px-4 text-body font-medium text-fg shadow-cell hover:shadow-cell-hover">
                  Open {org.productName}
                  <ArrowUpRight className="size-4 stroke-[1.75]" aria-hidden />
                </Link>
              ) : null}
              <ThemeToggle />
            </div>
          </header>
          {/* Progress, as one quiet line under the track. */}
          <div className="flex items-center gap-3 px-4 pt-4 sm:px-6 md:px-6">
            <Progress value={settled} max={SETUP_STEPS.length} aria-label="Setup progress" size="sm" className="w-full" />
            <span className="text-small text-muted">
              <span className="tabular font-medium text-fg">
                {settled} of {SETUP_STEPS.length}
              </span>{" "}
              {settled === 0 ? "steps. About 10 minutes in total." : left ? `steps settled. About ${left} min left.` : "steps settled."}
            </span>
            {!(ctx && hasAdmin) ? <span className="ml-auto hidden text-small text-subtle md:inline">Self-hosted. Your data stays on your servers.</span> : null}
          </div>
          <main id="main" className="min-w-0 flex-1 overflow-x-clip">
            <div className="mx-auto w-full max-w-(--container-page-prose) px-4 pb-24 pt-8 sm:px-8 lg:px-10 lg:pb-16 lg:pt-10">{children}</div>
          </main>
        </div>
      </div>
      <Toaster />
    </TooltipProvider>
  );
}
