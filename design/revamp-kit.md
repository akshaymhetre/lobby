# Lobby revamp kit

API reference for the area agents.
Written by the system agent on 2026-10-15, phase 1 of the UX revamp.
Everything here lives in `apps/web/src/components/ui/` (exported from `@/components/ui`) and `apps/web/src/components/page.tsx`.
Tokens are in `apps/web/src/app/globals.css` and documented in `design/tokens.md`.
Every component below is on the kitchen sink at `/kitchen-sink`, in both themes.

## The rules

1. **Rows, not cards.** A list of like things (people, pages, request types, tickets, posts after the first) is a list of 48 to 56px rows separated by `divide-y divide-border`, inside at most one `Card` or none. Never a grid of cards, never a card inside a card.
2. **No icon tiles.** A tinted square behind an icon is the one element that reads "template". Use a bare 16 or 18px Lucide icon in `text-muted`, or no icon.
3. **One width system.** `<Page width="wide" | "prose" | "full">` is the only place a page's max width is set. Delete every `max-w-[NNNpx]` on a page container. Inner reading columns inside a `full` page may constrain themselves, nothing else may.
4. **One rhythm.** `section-stack` between the sections of a page, `section-group` between a heading block and its content, `section-content` between siblings. Replace `gap-6` / `gap-8` / `gap-10` / `gap-12` between page sections with these.
5. **The masthead is the signature move.** Every top-level page carries it (dateline on). Detail pages use the same component without the dateline. Nothing else on the page competes with it: no second serif title, no hero, no banner above it.
6. **Accent means "something for you".** Accent appears on the one primary action, the active rail item, focus rings, the "Pinned" marker and links in the Today line. Not on likes (`reaction` tone), not on five chips in a row, not on four Approve buttons.
7. **Both themes are designed.** Check dark on every screen you touch.

## Masthead

```tsx
import { Masthead, MastheadLink } from "@/components/ui";
```

| Prop | Type | Notes |
|---|---|---|
| `title` | ReactNode | required |
| `size` | `"display" \| "h1" \| "h2"` | `display` on Home only; `h1` (default) on every other top-level page; `h2` for compact detail pages |
| `serif` | boolean | Newsreader title. Home, News and Knowledge titles only (kernel rule) |
| `dateline` | boolean | date + company + rule. Default `true` |
| `today` | ReactNode | the Today line, body-lg `text-fg`; use `MastheadLink` for the parts that are for the reader |
| `description` | ReactNode | quiet muted line; prefer `today` on top-level pages |
| `breadcrumb` | ReactNode | shown above the title, below the dateline |
| `actions` | ReactNode | right-aligned; wraps under the title below `sm` |
| `inlineActions` | boolean | keep actions beside the title at every width; pair with `size="icon"` buttons and `sm:` labels |
| `date`, `company` | string | overrides; normally come from `OrgProvider` (see Seam) |
| `children` | ReactNode | tabs or a toolbar that belong to the header |

The `h1` element is always rendered, whatever `size` is, so `getByRole("heading", { level: 1 })` keeps working.

### Home

```tsx
<Page width="wide">
  <Masthead
    size="display"
    serif
    title={`${greetingFor(hour)}, ${firstName}`}
    today={
      <>
        You have <MastheadLink href="/journeys">3 things to do</MastheadLink> and{" "}
        <MastheadLink href="/approvals">2 approvals waiting</MastheadLink>. The Berlin office opens in 18 days.
      </>
    }
  />
  ...
</Page>
```

Keep the Today line to one sentence of facts. Link the parts that are for the reader; leave company facts as plain text.
A `MastheadLink` never breaks across lines (the sentence breaks before it), so keep each link phrase to three words or fewer.
When nothing needs the reader, write a company fact instead of "Nothing needs you right now." alone.

### A top-level list page (People, Help, Knowledge, Apps, Approvals, Queue, Admin)

```tsx
<Page
  width="wide"
  title="People"
  today={<>218 people in 6 offices. <MastheadLink href="/people?filter=new">4 start this month</MastheadLink>.</>}
  actions={<Button asChild variant="secondary"><Link href="/people/org">Org chart</Link></Button>}
>
  ...
</Page>
```

