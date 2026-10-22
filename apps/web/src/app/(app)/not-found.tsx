import { AppWindow, BookOpen, Compass, House, LifeBuoy, Search, Users } from "lucide-react";
import { Page } from "@/components/page";
import { Button } from "@/components/ui/button";
import { HeroLight } from "@/components/ui/hero-light";
import { Input } from "@/components/ui/input";
import { Reveal, RevealItem } from "@/components/ui/motion";
import { Tile, TileWall } from "@/components/ui/tile-wall";

/**
 * Not-found inside the app shell. The navigation stays; the page is one lit panel with the search
 * the copy points to, beside the six places as a wall of tiles (the way out). Each place keeps the
 * colour it carries elsewhere: now-blue Home, green People, teal Knowledge, blue Help, violet
 * Onboarding, and Apps in the neutral ink of the launcher.
 */
const PLACES = [
  { href: "/", label: "Home", hint: "Your week, news and announcements", icon: House, color: "var(--lb-now)" },
  { href: "/people", label: "People", hint: "Everyone, and the org chart", icon: Users, color: "var(--lb-cat-green-to)" },
  { href: "/knowledge", label: "Knowledge", hint: "Policies, guides and team pages", icon: BookOpen, color: "var(--lb-cat-teal-to)" },
  { href: "/apps", label: "Apps", hint: "Every tool, signed in", icon: AppWindow, color: "#2B313C" },
  { href: "/help", label: "Help", hint: "Ask IT, People or Facilities", icon: LifeBuoy, color: "var(--lb-cat-blue-to)" },
  { href: "/journeys", label: "Onboarding", hint: "Your steps and your new joiners", icon: Compass, color: "var(--lb-cat-violet-to)" },
];

export default function AppNotFound() {
  return (
    <Page width="wide">
      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 pt-2 md:pt-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:items-stretch">
        {/* The page's one authored moment: the message builds in, code to search, on arrival. */}
        <section aria-labelledby="not-found-title" className="panel relative isolate flex flex-col justify-end overflow-hidden rounded-panel p-6 sm:p-10 lg:min-h-[520px]">
          <HeroLight tone="blue" position="top-right" intensity="strong" />
          <Reveal stagger={0.07}>
            <RevealItem from="fade">
              <p aria-hidden className="bg-gradient-to-b from-now to-now/40 bg-clip-text text-[112px] font-medium leading-[100px] tracking-[-0.06em] text-transparent tabular sm:text-[168px] sm:leading-[148px]">
                404
              </p>
            </RevealItem>
            <RevealItem>
              <h1 id="not-found-title" className="mt-3 text-title-sm font-medium text-fg text-balance md:text-title">
                <span className="sr-only">Error 404. </span>This page does not exist
              </h1>
            </RevealItem>
            <RevealItem>
              <p className="mt-3 max-w-[52ch] text-body-lg text-muted text-pretty">
                It may have moved, been archived, or be in a space you cannot see. Search for it, or pick it up from one of the places here.
              </p>
            </RevealItem>
            <RevealItem>
              <form action="/search" method="get" className="mt-8 flex max-w-md items-center gap-2">
                <label htmlFor="app-not-found-search" className="sr-only">
                  Search
                </label>
                <Input id="app-not-found-search" name="q" type="search" placeholder="Search people, pages, apps" leading={<Search aria-hidden />} />
                <Button type="submit">Search</Button>
              </form>
            </RevealItem>
          </Reveal>
        </section>
        <nav aria-label="Places" className="flex flex-col gap-3">
          <p className="px-1 text-row font-medium text-fg">Or pick it up from one of these</p>
          <TileWall min="160px" className="flex-1 [grid-auto-rows:1fr]">
            {PLACES.map((p) => {
              const Icon = p.icon;
              return <Tile key={p.href} href={p.href} color={p.color} icon={<Icon />} label={p.label} meta={p.hint} />;
            })}
          </TileWall>
        </nav>
      </div>
    </Page>
  );
}
