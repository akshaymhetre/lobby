# Lobby design kernel

This file is the single source of design direction.
Every screen, token and component derives from it.

## Stance

Lobby is the front door of a company: the first tab an employee opens and the one they come back to all day.
It should feel calm, trustworthy and quietly confident, like a well-run office lobby, not like a marketing site or a social network.
Reference bar: Linear (density, keyboard-first, restraint), Notion (content calm), Vercel dashboard (crisp hierarchy), Rippling (people data done well), Simpplr and Workvivo (intranet-specific patterns: feed, org chart, journeys).

## Anti-goals (the "AI slop" list)

- No purple-to-blue gradients, no glassmorphism, no glowing blobs, no gradient text.
- No emoji as icons. Icons are Lucide, 1.5px stroke, 16px or 20px.
- No centered marketing-hero layouts inside the app. This is an application shell.
- No generic "Welcome to your dashboard!" copy. Write like a person who works there.
- No shadows heavier than a hairline lift; elevation comes from surface tone and borders.
- No lorem ipsum. Seed data is a believable fictional company.

## Layout model

- Application shell: persistent left rail (240px, collapsible to 64px), top bar (56px) with Cmd-K search and an Ask AI button, content area with a max reading width only where content is prose.
- Optional right detail panel (400px) for ticket detail, person preview, AI chat.
- Mobile (below 768px): rail becomes a bottom sheet menu opened from the top bar; content is single column.
- Spacing scale: 4px base (4, 8, 12, 16, 20, 24, 32, 40, 48, 64).
- Density: medium. Table rows 44px, list rows 52px, controls 36px (40px touch on mobile, 44px minimum touch target).

## Typography

- UI: **Hanken Grotesk** (variable), humanist grotesk, warm without being cute, has tabular figures.
- Editorial accents: **Newsreader** (serif, optical sizes) for the home greeting, news headlines and page titles in Knowledge only. Never for UI controls.
- Scale (px / line-height): 12/16 caption, 13/18 small, 14/20 body (default UI), 16/24 body-large (prose), 18/26 h4, 20/28 h3, 24/32 h2, 30/38 h1, 40/48 display (serif greeting).
- Weights: 400 body, 500 UI emphasis and labels, 600 headings. Never 700+ in UI.
- Numbers in tables, SLAs and counters use `font-variant-numeric: tabular-nums`.

## Colour

Neutrals are warm stone, not blue-grey.
The accent is the customer's brand colour, passed through a generator that keeps text on it at WCAG AA; the default is deep spruce `#2F5D50`.

Light (default): page `#F7F6F3`, surface `#FFFFFF`, sunken `#F1EFEA`, border `#E4E1DA`, border-strong `#D3CFC6`, text `#1C1B19`, text-muted `#6B675F`, text-subtle `#8A857C`.
Dark (designed, not inverted): page `#131312`, surface `#1A1A18`, raised `#21211F`, sunken `#0F0F0E`, border `#2D2C29`, border-strong `#3B3A36`, text `#ECEAE4`, text-muted `#A39E94`, text-subtle `#7D786F`.

Semantic (each has a solid, a soft background and a text-on-soft colour per theme): success (green), warning (amber), danger (red), info (blue).
Status chips use soft background + text colour + a leading dot, so colour is never the only signal.

Accent tokens (generated per theme from the brand colour, injected by the root layout):
`--accent` (solid fill), `--accent-hover`, `--accent-fg` (text on solid, AA), `--accent-soft` (tinted background), `--accent-text` (accent used as text or icon on surface, AA), `--accent-ring` (focus ring).

## Shape and elevation

- Radius: 6px controls, 10px cards, 14px dialogs and sheets, 999px chips and avatars.
- Borders: 1px `--border` everywhere; cards are surface + border, shadow only on popovers, menus and dialogs (`0 8px 24px -8px rgb(0 0 0 / 0.12)` light, deeper and border-led in dark).
- Focus: 2px `--accent-ring` outline with 2px offset, always visible on keyboard focus.

## Motion

- Purposeful and fast: 120ms for hover and press, 180ms for popovers, 240ms for sheets and panels, ease `cubic-bezier(0.2, 0, 0, 1)`.
- No bouncing, no parallax. `prefers-reduced-motion` removes all transforms and keeps only opacity.

## Voice

Plain, warm, specific.
"You have 3 things to do today" not "Your tasks dashboard".
Empty states point forward: say what will appear here and give the one action that makes it appear.

## Signature move: the masthead

Amended 2026-10-15 after the design audit (`design/audit.md`, section 4).
Four moves at half volume added up to none, so there is now one.

Every top-level page carries a newspaper nameplate, the `Masthead` in `components/ui/masthead.tsx`:

- Line one, the dateline: the date in 12px caption capitals (tracked +0.08em, `text-subtle`) on the left; the company name in Newsreader 16px italic (`text-muted`) on the right; one 1px printed rule beneath, in ink (`fg` at 80 percent light, 60 percent dark), not the border grey, so it reads as the nameplate's underline and not as another divider.
- Line two, the title: Newsreader at display size on Home ("Good evening, Maya"), Hanken h1 (30px) on every other top-level page, Newsreader h1 on News and Knowledge.
- Line three, the "Today" line: Hanken body-lg in `text-fg`, one sentence of facts, with the parts that are for the reader as `text-accent-text` links ("3 things to do, 2 approvals waiting, Berlin office opens in 18 days").
  This is the only line in the product that mixes `text-fg` with accent links, so an accent link always means "something for you".
- An optional actions slot on the right.

Detail pages (a ticket, a person, a run, a knowledge page) use the same component without the dateline (`PageHeader`), so the type is one system.
The three earlier moves become details of the masthead rather than competing headlines: app tiles sit under it on Home, freshness badges are the Knowledge page's own dateline, and the journey timeline is the new hire's front page for a month.

## Composition rules (added 2026-10-15)

Everything else gets quieter to make room for the masthead.

- Rows, not cards, for lists of like things. 48 to 56px rows, `divide-y`, one container or none. No card-in-card.
- No icon tiles. A bare 16 or 18px Lucide icon in `text-muted`, or no icon.
- One width system: `<Page width="wide" | "prose" | "full">` (1200 / 760 / none). Nothing else sets a page's max width.
- One rhythm: 40px between page sections (`section-stack`), 24px heading to content (`section-group`), 16px between siblings (`section-content`).
- Every page has one clear lead; hierarchy comes from type and space before borders.
- Accent is reserved: one primary action, the active rail item, focus, "Pinned", and links in the Today line. A like uses the `reaction` tone (muted clay), never danger red and never the accent.
- Hover on an interactive card steps the surface tone as well as the border.
- Empty states are frameless; the dashed frame only marks a drop target.
- The rail sits one lightness step below the page (`bg-rail`), with the 1px border kept, so the shell reads as two sheets.
- Native browser chrome does not survive: `Disclosure` replaces `<details>` markers, `DateField` replaces `<input type="date">`.
- Badge type never drops below the 12px caption floor.