`<Page title>` renders the Masthead with the dateline on. Pass `description` instead of `today` when there is no fact worth a link, but prefer a fact.
Knowledge and News titles pass `serif`.

### A detail page (a ticket, a person, a run, a knowledge page)

```tsx
<Page width="wide">
  <PageHeader
    breadcrumb={<Breadcrumb items={[{ label: "Help", href: "/help" }, { label: "#1045" }]} />}
    title={ticket.subject}
    description={`${type.name} · opened ${timeAgo(ticket.createdAt)}`}
    actions={<Button variant="secondary">Cancel request</Button>}
  />
  ...
</Page>
```

`PageHeader` is the Masthead with `dateline={false}` and `size="h1"` by default. Its old props all still work; `dateline`, `today`, `size` and `inlineActions` are new.
A detail page with one small action passes `inlineActions`, so the button stays top-right at 390 instead of dropping to a third row under the meta line.
`PageHeader` title moved from 24px to 30px (`md:` and up). If a dense admin table needs the old size, pass `size="h2"`.

### Mobile actions (audit D2)

```tsx
<Page
  title="Knowledge"
  inlineActions
  actions={
    <Button asChild size="icon" aria-label="New page" className="sm:w-auto sm:px-3.5 md:w-auto md:px-3.5">
      <Link href="/knowledge/new"><Plus aria-hidden /><span className="hidden sm:inline">New page</span></Link>
    </Button>
  }
>
```

## Page widths

```tsx
import { Page } from "@/components/page";

<Page width="wide">   // 1200px: lists, feeds, settings pages, anything with a right rail
<Page width="prose">  //  760px: reading, single-column forms, search
<Page width="full">   //  none:  tables, boards, the org chart, pages with their own tree sidebar
```

Tokens: `--container-page-wide`, `--container-page-prose`. The admin layout's prose pages keep `className="lg:mx-0"` to sit left of the admin rail; that is the only `className` a page should pass for width.
Knowledge space and journey builder pages that had 1280 and 1320 use `full` and let their own grid set the columns. Search uses `prose`.

## Section rhythm

```tsx
import { Section, SectionHeading } from "@/components/ui";

<div className="section-stack">                       {/* 40px between sections */}
  <Section title="Spaces" count={6} action={<Button variant="ghost" size="sm">New space</Button>}>
    <ul className="divide-y divide-border rounded-card border border-border bg-surface">…rows…</ul>
  </Section>
  <Section title="Recently updated" description="Pages someone touched this week." spaced>
    …siblings 16px apart…
  </Section>
  <Section tone="quiet" as="h3" title="Useful links" action={<Link …>View all</Link>}>
    …rows, no card…
  </Section>
</div>
```

| Prop | Notes |
|---|---|
| `title`, `description`, `count`, `action` | heading block; `count` renders in `text-subtle tabular` after the title |
| `tone` | `"page"` (18px semibold, default) or `"quiet"` (12px capitals, `text-subtle`) for rails and headed groups that replace stacked cards (audit B2) |
| `as` | `"h2"` (default) or `"h3"` |
| `spaced` | wraps children in `section-content` (16px gaps); leave off when the child is one list |

The utilities on their own: `section-stack` (flex column, 40px), `section-group` (24px), `section-content` (16px). Use the component for headed sections and the utilities for the page body.

## Disclosure

```tsx
import { Disclosure } from "@/components/ui";

<Disclosure title="Development: sign in as a demo user" aside="12 people">…</Disclosure>
<Disclosure variant="card" title="Advanced settings" defaultOpen>…</Disclosure>
<Disclosure variant="inline" title="Why do we ask for this?">…</Disclosure>
```

Native `<details>/<summary>` with the kit chevron (rotates 90deg in 120ms), so it works in server components and needs no client JavaScript. Keyboard: Tab to the summary, Enter or Space toggles. Several with the same `name` make an accordion. `open` and every other `<details>` attribute pass through.
Variants: `plain` (hairline above and below, default), `card` (bordered surface), `inline` (no lines, small muted text, for short asides). `contentClassName` and `summaryClassName` for adjustments.
Replace the three native `<details>` named in audit A4 (sign-in dev block, knowledge page "On this page", identity form) with this.

## DateField

