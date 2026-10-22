"use client";

import * as React from "react";
import {
  AppWindow, BookOpen, LineChart, Briefcase, Building2, CalendarClock, CheckCheck, Compass, Inbox, LifeBuoy, Laptop, PartyPopper,
  Receipt, RotateCw, Settings2, Users, Wallet,
} from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CategoryBlock, CategoryChip, type CategoryTone } from "@/components/ui/category-block";
import { CellList, CellMeta, RowCell } from "@/components/ui/cells";
import { HeroLight, type LightTone } from "@/components/ui/hero-light";
import { PillNav, PillNavButton, PillNavDivider, PillNavLink } from "@/components/ui/pill-nav";
import { Section } from "@/components/ui/section";
import { SectionSwitcher } from "@/components/ui/section-switcher";
import { Tile, TileWall } from "@/components/ui/tile-wall";
import { AnimatedBeam } from "@/components/ui/effects/animated-beam";
import { BorderBeam } from "@/components/ui/effects/border-beam";

/**
 * Kitchen sink, wave 3: every new kit piece, light beside dark. The fictional Northwind Labs data
 * here is sample content for the demo only.
 */
export default function Wave3Demo() {
  const [run, setRun] = React.useState(0);
  return (
    <main className="min-h-dvh bg-page px-4 py-10 text-fg sm:px-6">
      <div className="mx-auto flex max-w-[1240px] flex-col gap-12">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-caption font-medium text-subtle">Kitchen sink</p>
            <h1 className="text-title-sm font-medium md:text-title">Wave 3 kit</h1>
            <p className="mt-2 max-w-[66ch] text-row text-muted">
              Type with confidence, lit heroes, one navigation model, raised cells, category blocks, tile walls, phone
              sections and comet beams. Each demo shows the light theme beside the dark one.
            </p>
          </div>
          <Button variant="secondary" onClick={() => setRun((n) => n + 1)}>
            <RotateCw aria-hidden />
            Replay effects
          </Button>
        </header>

        <Pair title="Type scale" id="type">
          {() => <TypeScale />}
        </Pair>
        <Pair title="HeroLight: one light source per hero, tied to the data" id="light">
          {() => <Lights />}
        </Pair>
        <Pair title="Now rail and comet beams with an arrival pulse" id="rail" run={run}>
          {() => <RailAndComets key={run} />}
        </Pair>
        <Pair title="BorderBeam: saturated stroke with a coloured outer glow" id="beam" run={run}>
          {() => <Beams key={run} />}
        </Pair>
        <Pair title="PillNav: the one navigation model" id="nav">
          {(dark) => <Navs dark={dark} />}
        </Pair>
        <Pair title="CellList and RowCell" id="cells">
          {() => <Cells />}
        </Pair>
        <Pair title="CategoryBlock: every tone, three sizes" id="blocks">
          {() => <Blocks />}
        </Pair>
        <Pair title="TileWall: brand tiles and filled category tiles" id="tiles">
          {() => <Tiles />}
        </Pair>
        <Pair title="Phone pages: collapsible sections and a sticky switcher (open the page at 390 to fold)" id="phone" narrow>
          {(dark) => <PhoneSections dark={dark} />}
        </Pair>
      </div>
    </main>
  );
}

function Pair({ title, id, run, narrow, children }: { title: string; id: string; run?: number; narrow?: boolean; children: (dark: boolean) => React.ReactNode }) {
  return (
    <section aria-label={title} id={id} data-run={run} className="scroll-mt-6">
      <h2 className="mb-4 px-2 text-h3 font-medium text-fg md:text-h2">{title}</h2>
      <div className={narrow ? "grid gap-4 md:grid-cols-2" : "grid gap-4 xl:grid-cols-2"}>
        <div className="light min-w-0 rounded-slab bg-page p-4 text-fg shadow-slab sm:p-6">{children(false)}</div>
        <div className="dark slab min-w-0 rounded-slab bg-page p-4 text-fg shadow-slab sm:p-6">{children(true)}</div>
      </div>
    </section>
  );
}

function TypeScale() {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-display font-medium">Good morning, Maya</p>
      <p className="text-title font-medium">People</p>
      <p className="text-hero font-medium">Around the clock</p>
      <p className="text-h2 font-medium">Section title</p>
      <p className="text-row font-medium">Primary row text, 15px</p>
      <p className="text-body text-fg">Body, 14px. Reading text and controls.</p>
      <p className="text-caption text-muted">Metadata, 13px floor. Nothing in Lobby is smaller.</p>
    </div>
  );
}

