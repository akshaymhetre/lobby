"use client";

import * as React from "react";
import { useTheme } from "@/components/theme";
import { PlannerError } from "@/components/home/planner";
import { AssistantErrorNotice } from "@/components/shell/assistant-panel";
import {
  Archive,
  ArrowRight,
  BookOpen,
  CalendarDays,
  ChevronRight,
  FileText,
  Filter,
  Inbox,
  LayoutGrid,
  List,
  Mail,
  Moon,
  MoreHorizontal,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Settings,
  Share2,
  Sun,
  Trash2,
  TriangleAlert,
  Users,
} from "lucide-react";
import {
  Avatar,
  AvatarStack,
  Badge,
  Breadcrumb,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Checkbox,
  Calendar,
  Chip,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  Command,
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DateField,
  Disclosure,
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  EmptyState,
  Field,
  Input,
  Kbd,
  KbdCombo,
  Label,
  Masthead,
  MastheadLink,
  OrgProvider,
  PageHeader,
  formatDateline,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Progress,
  ProgressRing,
  RadioGroup,
  RadioGroupItem,
  ReactionButton,
  Section as KitSection,
  SegmentedControl,
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
  Separator,
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  Skeleton,
  SkeletonRow,
  Stat,
  StatGroup,
  Switch,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TRow,
  Tabs,
  TabsContent,
  TabsCount,
  TabsList,
  TabsTrigger,
  Textarea,
  Toaster,
  Tooltip,
  toast,
  type SortDirection,
} from "@/components/ui";

const people = [
  { name: "Maya Okafor", role: "Head of People", team: "People", location: "Lisbon", start: "2021-03-08" },
  { name: "Daniel Reyes", role: "Staff Engineer", team: "Platform", location: "Austin", start: "2019-11-18" },
  { name: "Priya Raman", role: "Product Designer", team: "Design", location: "Bengaluru", start: "2023-06-01" },
  { name: "Tomas Lindqvist", role: "IT Lead", team: "IT", location: "Stockholm", start: "2020-02-03" },
  { name: "Hannah Weiss", role: "Finance Partner", team: "Finance", location: "Berlin", start: "2022-09-12" },
  { name: "Kwame Mensah", role: "Support Engineer", team: "Support", location: "Accra", start: "2024-01-15" },
];

function Section({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-20 border-t border-border py-10 first:border-t-0 first:pt-2">
      <div className="mb-5 flex flex-col gap-1">
        <h2 id={`${id}-title`} className="text-h4 font-semibold text-fg">
          {title}
        </h2>
        {description ? <p className="text-body text-muted">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

function Row({ label, children }: { label?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 py-2 md:flex-row md:items-center md:gap-6">
      {label ? <div className="w-28 shrink-0 text-caption font-medium text-subtle">{label}</div> : null}
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3">{children}</div>
    </div>
  );
}

function Demo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-caption font-medium text-subtle">{label}</span>
      <div className="rounded-card border border-border bg-page px-5 pt-5 pb-5">{children}</div>
    </div>
  );
}

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  const value = mounted ? (resolvedTheme ?? "light") : "light";
  return (
    <SegmentedControl
      aria-label="Theme"
      size="sm"
      value={value}
      onValueChange={setTheme}
      options={[
        { value: "light", label: "Light", icon: <Sun /> },
        { value: "dark", label: "Dark", icon: <Moon /> },
      ]}
    />
  );
}

const nav = [
  ["masthead", "Masthead"],
  ["rhythm", "Widths & rhythm"],
  ["buttons", "Buttons"],
  ["forms", "Forms"],
  ["date", "Date field"],
  ["disclosure", "Disclosure"],
  ["badges", "Badges"],
  ["avatars", "Avatars"],
  ["cards", "Cards & stats"],
  ["table", "Table"],
  ["tabs", "Tabs"],
  ["overlays", "Overlays"],
  ["command", "Command"],
  ["feedback", "Feedback"],
  ["empty", "Empty states"],
  ["reaction", "Reactions"],
  ["type", "Type & colour"],
] as const;