```tsx
import { DateField, Calendar } from "@/components/ui";

<Field label="Start date" error={errors.startDate}>
  <DateField name="startDate" value={form.startDate} onValueChange={(v) => set("startDate", v)} />
</Field>

<DateField name="from" value={v.from} max={v.to || undefined} onValueChange={(from) => setV({ ...v, from })} />
<DateField name="dueDate" defaultValue="" placeholder="No due date" min={todayIso} />
```

| Prop | Notes |
|---|---|
| `name` | a hidden `<input>` posts the value under this name as `YYYY-MM-DD` (or `""`), exactly what the native input posted, so server actions keep working |
| `value` / `defaultValue` | `YYYY-MM-DD` or `""` |
| `onValueChange(iso)` | replaces `onChange={(e) => … e.target.value}`; it gets the string |
| `min`, `max` | inclusive, `YYYY-MM-DD` |
| `placeholder`, `disabled`, `required`, `clearable` | `clearable` (default true) shows the x inside the field |
| `id`, `aria-*` | `Field` wires `id`, `aria-describedby`, `aria-invalid` and `aria-required` onto the trigger, so a `<Field>` labels it |

Behaviour: the trigger is a button styled as an input (calendar icon, "15 Oct 2026" or the placeholder). Enter, Space or ArrowDown opens the popover; in the grid, arrows move a day or a week, PageUp/PageDown a month (Shift: a year), Home/End to the start and end of the week, Enter picks, Escape closes and returns focus. Today is marked with a dot and `aria-current="date"`. Weeks start on Monday, dates are formatted `en-GB`.
Dates are built from `{y, m, d}` only, never through `toISOString`, so a day never shifts with the timezone.
`Calendar` is exported on its own for an inline month (the journey preview). Typed input is not supported in this version; a filter bar that needs typing keeps a plain `Input` with `inputMode="numeric"` and a `pattern`, and says so in its report.
Replace the six native date inputs named in audit A4 with `DateField`.

## Reactions (likes)

```tsx
import { ReactionButton } from "@/components/ui";

<ReactionButton pressed={post.liked} count={post.likes} onClick={toggle} />          // 32px, in a post meta line
<ReactionButton pressed={post.liked} count={post.likes} size="sm" onClick={toggle} /> // 28px, in a 44px row
```

Unpressed: outline heart in `text-muted`. Pressed: the heart fills in `text-reaction` (a muted clay, `#A94A33` light / `#E59A86` dark) and the hover tint is `bg-reaction-soft`. The count is tabular. `aria-pressed` carries the state; the accessible name is `"Like, 12"`.
Rule: a like is never `danger` red and never the accent. Use the `reaction` tokens directly (`text-reaction`, `bg-reaction-soft`, `fill-current`) if you need a different icon.

## Rail tone (shell agent)

`bg-rail` is one lightness step below the page (`#F1EFEA` light, `#0F0F0E` dark, both equal to `sunken`) and `bg-rail-selected` is the active item background on it (`rgb(28 27 25 / 0.09)` light, `rgb(236 234 228 / 0.10)` dark, one step stronger than `selected` so it still reads on the darker ground).
Every text token clears AA on `rail`: fg 14.98 / 15.94, muted 5.80 / 7.19, subtle 4.67 / 5.51, accent-text 6.52 / 9.27 (light / dark). The accent icon and the focus ring clear 3:1 on it (6.52 / 6.98).

```tsx
<aside className="… border-r border-border bg-rail …">
  <Link className={active ? "bg-rail-selected font-medium text-fg" : "text-muted hover:bg-hover hover:text-fg"}>
```

Keep the 1px border. Apply the same tone to the mobile sheet's nav area so the two match. The admin sub-rail stays on `bg-page` so it is subordinate (audit G7).

## Card, Badge, EmptyState changes

- `Card interactive`: hover now steps the surface (`bg-sunken/40` light, `bg-raised` dark) as well as the border, with a 0.5 percent press on a `[data-press]` child. No change to the API.
- `Badge size="sm"`: 22px tall at the 12px caption size (was 20px at 11px). Prefer `md`; `sm` only inside a 44px row.
- `EmptyState`: the dashed frame is gone unless `dropzone` is set (CSV import, uploads). First-run, filtered and error states render frameless at `py-14` (or `compact` inside a `Card`). The icon is a bare 24px icon (20px compact), not a tinted tile.