const LIGHTS: { tone: LightTone; title: string; line: string }[] = [
  { tone: "amber", title: "2 due this week", line: "Acknowledge the security policy by Friday." },
  { tone: "teal", title: "3 in progress", line: "IT is working on your laptop request." },
  { tone: "red", title: "1 breaching", line: "A VPN ticket passed its 4 hour target." },
  { tone: "blue", title: "All quiet", line: "Nothing needs you right now." },
];

function Lights() {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {LIGHTS.map((l) => (
        <div key={l.tone} className="panel relative isolate overflow-hidden rounded-panel p-5">
          <HeroLight tone={l.tone} />
          <p className="text-caption text-muted">{l.tone === "amber" ? "Due" : l.tone === "teal" ? "Working" : l.tone === "red" ? "Breaching" : "Info"}</p>
          <p className="mt-1 text-hero font-medium">{l.title}</p>
          <p className="mt-1 text-body text-muted">{l.line}</p>
        </div>
      ))}
      <div className="panel-lit lit-violet relative rounded-panel p-5 sm:col-span-2">
        <p className="text-caption text-muted">Utility form: panel-lit lit-violet</p>
        <p className="mt-1 text-hero font-medium">Your first week</p>
      </div>
    </div>
  );
}

function RailAndComets() {
  const box = React.useRef<HTMLDivElement>(null);
  const hub = React.useRef<HTMLDivElement>(null);
  const a = React.useRef<HTMLDivElement>(null);
  const b = React.useRef<HTMLDivElement>(null);
  const c = React.useRef<HTMLDivElement>(null);
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  return (
    <div className="flex flex-col gap-6">
      <div className="relative grid grid-cols-7 gap-1.5">
        {days.map((d, i) => (
          <div key={d} className={i >= 5 ? "hatch h-24 rounded-cell" : "cell h-24 rounded-cell"}>
            <p className="px-2 pt-1.5 text-caption text-muted">{d}</p>
          </div>
        ))}
        <span aria-hidden className="now-rail absolute -bottom-1 -top-1 w-[2px]" style={{ left: "calc((100% - 9px) / 7 * 3.5 + 4.5px)" }} />
        <span aria-hidden className="now-dot absolute -top-2 size-2.5 -translate-x-1/2" style={{ left: "calc((100% - 9px) / 7 * 3.5 + 5.5px)" }} />
      </div>
      <div ref={box} className="relative h-56">
        <div ref={hub} className="cell absolute left-0 top-1/2 flex size-16 -translate-y-1/2 items-center justify-center rounded-full">
          <Users className="size-6 stroke-[1.75] text-accent-text" aria-hidden />
        </div>
        {[a, b, c].map((r, i) => (
          <div key={i} ref={r} className="cell absolute right-0 flex h-12 w-36 items-center gap-2 rounded-full px-2" style={{ top: `${8 + i * 34}%` }}>
            <Avatar name={["Ravi Shankar", "Carlos Mendes", "Sam Okafor"][i]!} seed={`demo-${i}`} size="md" />
            <span className="truncate text-body">{["Ravi", "Carlos", "Sam"][i]}</span>
          </div>
        ))}
        <AnimatedBeam containerRef={box} fromRef={hub} toRef={a} shape="s" tone="violet" repeat={Infinity} fromAnchor="right" toAnchor="left" />
        <AnimatedBeam containerRef={box} fromRef={hub} toRef={b} shape="s" tone="cyan" repeat={Infinity} delay={0.5} fromAnchor="right" toAnchor="left" />
        <AnimatedBeam containerRef={box} fromRef={hub} toRef={c} shape="s" tone="gold" repeat={Infinity} delay={1} fromAnchor="right" toAnchor="left" />
      </div>
    </div>
  );
}

function Beams() {
  return (
    <div className="grid gap-5 sm:grid-cols-2">
      {(["danger", "amber", "accent", "violet"] as const).map((t) => (
        <div key={t} className="cell relative isolate rounded-card p-5">
          <BorderBeam tone={t} loops={3} />
          <p className="text-row font-medium">{t === "danger" ? "SLA breaching" : t === "amber" ? "Acknowledge by Fri" : t === "accent" ? "Focused approval" : "Step up next"}</p>
          <p className="text-caption text-muted">tone="{t}"</p>
        </div>
      ))}
    </div>
  );
}