export default function KitchenSinkPage() {
  const [sort, setSort] = React.useState<{ key: "name" | "start"; dir: SortDirection }>({ key: "name", dir: "asc" });
  const [view, setView] = React.useState("list");
  const [range, setRange] = React.useState("week");
  const [cmdOpen, setCmdOpen] = React.useState(false);
  const [notify, setNotify] = React.useState(true);
  const [chips, setChips] = React.useState<string[]>(["Engineering", "Lisbon"]);
  const [showArchived, setShowArchived] = React.useState(false);
  const [selected, setSelected] = React.useState<string | null>("Priya Raman");
  const [startDate, setStartDate] = React.useState("2026-11-02");
  const [dueDate, setDueDate] = React.useState("");
  const [liked, setLiked] = React.useState<Record<string, boolean>>({ a: true, b: false, c: false });
  // Sample org for the masthead demos; the app shell provides the real one through (app)/layout.tsx.
  const org = React.useMemo(
    () => ({ companyName: "Northwind Labs", productName: "Lobby", timezone: "Europe/London", dateline: formatDateline(new Date(), "Europe/London") }),
    [],
  );

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setCmdOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const sorted = [...people].sort((a, b) => {
    const k = sort.key;
    const r = a[k].localeCompare(b[k]);
    return sort.dir === "desc" ? -r : r;
  });
  const toggleSort = (key: "name" | "start") =>
    setSort((s) => ({ key, dir: s.key === key ? (s.dir === "asc" ? "desc" : "asc") : "asc" }));

  return (
    <OrgProvider value={org}>
    <div className="min-h-dvh bg-page">
      <header className="sticky top-0 z-40 border-b border-border bg-page/90 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-[1120px] items-center justify-between gap-4 px-4 md:px-8">
          <div className="flex items-center gap-2.5">
            <span className="inline-flex size-7 items-center justify-center rounded-control bg-accent font-serif text-body-lg font-medium text-accent-fg">
              L
            </span>
            <span className="text-body font-semibold">Lobby</span>
            <span className="text-subtle">/</span>
            <span className="text-body text-muted">UI kit</span>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <div className="mx-auto grid max-w-[1120px] gap-10 px-4 py-8 md:grid-cols-[160px_minmax(0,1fr)] md:px-8">
        <nav aria-label="Sections" className="hidden md:block">
          <ul className="sticky top-24 flex flex-col gap-0.5">
            {nav.map(([id, label]) => (
              <li key={id}>
                <a
                  href={`#${id}`}
                  className="focus-ring block rounded-control px-2 py-1.5 text-small text-muted transition-colors hover:bg-hover hover:text-fg"
                >
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <main className="min-w-0">
          <PageHeader
            breadcrumb={<Breadcrumb items={[{ label: "Design", href: "#" }, { label: "Kitchen sink" }]} />}
            title="Every component, every state"
            description="The Lobby primitives on one page, in both themes, so the kit can be reviewed before screens are built on it."
            today={
              <>
                Effects:{" "}
                {[
                  ["border-beam", "Border beam"],
                  ["animated-beam", "Connector beams"],
                  ["spotlight", "Spotlight and tilt"],
                  ["orb", "Assistant orb"],
                ].map(([slug, label], i) => (
                  <React.Fragment key={slug}>
                    {i ? ", " : null}
                    <a href={`/kitchen-sink/effects/${slug}`} className="text-accent-text underline underline-offset-4">
                      {label}
                    </a>
                  </React.Fragment>
                ))}
              </>
            }
            actions={
              <>
                <Button variant="secondary" onClick={() => setCmdOpen(true)}>
                  <Search />
                  Search
                  <KbdCombo keys={["⌘", "K"]} className="ml-1 hidden md:inline-flex" />
                </Button>
                <Button onClick={() => toast.success("Draft saved", { description: "Only you can see it until you publish." })}>
                  <Plus />
                  New page
                </Button>
              </>
            }
          />

          <Section id="masthead" title="Masthead" description="The signature move. Every top-level page carries the dateline, the company name and one rule; the Today line is the only place plain text mixes with accent links.">
            <div className="flex flex-col gap-6">
              <Demo label="Home: display size, Newsreader, a Today line">
                <Masthead
                  size="display"
                  serif
                  title="Good evening, Maya"
                  today={
                    <>
                      You have <MastheadLink href="#masthead">3 things to do</MastheadLink> and{" "}
                      <MastheadLink href="#masthead">2 approvals waiting</MastheadLink>. The Berlin office opens in 18 days.
                    </>
                  }
                  className="pb-0 md:pb-0"
                />
              </Demo>
              <Demo label="Top-level page: h1 in Hanken, actions on the right">
                <Masthead
                  title="People"
                  today={
                    <>
                      218 people in 6 offices. <MastheadLink href="#masthead">4 start this month</MastheadLink>.
                    </>
                  }
                  actions={
                    <>
                      <Button variant="secondary" size="sm">
                        <Filter />
                        Filters
                      </Button>
                      <Button size="sm">
                        <Plus />
                        Add person
                      </Button>
                    </>
                  }
                  className="pb-0 md:pb-0"
                />
              </Demo>
              <Demo label="Knowledge page: PageHeader, no dateline, breadcrumb, serif title (Knowledge and News only), one inline action">
                <PageHeader
                  inlineActions
                  breadcrumb={<Breadcrumb items={[{ label: "Knowledge", href: "#masthead" }, { label: "People", href: "#masthead" }, { label: "Parental leave" }]} />}
                  serif
                  title="Parental leave"
                  description="Verified 22 Apr 2026 by Priya Raman. Next review 19 Oct 2026."
                  actions={
                    <Button variant="secondary" size="sm">
                      <Pencil />
                      Edit
                    </Button>
                  }
                  className="pb-0 md:pb-0"
                />
              </Demo>
            </div>
          </Section>

          <Section id="rhythm" title="Widths & rhythm" description="Three page widths and one vertical rhythm. Nothing else sets a max width or a section gap.">
            <div className="grid grid-cols-[56px_minmax(0,1fr)_64px] items-center gap-x-3 gap-y-2">
              {[
                ["wide", "1200px", "w-[90%] rounded-[4px]"],
                ["prose", "760px", "w-[57%] rounded-[4px]"],
                ["full", "no limit", "w-full rounded-l-[4px] [mask-image:linear-gradient(to_right,black_80%,transparent)]"],
              ].map(([name, px, w]) => (
                <React.Fragment key={name}>
                  <span className="text-caption font-medium text-subtle">{name}</span>
                  <div className={`h-6 bg-sunken dark:bg-raised ${w}`} />
                  <span className="text-right text-caption tabular text-muted">{px}</span>
                </React.Fragment>
              ))}
            </div>
            <div className="section-stack mt-8 rounded-card border border-dashed border-border p-5">
              <KitSection title="Spaces" count={3} action={<Button variant="ghost" size="sm">New space</Button>} description="Page tone with a count and an action.">
                <ul className="divide-y divide-border rounded-card border border-border bg-surface">
                  {["Engineering handbook", "People policies", "Finance"].map((n) => (
                    <li key={n} className="flex h-[52px] items-center justify-between gap-3 px-4">
                      <span className="text-body font-medium">{n}</span>
                      <ChevronRight className="size-4 text-subtle" aria-hidden />
                    </li>
                  ))}
                </ul>
              </KitSection>
              <KitSection title="Recently updated" description="Page tone with a description; `spaced` puts 16px between the siblings below.">
                <ul className="divide-y divide-border rounded-card border border-border bg-surface">
                  {[
                    ["Expenses policy", "2 days ago"],
                    ["Laptop setup", "4 days ago"],
                  ].map(([n, t]) => (
                    <li key={n} className="flex h-[52px] items-center justify-between gap-3 px-4">
                      <span className="text-body font-medium">{n}</span>
                      <span className="flex items-center gap-3 text-small text-muted">
                        {t}
                        <ChevronRight className="size-4 text-subtle" aria-hidden />
                      </span>
                    </li>
                  ))}
                </ul>
              </KitSection>
              <KitSection tone="quiet" as="h3" title="Useful links" description="Quiet tone: 12px capitals for a rail group that replaces a card." action={<a href="#rhythm" className="focus-ring rounded-[4px] text-small text-accent-text hover:underline">View all</a>}>
                <ul className="flex flex-col">
                  {["Holiday calendar", "Office map", "Expense claim"].map((n) => (
                    <li key={n}>
                      <a href="#rhythm" className="focus-ring -mx-2 flex h-9 items-center justify-between gap-3 rounded-control px-2 text-body text-fg transition-colors hover:bg-hover">
                        {n}
                        <ChevronRight className="size-4 text-subtle" aria-hidden />
                      </a>
                    </li>
                  ))}
                </ul>
              </KitSection>
              <p className="text-caption text-subtle">40px between sections (section-stack), 24px heading to content (section-group), 16px between siblings (section-content).</p>
            </div>
            <Row label="Rail tone">
              <div className="flex overflow-hidden rounded-card border border-border">
                <div className="flex w-40 flex-col gap-1 bg-rail p-2">
                  <span className="rounded-control px-2 py-1.5 text-small text-muted">Home</span>
                  <span className="rounded-control bg-rail-selected px-2 py-1.5 text-small font-medium text-fg">People</span>
                  <span className="rounded-control px-2 py-1.5 text-small text-muted">Knowledge</span>
                </div>
                <div className="flex-1 bg-page p-4 text-small text-muted">page</div>
              </div>
            </Row>
          </Section>

          <Section id="buttons" title="Buttons" description="Five variants, four sizes, a loading state, and asChild for links.">
            <Row label="Variants">
              <Button>Primary</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="danger">Delete</Button>
              <Button variant="link">Link button</Button>
            </Row>
            <Row label="Sizes">
              <Button size="sm">Small</Button>
              <Button size="md">Medium</Button>
              <Button size="lg">Large</Button>
              <Tooltip label="Settings">
                <Button size="icon" variant="secondary" aria-label="Settings">
                  <Settings />
                </Button>
              </Tooltip>
              <Tooltip label="More actions">
                <Button size="icon" variant="ghost" aria-label="More actions">
                  <MoreHorizontal />
                </Button>
              </Tooltip>
            </Row>
            <Row label="With icons">
              <Button>
                <Plus />
                Add teammate
              </Button>
              <Button variant="secondary">
                <Share2 />
                Share
              </Button>
              <Button variant="ghost">
                View all
                <ArrowRight />
              </Button>
            </Row>
            <Row label="States">
              <Button loading>Saving</Button>
              <Button variant="secondary" loading>
                Syncing
              </Button>
              <Button disabled>Disabled</Button>
              <Button variant="secondary" disabled>
                Disabled
              </Button>
              <Button asChild variant="secondary">
                <a href="#forms">Anchor as button</a>
              </Button>
            </Row>
          </Section>

          <Section id="forms" title="Forms" description="Field wires the label, help and error text to its control.">
            <div className="grid gap-x-6 gap-y-5 md:grid-cols-2">
              <Field label="Full name" help="As it should appear in the directory." required>
                <Input placeholder="Maya Okafor" />
              </Field>
              <Field label="Work email" error="Use your @northwind.dev address.">
                <Input type="email" defaultValue="maya@example.com" leading={<Mail />} />
              </Field>
              <Field label="Team" controlId="ks-team" help="Sets who sees your team updates.">
                <Select defaultValue="people">
                  <SelectTrigger id="ks-team" aria-describedby="ks-team-help">
                    <SelectValue placeholder="Choose a team" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectLabel>Departments</SelectLabel>
                      <SelectItem value="people">People</SelectItem>
                      <SelectItem value="platform">Platform</SelectItem>
                      <SelectItem value="design">Design</SelectItem>
                      <SelectItem value="finance">Finance</SelectItem>
                      <SelectItem value="support" disabled>
                        Support (full)
                      </SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Search people" aside={<a className="focus-ring rounded-[4px] text-accent-text hover:underline" href="#date">Advanced</a>}>
                <Input placeholder="Name, role or skill" leading={<Search />} trailing={<Kbd>/</Kbd>} />
              </Field>
              <Field label="Disabled field" help="Managed by your identity provider.">
                <Input defaultValue="Northwind Labs" disabled />
              </Field>
              <Field label="Start date" help="A themed picker, posted as YYYY-MM-DD.">
                <DateField name="startDate" value={startDate} onValueChange={setStartDate} />
              </Field>
              <Field label="About you" help="Two or three lines is plenty." className="md:col-span-2">
                <Textarea placeholder="What you work on, what people can ask you about." />
              </Field>
            </div>

            <div className="mt-8 grid gap-8 md:grid-cols-3">
              <fieldset className="flex flex-col gap-3">
                <legend className="mb-3 text-small font-medium">Notify me about</legend>
                <div className="flex items-center gap-2.5">
                  <Checkbox id="cb-1" defaultChecked />
                  <Label htmlFor="cb-1" className="font-normal">
                    Company news
                  </Label>
                </div>
                <div className="flex items-center gap-2.5">
                  <Checkbox id="cb-2" checked="indeterminate" />
                  <Label htmlFor="cb-2" className="font-normal">
                    Team updates (some)
                  </Label>
                </div>
                <div className="flex items-center gap-2.5">
                  <Checkbox id="cb-3" />
                  <Label htmlFor="cb-3" className="font-normal">
                    Mentions only
                  </Label>
                </div>
                <div className="flex items-center gap-2.5">
                  <Checkbox id="cb-4" disabled />
                  <Label htmlFor="cb-4" className="font-normal">
                    Payroll (required)
                  </Label>
                </div>
              </fieldset>

              <fieldset className="flex flex-col">
                <legend className="mb-3 text-small font-medium">Digest frequency</legend>
                <RadioGroup defaultValue="daily">
                  {["Daily", "Weekly", "Never"].map((v) => (
                    <div key={v} className="flex items-center gap-2.5">
                      <RadioGroupItem value={v.toLowerCase()} id={`r-${v}`} />
                      <Label htmlFor={`r-${v}`} className="font-normal">
                        {v}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              </fieldset>

              <div className="flex flex-col gap-4">
                <span className="text-small font-medium">Preferences</span>
                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor="sw-1" className="font-normal">
                    Desktop notifications
                  </Label>
                  <Switch id="sw-1" checked={notify} onCheckedChange={setNotify} />
                </div>
                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor="sw-2" className="font-normal">
                    Compact rows
                  </Label>
                  <Switch id="sw-2" size="sm" />
                </div>
                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor="sw-3" className="font-normal">
                    Out of office
                  </Label>
                  <Switch id="sw-3" disabled />
                </div>
              </div>
            </div>

            <div className="mt-8 flex flex-col gap-3">
              <span className="text-small font-medium">Segmented control</span>
              <div className="flex flex-wrap items-center gap-3">
                <SegmentedControl
                  aria-label="Layout"
                  value={view}
                  onValueChange={setView}
                  options={[
                    { value: "list", label: "List", icon: <List /> },
                    { value: "grid", label: "Grid", icon: <LayoutGrid /> },
                  ]}
                />
                <SegmentedControl
                  aria-label="Range"
                  size="sm"
                  value={range}
                  onValueChange={setRange}
                  options={[
                    { value: "day", label: "Today" },
                    { value: "week", label: "This week" },
                    { value: "month", label: "This month" },
                  ]}
                />
              </div>
            </div>
          </Section>

          <Section id="date" title="Date field" description="Replaces the native date input. Posts YYYY-MM-DD under the field name; arrows, PageUp/PageDown, Home/End and Enter work in the grid.">
            <Row label="Calendar">
              <div className="w-[280px] rounded-card border border-border bg-raised p-3 shadow-popover">
                <Calendar value={startDate} onSelect={setStartDate} onClear={() => setStartDate("")} />
              </div>
              <p className="max-w-[320px] text-small text-muted">The grid on its own, for an inline month. Bound to the Start date field above.</p>
            </Row>
            <div className="mt-6 grid gap-x-6 gap-y-5 md:grid-cols-3">
              <Field label="Due date" help="Empty, with a placeholder.">
                <DateField name="dueDate" value={dueDate} onValueChange={setDueDate} placeholder="No due date" />
              </Field>
              <Field label="Review by" help="Bounded: this month only." required>
                <DateField name="reviewBy" defaultValue="2026-10-20" min="2026-10-01" max="2026-10-31" />
              </Field>
              <Field label="Last day" error="Must be on or after 2 Nov 2026, the start date.">
                <DateField name="lastDay" defaultValue="2026-10-01" />
              </Field>
              <Field label="Start date" help="Managed by your identity provider.">
                <DateField name="managedStart" defaultValue="2021-03-08" disabled />
              </Field>
            </div>
          </Section>

          <Section id="disclosure" title="Disclosure" description="Native details and summary, so it works without JavaScript and the keyboard gets it free. The kit chevron replaces the browser marker.">
            <div className="grid gap-6 md:grid-cols-2">
              <div className="flex flex-col">
                <Disclosure title="Development: sign in as a demo user" aside="4 people">
                  <ul className="flex flex-col gap-0.5 text-small">
                    {people.slice(0, 4).map((p) => (
                      <li key={p.name} className="flex items-baseline justify-between gap-3 rounded-control px-2 py-1.5 hover:bg-hover">
                        <span className="text-fg">{p.name}</span>
                        <span className="truncate text-caption text-subtle">{p.role}</span>
                      </li>
                    ))}
                  </ul>
                </Disclosure>
                <Disclosure title="On this page" className="border-t-0">
                  <ol className="flex flex-col gap-1 text-small text-muted">
                    <li>Summary</li>
                    <li>Who is eligible</li>
                    <li>How to apply</li>
                  </ol>
                </Disclosure>
              </div>
              <div className="flex flex-col gap-4">
                <Disclosure variant="card" title="Advanced settings" defaultOpen>
                  <Field label="Groups claim" help="The token claim that carries group membership.">
                    <Input defaultValue="groups" />
                  </Field>
                </Disclosure>
                <Disclosure variant="inline" title="Why do we ask for this?">
                  <p className="text-small text-muted">Finance needs a cost centre to approve anything over 500 GBP.</p>
                </Disclosure>
              </div>
            </div>
          </Section>

          <Section id="badges" title="Badges & chips" description="Status chips pair a soft fill with a dot and a word, so colour is never the only signal.">
            <Row label="Tones">
              <Badge>Draft</Badge>
              <Badge tone="accent">New</Badge>
              <Badge tone="success">Verified</Badge>
              <Badge tone="warning">Review due</Badge>
              <Badge tone="danger">Stale</Badge>
              <Badge tone="info">In progress</Badge>
            </Row>
            <Row label="With dot">
              <Badge dot>Archived</Badge>
              <Badge tone="accent" dot>
                Pinned
              </Badge>
              <Badge tone="success" dot>
                Verified
              </Badge>
              <Badge tone="warning" dot>
                Review due
              </Badge>
              <Badge tone="danger" dot>
                Stale
              </Badge>
              <Badge tone="info" dot>
                Waiting on IT
              </Badge>
            </Row>
            <Row label="Small">
              <Badge size="sm">3</Badge>
              <Badge size="sm" tone="accent">
                Beta
              </Badge>
              <Badge size="sm" tone="danger" dot>
                Overdue
              </Badge>
            </Row>
            <Row label="Filter chips">
              {["Engineering", "Design", "Lisbon", "Remote"].map((c) => {
                const on = chips.includes(c);
                return (
                  <Chip
                    key={c}
                    selected={on}
                    onClick={() => setChips((s) => (on ? s.filter((x) => x !== c) : [...s, c]))}
                    onRemove={on ? () => setChips((s) => s.filter((x) => x !== c)) : undefined}
                  >
                    {c}
                  </Chip>
                );
              })}
            </Row>
          </Section>

          <Section id="avatars" title="Avatars" description="Initials fall back on a warm tint derived from the name, so a person keeps their colour everywhere.">
            <Row label="Sizes">
              <Avatar name="Maya Okafor" size="xs" />
              <Avatar name="Maya Okafor" size="sm" />
              <Avatar name="Maya Okafor" size="md" />
              <Avatar name="Maya Okafor" size="lg" status="online" />
              <Avatar name="Maya Okafor" size="xl" status="away" />
            </Row>
            <Row label="Tints">
              {people.map((p) => (
                <Avatar key={p.name} name={p.name} size="lg" />
              ))}
            </Row>
            <Row label="Stack">
              <AvatarStack people={people} max={4} size="md" />
              <span className="text-small text-muted">Maya, Daniel and 4 others are going</span>
            </Row>
          </Section>

          <Section id="cards" title="Cards & stats">
            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardHeader>
                  <CardTitle>Benefits enrollment</CardTitle>
                  <CardDescription>Open until 15 November</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  <div className="flex items-center justify-between text-small">
                    <span className="text-muted">Completed</span>
                    <span className="tabular font-medium">142 of 218</span>
                  </div>
                  <Progress value={65} />
                </CardContent>
                <CardFooter>
                  <Button size="sm" variant="secondary">
                    Remind the rest
                  </Button>
                  <Button size="sm" variant="ghost" className="ml-auto">
                    Details
                  </Button>
                </CardFooter>
              </Card>
              <Card>
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <CardTitle>Expense policy</CardTitle>
                    <Badge tone="success" dot>
                      Verified
                    </Badge>
                  </div>
                  <CardDescription>Finance · updated 12 days ago</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-body text-muted">
                    Meals while travelling are covered up to the local daily rate. Submit receipts within 30 days.
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Your onboarding</CardTitle>
                  <CardDescription>Week 2 of 6</CardDescription>
                </CardHeader>
                <CardContent className="flex items-center gap-4">
                  <ProgressRing value={38} size={56} strokeWidth={5} label="Onboarding progress" />
                  <div className="flex flex-col gap-0.5">
                    <span className="text-body font-medium">5 of 13 done</span>
                    <span className="text-small text-muted">Next: meet your buddy</span>
                  </div>
                </CardContent>
              </Card>
            </div>
            <StatGroup className="mt-4">
              <div>
                <Stat label="Headcount" value="218" delta={{ value: "+6", direction: "up", good: true }} hint="this quarter" />
              </div>
              <div>
                <Stat label="Open tickets" value="34" delta={{ value: "+9", direction: "up", good: false }} hint="vs last week" />
              </div>
              <div>
                <Stat label="Median first reply" value="1h 12m" delta={{ value: "-18%", direction: "down", good: true }} />
              </div>
              <div>
                <Stat label="Pages verified" value="91%" delta={{ value: "0%", direction: "flat" }} hint="no change" />
              </div>
            </StatGroup>
          </Section>

          <Section id="table" title="Table" description="44px rows, sortable headers with aria-sort, tabular figures for numbers.">
            <Table>
              <THead>
                <TRow>
                  <TH sortable sorted={sort.key === "name" ? sort.dir : false} onSort={() => toggleSort("name")}>
                    Name
                  </TH>
                  <TH>Team</TH>
                  <TH className="hidden md:table-cell">Location</TH>
                  <TH sortable align="right" sorted={sort.key === "start" ? sort.dir : false} onSort={() => toggleSort("start")}>
                    Started
                  </TH>
                  <TH className="w-12">
                    <span className="sr-only">Actions</span>
                  </TH>
                </TRow>
              </THead>
              <TBody>
                {sorted.map((p) => (
                  <TRow key={p.name} interactive selected={selected === p.name} onClick={() => setSelected(p.name)}>
                    <TD>
                      <div className="flex items-center gap-3">
                        <Avatar name={p.name} size="sm" />
                        <div className="flex min-w-0 flex-col">
                          <span className="truncate font-medium">{p.name}</span>
                          <span className="truncate text-small text-muted">{p.role}</span>
                        </div>
                      </div>
                    </TD>
                    <TD>
                      <Badge>{p.team}</Badge>
                    </TD>
                    <TD className="hidden text-muted md:table-cell">{p.location}</TD>
                    <TD numeric className="text-muted">
                      {new Date(p.start).toLocaleDateString("en-GB", { month: "short", year: "numeric" })}
                    </TD>
                    <TD className="pr-2">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="icon-sm" variant="ghost" aria-label={`Actions for ${p.name}`} onClick={(e) => e.stopPropagation()}>
                            <MoreHorizontal />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>
                            <Users />
                            View profile
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Mail />
                            Send message
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TD>
                  </TRow>
                ))}
              </TBody>
            </Table>
          </Section>

          <Section id="tabs" title="Tabs">
            <Tabs defaultValue="all">
              <TabsList>
                <TabsTrigger value="all">
                  All <TabsCount>24</TabsCount>
                </TabsTrigger>
                <TabsTrigger value="mine">
                  Assigned to me <TabsCount>3</TabsCount>
                </TabsTrigger>
                <TabsTrigger value="waiting">Waiting</TabsTrigger>
                <TabsTrigger value="closed" disabled>
                  Closed
                </TabsTrigger>
              </TabsList>
              <TabsContent value="all">
                <div className="flex flex-col divide-y divide-border">
                  <SkeletonRow />
                  <SkeletonRow />
                  <SkeletonRow />
                </div>
              </TabsContent>
              <TabsContent value="mine">
                <p className="text-body text-muted">You have 3 open requests. The oldest is 2 days old.</p>
              </TabsContent>
              <TabsContent value="waiting">
                <p className="text-body text-muted">Nothing is waiting on someone else right now.</p>
              </TabsContent>
            </Tabs>
          </Section>

          <Section id="overlays" title="Overlays" description="Dialog, sheet, menu, popover and tooltip. All close on Escape and return focus.">
            <Row>
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="secondary">Open dialog</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Archive this page?</DialogTitle>
                    <DialogDescription>
                      &ldquo;Expense policy&rdquo; will move to the archive. Links to it keep working and show an archived notice.
                    </DialogDescription>
                  </DialogHeader>
                  <DialogBody>
                    <Field label="Reason (optional)">
                      <Input placeholder="Replaced by the 2027 policy" />
                    </Field>
                  </DialogBody>
                  <DialogFooter>
                    <DialogClose asChild>
                      <Button variant="secondary">Cancel</Button>
                    </DialogClose>
                    <DialogClose asChild>
                      <Button onClick={() => toast("Page archived", { action: { label: "Undo", onClick: () => {} } })}>
                        <Archive />
                        Archive page
                      </Button>
                    </DialogClose>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="secondary">Open sheet</Button>
                </SheetTrigger>
                <SheetContent>
                  <SheetHeader>
                    <SheetTitle>Priya Raman</SheetTitle>
                    <SheetDescription>Product Designer · Design · Bengaluru</SheetDescription>
                  </SheetHeader>
                  <SheetBody className="flex flex-col gap-5">
                    <div className="flex items-center gap-3">
                      <Avatar name="Priya Raman" size="xl" status="online" />
                      <div className="flex flex-col gap-1">
                        <span className="text-body font-medium">Priya Raman</span>
                        <span className="text-small text-muted">Local time 21:14 · usually replies within an hour</span>
                      </div>
                    </div>
                    <Separator />
                    <dl className="grid grid-cols-[96px_1fr] gap-x-4 gap-y-3 text-body">
                      <dt className="text-muted">Manager</dt>
                      <dd>Daniel Reyes</dd>
                      <dt className="text-muted">Started</dt>
                      <dd>June 2023</dd>
                      <dt className="text-muted">Ask about</dt>
                      <dd className="flex flex-wrap gap-1.5">
                        <Badge>Design systems</Badge>
                        <Badge>Research</Badge>
                      </dd>
                    </dl>
                  </SheetBody>
                  <SheetFooter>
                    <Button variant="secondary">
                      <CalendarDays />
                      Book time
                    </Button>
                    <Button>
                      <Mail />
                      Message
                    </Button>
                  </SheetFooter>
                </SheetContent>
              </Sheet>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="secondary">
                    Menu
                    <MoreHorizontal />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuLabel>Page</DropdownMenuLabel>
                  <DropdownMenuItem shortcut="E">
                    <Pencil />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem shortcut="⇧S">
                    <Share2 />
                    Share
                  </DropdownMenuItem>
                  <DropdownMenuCheckboxItem checked={showArchived} onCheckedChange={(c) => setShowArchived(c === true)}>
                    Show archived
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem destructive shortcut="⌫">
                    <Trash2 />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="secondary">
                    <Filter />
                    Filters
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="flex flex-col gap-3">
                  <span className="text-small font-medium">Show people in</span>
                  {["Lisbon", "Austin", "Berlin"].map((city) => (
                    <div key={city} className="flex items-center gap-2.5">
                      <Checkbox id={`pc-${city}`} defaultChecked={city === "Lisbon"} />
                      <Label htmlFor={`pc-${city}`} className="font-normal">
                        {city}
                      </Label>
                    </div>
                  ))}
                  <Separator className="my-1" />
                  <div className="flex justify-end gap-2">
                    <Button size="sm" variant="ghost">
                      Reset
                    </Button>
                    <Button size="sm">Apply</Button>
                  </div>
                </PopoverContent>
              </Popover>

              <Tooltip label="Refresh" shortcut="R">
                <Button variant="ghost" size="icon" aria-label="Refresh">
                  <RefreshCw />
                </Button>
              </Tooltip>
            </Row>
          </Section>

          <Section id="command" title="Command" description="cmdk, styled. Press ⌘K anywhere on this page to open the dialog.">
            <Card className="max-w-[560px] overflow-hidden">
              <Command>
                <CommandInput placeholder="Search people, pages and apps" />
                <CommandList className="max-h-[260px]">
                  <CommandEmpty>No matches. Try a name or a page title.</CommandEmpty>
                  <CommandGroup heading="People">
                    <CommandItem>
                      <Avatar name="Maya Okafor" size="xs" className="-mx-0.5" />
                      Maya Okafor
                      <span className="text-small text-muted">Head of People</span>
                    </CommandItem>
                    <CommandItem>
                      <Avatar name="Daniel Reyes" size="xs" className="-mx-0.5" />
                      Daniel Reyes
                      <span className="text-small text-muted">Staff Engineer</span>
                    </CommandItem>
                  </CommandGroup>
                  <CommandSeparator />
                  <CommandGroup heading="Pages">
                    <CommandItem shortcut="↵">
                      <FileText />
                      Expense policy
                    </CommandItem>
                    <CommandItem>
                      <BookOpen />
                      New starter handbook
                    </CommandItem>
                  </CommandGroup>
                </CommandList>
              </Command>
            </Card>
            <CommandDialog
              open={cmdOpen}
              onOpenChange={setCmdOpen}
              footer={
                <>
                  <span className="inline-flex items-center gap-1.5">
                    <KbdCombo keys={["↑", "↓"]} /> to move
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Kbd>↵</Kbd> to open
                  </span>
                  <span className="ml-auto inline-flex items-center gap-1.5">
                    <Kbd>esc</Kbd> to close
                  </span>
                </>
              }
            >
              <CommandInput placeholder="Search Northwind Labs" />
              <CommandList>
                <CommandEmpty>No matches. Try a name or a page title.</CommandEmpty>
                <CommandGroup heading="Jump to">
                  <CommandItem onSelect={() => setCmdOpen(false)}>
                    <Inbox />
                    My requests
                  </CommandItem>
                  <CommandItem onSelect={() => setCmdOpen(false)}>
                    <Users />
                    People directory
                  </CommandItem>
                  <CommandItem onSelect={() => setCmdOpen(false)}>
                    <BookOpen />
                    Knowledge
                  </CommandItem>
                </CommandGroup>
              </CommandList>
            </CommandDialog>
          </Section>

          <Section id="feedback" title="Feedback" description="Toasts, progress and loading placeholders.">
            <Row label="Toasts">
              <Button variant="secondary" onClick={() => toast.success("Request sent", { description: "IT usually replies within 2 hours." })}>
                Success
              </Button>
              <Button variant="secondary" onClick={() => toast.error("Couldn't reach the HR system", { description: "We'll retry in a minute." })}>
                Error
              </Button>
              <Button variant="secondary" onClick={() => toast.warning("Review due on 3 pages")}>
                Warning
              </Button>
              <Button variant="secondary" onClick={() => toast.info("Opening Expenses with SSO")}>
                Info
              </Button>
              <Button
                variant="secondary"
                onClick={() =>
                  toast.promise(new Promise((r) => setTimeout(r, 1500)), {
                    loading: "Publishing",
                    success: "Published to everyone",
                    error: "Couldn't publish",
                  })
                }
              >
                Promise
              </Button>
            </Row>
            <Row label="Progress">
              <div className="flex w-full max-w-[420px] flex-col gap-3">
                <Progress value={72} />
                <Progress value={45} tone="success" />
                <Progress value={88} tone="warning" size="sm" />
                <Progress value={20} tone="danger" size="sm" />
              </div>
            </Row>
            <Row label="Rings">
              <ProgressRing value={25} label="Profile complete" />
              <ProgressRing value={60} tone="success" label="Training" />
              <ProgressRing value={90} tone="warning" label="Storage" size={48} />
              <ProgressRing value={75} label="Quiet" showValue={false} size={20} strokeWidth={3} />
            </Row>
            <Row label="Skeleton">
              <div className="flex w-full max-w-[420px] flex-col gap-2">
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-4/5" />
              </div>
            </Row>
            <Row label="Kbd">
              <KbdCombo keys={["⌘", "K"]} />
              <KbdCombo keys={["⇧", "⌘", "P"]} />
              <Kbd>esc</Kbd>
              <Kbd>/</Kbd>
            </Row>
          </Section>

          <Section id="empty" title="Empty states" description="Each says what will appear and offers the one action that makes it appear.">
            <Demo label="Page level: frameless, in the space the content will fill. The dashed frame is only for a drop target (dropzone).">
              <EmptyState
                variant="first-run"
                icon={<BookOpen />}
                title="No pages in this space yet"
                description="Write the first page, or import existing documents."
                action={
                  <Button size="sm">
                    <Plus />
                    New page
                  </Button>
                }
              />
            </Demo>
            <p className="mb-2 mt-6 text-caption font-medium text-subtle">Compact, inside the list&apos;s own Card</p>
            <div className="grid gap-4 md:grid-cols-2">
              <Card className="h-full">
                <EmptyState
                  compact
                  variant="filtered"
                  icon={<Search />}
                  title="Nobody matches those filters"
                  description="Try removing Lisbon or searching by role."
                  action={
                    <Button size="sm" variant="secondary">
                      Clear filters
                    </Button>
                  }
                />
              </Card>
              <Card className="h-full">
                <EmptyState
                  compact
                  variant="error"
                  icon={<TriangleAlert />}
                  title="Couldn't load the directory"
                  description="The HR connector timed out. Your data is safe."
                  action={
                    <Button size="sm" variant="secondary">
                      <RefreshCw />
                      Try again
                    </Button>
                  }
                />
              </Card>
            </div>
          </Section>

          <Section id="home-states" title="Home states" description="What Home shows when a read fails: the planner keeps its header and offers a retry; a failed assistant answer keeps the question and offers to try again.">
            <div className="flex flex-col gap-6">
              <PlannerError onRetry={() => {}} />
              <div className="max-w-[400px] rounded-panel panel p-4">
                <p className="mb-3 rounded-card rounded-br-[6px] bg-accent-soft px-3.5 py-2 text-body text-fg">How much parental leave do we get?</p>
                <AssistantErrorNotice message="The assistant is unavailable right now. Your question was not lost." onRetry={() => {}} />
              </div>
            </div>
          </Section>

          <Section id="reaction" title="Reactions" description="A like is a muted clay, not danger red and not the accent. The count is tabular so a column of posts lines up.">
            <Row label="States (12 liked, 3, 0, no count, small)">
              {(["a", "b", "c"] as const).map((k, i) => (
                <ReactionButton key={k} pressed={!!liked[k]} count={[12, 3, 0][i]} onClick={() => setLiked((s) => ({ ...s, [k]: !s[k] }))} />
              ))}
              <ReactionButton pressed={false} label="Like" />
              <ReactionButton pressed size="sm" count={7} />
            </Row>
            <Row label="In a row">
              <div className="flex w-full max-w-[560px] items-center gap-3 border-y border-border py-2 text-small text-muted">
                <Avatar name="Daniel Reyes" size="xs" />
                <span className="truncate">Daniel Reyes · 2 hours ago · Engineering</span>
                <ReactionButton pressed count={4} size="sm" className="ml-auto" />
              </div>
            </Row>
          </Section>

          <Section id="type" title="Type & colour">
            <div className="flex flex-col gap-4">
              <p className="font-serif text-display font-normal">Good morning, Maya</p>
              <p className="text-body-lg text-muted">You have 3 things to do today and one birthday to celebrate.</p>
              <div className="flex flex-col gap-2">
                <span className="text-h1 font-semibold">Heading 1 · 30/38</span>
                <span className="text-h2 font-semibold">Heading 2 · 24/32</span>
                <span className="text-h3 font-semibold">Heading 3 · 20/28</span>
                <span className="text-h4 font-semibold">Heading 4 · 18/26</span>
                <span className="text-body-lg">Body large · 16/24 for prose</span>
                <span className="text-body">Body · 14/20, the default UI size</span>
                <span className="text-small text-muted">Small · 13/18 muted</span>
                <span className="text-caption text-subtle">Caption · 12/16 subtle</span>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4 md:grid-cols-6">
                {[
                  ["page", "bg-page"],
                  ["surface", "bg-surface"],
                  ["raised", "bg-raised"],
                  ["sunken", "bg-sunken"],
                  ["border", "bg-border"],
                  ["border-strong", "bg-border-strong"],
                  ["fg", "bg-fg"],
                  ["muted", "bg-muted"],
                  ["subtle", "bg-subtle"],
                  ["accent", "bg-accent"],
                  ["accent-soft", "bg-accent-soft"],
                  ["accent-text", "bg-accent-text"],
                  ["success", "bg-success"],
                  ["warning", "bg-warning"],
                  ["danger", "bg-danger"],
                  ["info", "bg-info"],
                  ["success-soft", "bg-success-soft"],
                  ["warning-soft", "bg-warning-soft"],
                  ["reaction", "bg-reaction"],
                  ["reaction-soft", "bg-reaction-soft"],
                  ["rail", "bg-rail"],
                  ["rail-selected", "bg-rail-selected"],
                ].map(([name, cls]) => (
                  <div key={name} className="flex flex-col gap-1.5">
                    <div className={`h-10 rounded-control border border-border ${cls}`} />
                    <span className="text-caption text-muted">{name}</span>
                  </div>
                ))}
              </div>
            </div>
          </Section>
        </main>
      </div>
      <Toaster />
    </div>
    </OrgProvider>
  );
}