## Seam the integrator applies

`app/(app)/layout.tsx` must mount the org context so the Masthead gets the company name and the dateline without a fetch per page:

```tsx
import { OrgProvider, formatDateline } from "@/components/ui/org-context";
…
const tz = ctx.user.timezone || org.timezone;
…
<OrgProvider value={{ companyName: org.companyName, productName: org.productName, timezone: tz, dateline: formatDateline(new Date(), tz) }}>
  <AppShell …>{children}</AppShell>
</OrgProvider>
```

Until that lands, the Masthead renders the date on the client after mount and omits the company name. Outside the shell (sign-in, setup), pass `company` and `date` explicitly or leave `dateline` off.

## v2 material (2026-10-16, the Home gate)

The v2 redesign (design/DIRECTION-v2.md) kept every token name and every kit API above. What changed underneath, and what a screen can now use:

**Typeface.** One face, Plus Jakarta Sans (`--font-jakarta`). `font-serif` still compiles and renders the sans; delete it as you touch a file. Headings are weight 500 (the base layer sets it), never bold.

**Surfaces.** `bg-canvas` (behind the slab) > `bg-page` (the slab) > `bg-surface` (a panel) > `bg-raised` (a cell) > `bg-sunken` (a well). Depth is tonal: use the `panel` and `cell` utilities (tone + soft shadow + 1px top highlight) instead of `border border-border`. Borders still exist, faint, for row dividers only. Radii are concentric: `rounded-slab` 28 > `rounded-panel` 24 > `rounded-card` 16 > `rounded-cell` 12 > `rounded-control` 10; buttons and chips are `rounded-full`.

**Elevation tokens.** `shadow-slab`, `shadow-panel`, `shadow-cell`, `shadow-cell-hover`, `shadow-inset` (fields), `shadow-popover`, `shadow-dialog`, `shadow-highlight`. `press` gives a control the response motion (scale 0.97 on press, -1px lift on hover).

**Colour.** `now` (+ `-fg`, `-soft`, `-text`) is the vivid blue for today. Categories: `cat-violet` (onboarding step), `cat-green` (first day), `cat-blue` (request or approval), `cat-amber` (announcement deadline), `cat-coral` (payday), each as a gradient utility that sets its own text colour, plus `bg-cat-*-soft` / `text-cat-*-text`. `Badge` accepts the five category tones. The default brand accent is now vivid blue (`#2A5FE6`), still passed through the accessible generator.

**Glass and glow.** `glass` (blur + tint + lighter top edge) is the material of dark mode; in light mode it is reserved for the orb and the detail panel. `shadow-glow-violet|gold|cyan` for a soft halo behind an emissive thing. `hatch` draws non-working days; `now-line` is the dashed today line; the assistant's face is the `<Orb>` component (`components/ui/effects/orb.tsx`, states idle | typing | thinking | done); the old `orb` CSS utility is gone.

**Motion** (`components/ui/motion.tsx`, all reduced-motion aware): `Reveal` + `RevealItem` (staggered build), `CountUp`, `Words`, `BlurIn`, `Panel3D`, `LightSweep`, `Pressable`, `SlidingPill`. `Tabs` and `SegmentedControl` already slide their active pill. Spend an authored moment in one place per screen; everything else is the `press` utility.