function Navs({ dark }: { dark: boolean }) {
  const [active, setActive] = React.useState("/people");
  const items = [
    { href: "/", label: "Home", icon: <AppWindow /> },
    { href: "/people", label: "People", icon: <Users /> },
    { href: "/knowledge", label: "Knowledge", icon: <BookOpen /> },
    { href: "/help", label: "Help", icon: <LifeBuoy />, count: 4 },
  ];
  const nav = (e: React.MouseEvent, href: string) => {
    e.preventDefault();
    setActive(href);
  };
  return (
    <div className="flex flex-col gap-5">
      <PillNav label={`Demo main ${dark ? "dark" : "light"}`} id={`demo-main-${dark ? "d" : "l"}`}>
        {items.map((i) => (
          <PillNavLink key={i.href} href={i.href} icon={i.icon} count={i.count} active={active === i.href} onClick={(e) => nav(e, i.href)}>
            {i.label}
          </PillNavLink>
        ))}
        <PillNavDivider />
        <PillNavButton icon={<Briefcase />} count={5} countLabel="waiting on you">
          Work
        </PillNavButton>
      </PillNav>
      <PillNav label={`Demo admin ${dark ? "dark" : "light"}`} id={`demo-admin-${dark ? "d" : "l"}`} size="sm" trackClassName="w-fit max-w-full">
        <PillNavLink href="#" active onClick={(e) => e.preventDefault()}>Overview</PillNavLink>
        <PillNavLink href="#" onClick={(e) => e.preventDefault()}>Audit log</PillNavLink>
        <PillNavDivider />
        <PillNavLink href="#" onClick={(e) => e.preventDefault()}>Branding</PillNavLink>
        <PillNavLink href="#" onClick={(e) => e.preventDefault()}>Identity & roles</PillNavLink>
        <PillNavDivider />
        <PillNavLink href="#" count={2} countTone="warning" countLabel="stale pages" onClick={(e) => e.preventDefault()}>Knowledge</PillNavLink>
        <PillNavLink href="#" onClick={(e) => e.preventDefault()}>AI assistant</PillNavLink>
      </PillNav>
      <div className="flex items-center gap-3 text-caption text-muted">
        <Inbox className="size-4" aria-hidden />
        The admin row, setup steps and the phone switcher are this same track at size sm.
        <CheckCheck className="size-4" aria-hidden />
        <Settings2 className="size-4" aria-hidden />
      </div>
    </div>
  );
}

function Cells() {
  const people = [
    { id: "p1", name: "Ravi Shankar", title: "Data Engineer", tag: <Badge tone="green" dot>Starts Monday</Badge> },
    { id: "p2", name: "Carlos Mendes", title: "Workplace Coordinator", tag: <Badge tone="violet" dot>Week 2</Badge> },
    { id: "p3", name: "Fatima Zahra", title: "Finance Lead", tag: null },
  ];
  const [sel, setSel] = React.useState("p2");
  return (
    <div className="flex flex-col gap-6">
      <CellList>
        {people.map((p) => (
          <RowCell
            key={p.id}
            onClick={() => setSel(p.id)}
            selected={sel === p.id}
            leading={<Avatar name={p.name} seed={p.id} size="lg" />}
            title={p.name}
            meta={p.title}
            trailing={p.tag}
          />
        ))}
      </CellList>
      <CellList density="compact">
        <RowCell
          href="#"
          leading={<BookOpen className="size-[18px] stroke-[1.75] text-muted" aria-hidden />}
          title="Holiday policy"
          meta={<CellMeta items={[<Avatar key="a" name="Fatima Zahra" seed="p3" size="xs" />, "Fatima Zahra", "3 weeks ago"]} />}
        />
        <RowCell leading={<Receipt className="size-[18px] stroke-[1.75] text-muted" aria-hidden />} title="Expenses policy" meta="Static cell, no action" />
      </CellList>
    </div>
  );
}

const TONES: { tone: CategoryTone; icon: React.ReactNode; title: string; status: string }[] = [
  { tone: "violet", icon: <Compass />, title: "Onboarding step", status: "Up next" },
  { tone: "green", icon: <PartyPopper />, title: "First day", status: "Monday" },
  { tone: "blue", icon: <LifeBuoy />, title: "New laptop", status: "In approval" },
  { tone: "amber", icon: <CalendarClock />, title: "Acknowledge policy", status: "By Fri" },
  { tone: "coral", icon: <Wallet />, title: "Payday", status: "Fri 30 Oct" },
  { tone: "teal", icon: <Laptop />, title: "IT is on it", status: "Working" },
];

