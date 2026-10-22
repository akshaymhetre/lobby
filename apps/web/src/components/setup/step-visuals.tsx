import * as React from "react";
import { BookOpen, Compass, KeyRound, LifeBuoy, ShieldCheck, Users } from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import { Avatar } from "@/components/ui/avatar";
import { CategoryBlock } from "@/components/ui/category-block";
import { cn } from "@/lib/cn";
import { StepAside } from "./step-aside";

/** Administrator step: the two doors into Lobby, and which one this account is. */
export function AdminDoors({ done }: { done: boolean }) {
  return (
    <StepAside tone={done ? "green" : "blue"} title="The key that always works" caption="Two ways in. Single sign-on is the front door for everyone; this account is the spare key for you.">
      <div className="flex flex-col gap-2.5">
        <div className="cell flex min-h-16 items-center gap-3 rounded-card px-4 py-3">
          <span aria-hidden className="grid size-10 place-items-center rounded-full bg-sunken text-muted shadow-inset">
            <KeyRound className="size-[18px] stroke-[1.75]" />
          </span>
          <span className="flex min-w-0 flex-col">
            <span className="text-row font-medium text-fg">Single sign-on</span>
            <span className="text-caption text-muted">For everyone, from step 3</span>
          </span>
        </div>
        <CategoryBlock
          tone={done ? "green" : "blue"}
          icon={<ShieldCheck />}
          title="Administrator account"
          subtitle="Works when sign-on is down"
          status={{ label: done ? "Ready" : "This step", dot: true }}
        />
      </div>
    </StepAside>
  );
}

/** Single sign-on step: provider to Lobby to people, as a vertical chain lit by the connection's state. */
export function SignInChain({
  provider,
  host,
  state,
  companyName,
  logoUrl,
  people,
  faces,
}: {
  provider: string | null;
  host: string | null;
  state: "tested" | "saved" | "none";
  companyName: string;
  logoUrl: string | null;
  people: number;
  faces: { id: string; name: string }[];
}) {
  const line = state === "tested" ? "bg-cat-green shadow-[0_0_10px_var(--lb-cat-green-to)]" : state === "saved" ? "bg-cat-amber" : "bg-border-strong";
  const rows = [
    {
      key: "idp",
      visual: (
        <span className="grid size-12 place-items-center rounded-full bg-raised text-fg shadow-cell">
          <KeyRound className="size-5 stroke-[1.5]" aria-hidden />
        </span>
      ),
      title: provider ?? "Your identity provider",
      meta: host ?? "Pick one on the left",
    },
    {
      key: "lobby",
      visual: (
        <span className="grid size-12 place-items-center rounded-full bg-raised shadow-cell">
          <BrandMark name={companyName} logoUrl={logoUrl} size={30} className="rounded-full" />
        </span>
      ),
      title: "Lobby",
      meta: state === "tested" ? "Tested and working" : state === "saved" ? "Saved, sign in once to test" : "Waiting for a provider",
    },
    {
      key: "people",
      visual: (
        <span className="flex h-12 w-12 items-center justify-center -space-x-4">
          {faces.slice(0, 2).map((f) => (
            <Avatar key={f.id} name={f.name} seed={f.id} size="md" className="rounded-full ring-2 ring-surface" />
          ))}
        </span>
      ),
      title: `${people} people`,
      meta: "Sign in with the account they already have",
    },
  ];
  return (
    <StepAside tone={state === "tested" ? "green" : state === "saved" ? "amber" : "blue"} title="How people will sign in" caption="Lobby never sees or stores their passwords.">
      <ol className="flex flex-col">
        {rows.map((r, i) => (
          <li key={r.key} className="flex flex-col">
            <span className="flex items-center gap-3.5">
              {r.visual}
              <span className="flex min-w-0 flex-col">
                <span className="truncate text-row font-medium text-fg">{r.title}</span>
                <span className="truncate text-caption text-muted">{r.meta}</span>
              </span>
            </span>
            {i < rows.length - 1 ? <span aria-hidden className={cn("my-1.5 ml-[23px] h-8 w-0.5 rounded-full", line)} /> : null}
          </li>
        ))}
      </ol>
    </StepAside>
  );
}

/** People step: the directory as it stands, faces first. */
export function DirectoryFaces({ people, faces }: { people: number; faces: { id: string; name: string }[] }) {
  return (
    <StepAside tone={people > 1 ? "green" : "blue"} title={`${people} ${people === 1 ? "person" : "people"} in the directory`} caption={people > 1 ? "Already here, with their managers and start dates." : "The directory fills in from whichever way you pick."}>
      <ul className="grid grid-cols-5 gap-2.5">
        {faces.map((f) => (
          <li key={f.id} className="flex justify-center">
            <Avatar name={f.name} seed={f.id} size="lg" />
          </li>
        ))}
      </ul>
      {people > faces.length ? <p className="tabular text-small text-muted">And {people - faces.length} more.</p> : null}
    </StepAside>
  );
}

/** Starter content step: what is already on the shelves, one category block per module. */
export function Shelves({ knowledge, helpdesk, journeys }: { knowledge: number; helpdesk: number; journeys: number }) {
  const n = (x: number, one: string, many: string) => `${x} ${x === 1 ? one : many}`;
  return (
    <StepAside tone="violet" title="On the shelves today" caption="Starter content adds to these. It never replaces what is there.">
      <div className="flex flex-col gap-2.5">
        <CategoryBlock tone="teal" icon={<BookOpen />} title="Knowledge" subtitle={n(knowledge, "space", "spaces")} status={knowledge ? { label: "Stocked", dot: true } : "Empty"} />
        <CategoryBlock tone="blue" icon={<LifeBuoy />} title="Helpdesk" subtitle={n(helpdesk, "request type", "request types")} status={helpdesk ? { label: "Stocked", dot: true } : "Empty"} />
        <CategoryBlock tone="violet" icon={<Compass />} title="Onboarding" subtitle={n(journeys, "journey", "journeys")} status={journeys ? { label: "Stocked", dot: true } : "Empty"} />
      </div>
      <p className="flex items-center gap-2 text-small text-muted">
        <Users className="size-4 stroke-[1.75]" aria-hidden />
        Everyone sees these the moment setup finishes.
      </p>
    </StepAside>
  );
}