**Avatars.** `Avatar` draws a generated illustrated face from `seed` (pass the person's id) when there is no photo. Never render initials.

**Shell.** The top bar holds the six primary destinations as pills (`nav "Main"`), the rail holds Approvals, Help queue and Admin as circular buttons, phones get a bottom dock. `Masthead` keeps its API; `serif` is ignored and the dateline is a caption line with no rule.

**Rollout checklist per screen.** Replace `border border-border bg-surface` boxes with `panel` or `cell`; swap `font-semibold` headings for `font-medium`; drop `font-serif`; give the one primary action `variant="primary"` and the rest `secondary` (now raised white pills); check 390 for anything under the dock (main carries `pb-24` on phones); screenshot both themes.

## Effects library (2026-10-16)

All in `components/ui/effects/`, also exported from `@/components/ui`. Each is reduced-motion aware, pauses off screen, and has a live demo under `/kitchen-sink/effects/<name>`.

- `BorderBeam` (`border-beam.tsx`): a light that travels around a card's border, with a surface glow that moves with it. Host must be `relative isolate` with a radius; render it as the first child. Props: `tone` (accent | danger | now | violet | amber | green), `intensity` (vivid for attention, subtle for ambient), `loops` (default 2, then it settles), `duration`, `delay`, `active`, `size`. Use at most one or two per viewport, and only on the thing that needs attention.
- `AnimatedBeam` and `BeamPath` (`animated-beam.tsx`): connector lines that draw on and carry travelling sparks. Use them for relationships (org chart, timelines, flows).
- `SpotlightLayer` (`spotlight.tsx`): a cursor-follow surface and border light for cards people point at. Host must be `relative isolate`. `Tilt` (`tilt.tsx`): a subtle 3D tilt plus sheen for hero tiles only. `ShimmerText` (`shimmer-text.tsx`): a shimmer for "working" labels.
- `Orb` (`orb.tsx`) and `StreamText` (`stream-text.tsx`): the assistant's face and streamed answer text.

**Trap:** `cn()` (tailwind-merge) silently drops CSS Module class names that start with a utility prefix, such as `border-*` or `text-*`. Join module classes with a template string, never through `cn()`.

## Wave 3 (2026-10-16): the system pieces areas build on

Written by the wave 3 SYSTEM agent.
Live demos of every piece, light beside dark: `/kitchen-sink/wave3`.
Screenshots: `design/v2-shots/wave3/system/{before,after,kitchen}/`. Effect frames: `design/effects-shots/wave3/`.
Everything below is exported from `@/components/ui`.

### Type scale (problem 5)

| Token | Size | Use |
|---|---|---|
| `text-display` | 52/58, -2.5% | the Home greeting only |
| `text-title` | 44/50, -2% | every page title (Masthead `h1`, from md) |
| `text-title-sm` | 34/40 | page titles on phones (Masthead below md) |
| `text-hero` | 32/38, -2% | the title inside a screen's ONE hero module |
| `text-h2` | 24/32 | section titles (`Section tone="page"` from md) |
| `text-row` | 15/22 | primary row text (RowCell titles, menu rows) |
| `text-body` | 14/20 | reading text and controls |
| `text-caption`, `text-small` | 13/18 | metadata and secondary text: 13px is the floor |

Rules:
- Separate levels by a jump in size, not by greyer text. Nothing in the product is under 13px.
- No tracked ALL-CAPS labels. A screen may carry ONE eyebrow; `Section tone="quiet"` is now sentence case.
- Fewer middle dots: break "A · B · C" into `<CellMeta items={[avatar, name, time]} />`.
- Masthead sizes moved with the scale: `display` 52, `h1` 44 (34 on phones), `h2` 30.

### Lit dark mode (problem 3)

```tsx
<div className="panel relative isolate overflow-hidden rounded-panel p-6">
  <HeroLight tone="amber" />                 // one per hero, from the DATA: amber due, teal working,
  <h2 className="text-hero font-medium">…    // red breaching, blue info, violet onboarding, green done
</div>
<div className="panel-lit lit-red rounded-panel p-6">…</div>   // utility form, no child needed
```

- `HeroLight` props: `tone`, `position` (top-left default, top, top-right, bottom-left, bottom-right, center), `intensity` (normal | strong), `animate` (slow 14s breathing; off under reduced motion). Host: `relative isolate overflow-hidden`.
- Dark is emitted light (a wide bloom plus a hot core); light is a tint you can see on white without a pink wash.
- `now-rail` replaces the dashed `now-line`: put it on a 2px-wide absolutely positioned element. Solid now-blue, an outer glow, and a glint that travels down it every 3.2s (stops under reduced motion). `now-rail-x` is horizontal. `now-dot` is the lit head disc for the top of the rail.
- `AnimatedBeam` sparks are now comets: a 24 to 40px gradient streak with a 12px blurred halo in the tone. Dark lit lines glow too.
  - `onArrive(pass)` fires each time a comet reaches the end of its path (BeamPath and AnimatedBeam).
  - `AnimatedBeam` pulses its target on arrival by default (`pulseTarget`, default true): a ring swells out of the node in the tone colour.
  - `pulseNode(el, color?)` does the same for any element (an org chart node you draw yourself). CSS: `[data-pulse="on"]`.
- `BorderBeam` in light mode is a saturated 2px stroke plus a coloured outer glow around the card (0 0 24px at 35%) while it runs, fading with the run. No surface tint, no travelling bloom, no inner blurred ring (they read as a pink smear and grey smudges on paper). Dark is unchanged.

### One navigation model (problem 7)

```tsx
<PillNav label="Admin" id="admin-nav" size="sm">
  <PillNavLink href="/admin" active>Overview</PillNavLink>
  <PillNavDivider />
  <PillNavLink href="/admin/knowledge" count={2} countTone="warning" countLabel="stale pages">Knowledge</PillNavLink>
</PillNav>
```

- One material for every "where am I" control: a sunken track and the active destination as a raised pill that slides (`pill-active`: a white cell in light, a lit glass pill in dark).
- `PillNav` props: `label` (the landmark name), `id` (unique per page, keys the sliding pill), `size` (md 40px | sm 36px), `as` (nav | div), `trackClassName`. It scrolls sideways when it overflows, keeps the active pill in view, and fades its edges only while there is more to scroll.
- `PillNavLink` props: `href`, `active`, `icon` (a Lucide element), `count`, `countTone` (accent | warning | quiet), `countLabel` (spoken after the count), `labelFrom` (hide the visible label below a breakpoint), `current` (page | step | location).
- `level="secondary"` is for a row that belongs to a lit parent (the admin row under the lit "Work" pill): no track, and the active item is a tinted accent pill with no shadow, so parent and child never read at the same weight.
- `PillNavButton` is a pill that opens a menu. `PillCount` is the shared count badge. `PillNavDivider` separates groups.
- Where it is used:
  - The top bar (`nav "Main"`): the six destinations, a divider, then ONE labelled "Work" pill for every role, at every width. Its count is the total waiting (approvals plus unassigned queue). It always opens a "Your work" menu (Approvals, Help queue, Admin, each with its own count), so the control behaves the same for every role. It is the raised pill whenever you are on a work page.
  - Exactly one pill is lit: `activeHref(pathname, items)` in `lib/nav.ts` picks the longest matching prefix, ties to the later item. So `/admin/journeys` lights Admin for an admin and Onboarding for a journey manager (Onboarding now also matches `/admin/journeys`).
  - Admin: a second row of pill tabs under the top bar (`AdminNav`), aligned with the page content. The sidebar is gone. Groups are divided and named for assistive tech. The journey-manager gate and the stale badge are unchanged.
  - Setup: the six steps are the pill track in the wizard's top bar (numbered discs that turn into checks), with progress as one line under it. Same slab, same top bar.
  - Phones: the dock carries a sixth slot, Work, which opens the menu sheet (its "Your work" group) and is the lit slot on any work page, so the dock always says where you are. `SectionSwitcher` (below) is the same track inside a page.
- `NavItem` has a new optional `short` label for tight rows (`"Queue"` for "Help queue").

### Assistant answers (problem 9)

- Retrieval-only answers render as `AnswerCards` (`components/assistant/sources.tsx`): the lead card shows the key fact big when the page has one ("26 weeks / full pay"), the remaining facts as label and value, list items as numbered steps, prose cut on sentence boundaries with field labels ("Category:", "Asks for:") stripped, the source kind, its freshness (Verified, Due for review, Stale), and an Open action. The whole card opens the source; the link is named by the full source title.
- The lead card is the answer: raised, lit by a blue HeroLight, the key fact set at 32px. Supporting sources are quieter wells with one fact and whole sentences only.
- Retrieval-only mode is one quiet "Pages only" chip under the answer (with "Turn them on" for admins), not a banner under the header.
- Finished answers scroll so the question sits at the top; "Ask next" chips fill the space under them. The empty state's history is de-duplicated by title.
- The excerpt logic is pure and reusable: `buildExcerpt(chunk)` and `cleanSnippet(snippet)` in `components/assistant/excerpt.ts`.
- Data: retrieval-only citations now carry `excerpt` (the matched chunk, up to 900 characters, already ACL-filtered by search) and `freshness` (the search factor) as extra jsonb keys. Older conversations without them fall back to the cleaned snippet.

### Cells, category blocks and tile walls (problems 1 and 6)

```tsx
<CellList density="comfortable" | "compact" layout="list" | "grid" min="280px">
  <RowCell href="/people/123" leading={<Avatar … size="lg" />} title="Ravi Shankar" meta="Data Engineer"
    trailing={<Badge tone="green" dot>Starts Monday</Badge>} />
</CellList>
```

- `RowCell`: separate raised cells, 12px apart (8px compact), with the top highlight and a soft shadow. Props: `title` (15px), `meta` (13px), `leading`, `trailing`, `children` (under the title), `href` or `onClick` (interactive: hover lift, press, focus ring, chevron for links), `selected` (accent ring), `density`, `chevron`, `wrapperClassName`. An `<li>` inside a CellList, a `<div>` outside one.
- Hairline tables stay only for true data grids: Queue, Audit and Content health.

```tsx
<CategoryBlock tone="blue" icon={<LifeBuoy />} title="New laptop" subtitle="IT" status={{ label: "In approval", dot: true }} />
<CategoryBlock size="lg" tone="violet" icon={<Compass />} title="Your first week" subtitle="4 of 10 steps">
  <CategoryChip tone="violet" href="/journeys">Set up your laptop</CategoryChip>
</CategoryBlock>
```

- `CategoryBlock` tones: violet (onboarding step), green (first day, done), blue (request or approval), amber (deadline, due), coral (payday, breaching), teal (working, in progress; new). Sizes: `sm` 44px one line, `md` 64px with a subtitle, `lg` a 132px+ tile with room for children. `href` or `onClick` makes it pressable. All tones clear AA in both themes (measured with contrast.py: white on every stop 4.57 to 6.28, dark ink on amber 5.82 to 9.31).
- `CategoryChip` is a chip ON a block. Pass the block's `tone` so it frosts the right way (darkening frost under white text, lightening under amber's ink). A block with `href` must not contain linked chips.
- `Badge` gained `tone="teal"`; the cat utilities gained `cat-teal`, `bg-cat-teal-soft`, `text-cat-teal-text`.