function Blocks() {
  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-2 sm:grid-cols-2">
        {TONES.map((t) => (
          <CategoryBlock key={t.tone} size="sm" tone={t.tone} icon={t.icon} title={t.title} />
        ))}
      </div>
      <div className="grid gap-3">
        {TONES.map((t) => (
          <CategoryBlock key={t.tone} tone={t.tone} icon={t.icon} title={t.title} subtitle={`${t.tone[0]!.toUpperCase()}${t.tone.slice(1)} category`} status={{ label: t.status, dot: true }} href="#" />
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <CategoryBlock size="lg" tone="blue" icon={<Laptop />} title="IT" subtitle="12 request types" status="Most asked">
          <span className="flex flex-wrap gap-2">
            <CategoryChip tone="blue" href="#">New laptop</CategoryChip>
            <CategoryChip tone="blue" href="#">VPN issue</CategoryChip>
            <CategoryChip tone="blue" href="#">App access</CategoryChip>
          </span>
        </CategoryBlock>
        <CategoryBlock size="lg" tone="amber" icon={<Building2 />} title="Workplace" subtitle="4 request types" status={{ label: "1 open", dot: true }}>
          <span className="flex flex-wrap gap-2">
            <CategoryChip tone="amber" href="#">Desk booking</CategoryChip>
            <CategoryChip tone="amber" href="#">Building access</CategoryChip>
          </span>
        </CategoryBlock>
      </div>
    </div>
  );
}

function Tiles() {
  const apps = [
    { label: "Grafana", meta: "Dashboards", color: "#F46800", icon: <LineChart /> },
    { label: "Expenses", meta: "Claims and receipts", color: "#0F7F86", icon: <Receipt /> },
    { label: "Payroll", meta: "Payslips", color: "#6F36E6", icon: <Wallet /> },
    { label: "Wiki export", meta: "Read only", color: "#FFD44A", icon: <BookOpen /> },
  ];
  return (
    <div className="flex flex-col gap-6">
      <TileWall label="Engineering apps" min="140px">
        {apps.map((a, i) => (
          <Tile
            key={a.label}
            href="#"
            color={a.color}
            icon={a.icon}
            label={a.label}
            meta={a.meta}
            badge={i === 0 ? <Badge size="sm" tone="accent">Pinned</Badge> : undefined}
          />
        ))}
      </TileWall>
      <TileWall label="Help catalogue" min="200px">
        <Tile fill href="#" color="#2259D1" icon={<Laptop />} label="IT" meta="New laptop, VPN, app access" />
        <Tile fill href="#" color="#6F36E6" icon={<Users />} label="People" meta="Leave, payroll, details" />
        <Tile fill href="#" color="#F0B70A" icon={<Building2 />} label="Workplace" meta="Desks and building access" />
      </TileWall>
    </div>
  );
}

function PhoneSections({ dark }: { dark: boolean }) {
  const p = dark ? "d" : "l";
  return (
    <div className="flex flex-col gap-6">
      <SectionSwitcher
        label={`Demo sections ${dark ? "dark" : "light"}`}
        showOn="always"
        className="-mx-0 rounded-full bg-transparent px-0 backdrop-blur-none sm:-mx-0 sm:px-0"
        items={[
          { id: `${p}-team`, label: "Your team", count: 8 },
          { id: `${p}-new`, label: "New faces", count: 4 },
          { id: `${p}-offices`, label: "Offices", count: 6 },
        ]}
      />
      <Section id={`${p}-team`} title="Your team" count={8} collapsible defaultOpen summary="8 people, 2 away today">
        <CellList density="compact">
          <RowCell leading={<Avatar name="Grace Okoye" seed="g" size="md" />} title="Grace Okoye" meta="Engineering Manager" />
          <RowCell leading={<Avatar name="Maya Chen" seed="m" size="md" />} title="Maya Chen" meta="Software Engineer" />
        </CellList>
      </Section>
      <Section id={`${p}-new`} title="New faces" count={4} collapsible summary="Ravi, Carlos and 2 more joined this month">
        <CellList density="compact">
          <RowCell leading={<Avatar name="Ravi Shankar" seed="p1" size="md" />} title="Ravi Shankar" meta="Data Engineer" />
        </CellList>
      </Section>
      <Section id={`${p}-offices`} title="Offices" count={6} collapsible summary="London, Berlin, Lagos and 3 more">
        <p className="text-body text-muted">Six offices across four time zones.</p>
      </Section>
    </div>
  );
}