```tsx
<TileWall label="Engineering" min="148px">
  <Tile href={app.url} external color={app.color} icon={<AppIcon … />} label="Grafana" meta="Dashboards" badge={<Badge size="sm">Pinned</Badge>} />
</TileWall>
<TileWall min="220px">
  <Tile fill color="#2259D1" icon={<Laptop />} label="IT" meta="New laptop, VPN, app access" href="/help?team=it" />
</TileWall>
```

- `Tile`: a raised cell with a glossy brand-colour icon plate, or with `fill` the whole tile in the colour. Text on a filled tile is white or dark ink, chosen by measured luminance (`inkOn(hex)`), so any brand colour stays AA. Press depth: lifts on hover, sinks 2px with an inner shadow while pressed.

### Phone sections (problem 8)

```tsx
<SectionSwitcher items={[{ id: "team", label: "Your team", count: 8 }, { id: "new", label: "New faces", count: 4 }]} />
<Section id="team" title="Your team" count={8} collapsible defaultOpen summary="8 people, 2 away today">…</Section>
<Section id="new" title="New faces" count={4} collapsible summary="Ravi, Carlos and 2 more">…</Section>
```

- `Section collapsible` folds on phones only (below md): the heading row becomes a 44px button with a chevron, `summary` shows while folded, and from md up the section is always open. Needs an `id`. `defaultOpen` sets the phone start state.
- `SectionSwitcher`: a sticky PillNav of the page's sections. It highlights the section you are reading, and a tap opens a folded section and scrolls to it. `showOn="mobile"` (default) or `"always"`. `openSection(id)` opens one from your own code.
- Section counts are now a small raised chip, and every Section carries `scroll-mt-24`.

### Things area agents still own

- Home's planner still draws the dashed `now-line`; swap it for `now-rail` plus `now-dot`.
- Small text: after the wave 3 area pass, no area file sets text under 13px. The only exception is the avatar initials fallback in `components/ui/avatar.tsx`, which shows only when no generated art renders.
- `components/setup/step-header.tsx` keeps "STEP 2 OF 6 · ABOUT 2 MIN" as the wizard's one eyebrow.
