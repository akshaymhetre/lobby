# Lobby design direction v2: soft-tactile light, cinematic dark

This replaces the earlier "company newspaper" direction (serif, warm stone, masthead) described in design/KERNEL.md.
The first direction read as calm but forgettable, so v2 aims for a memorable, tactile look.
Two kinds of reference shaped it:
- A soft-tactile HR dashboard concept (still image). It set the visual style, theme and palette.
- An AI-assistant concept video. It set the motion, effects and interactions.

The reference files are not part of this repository, because they belong to their authors.
Everything below is the system we derived from them, in our own words.

## What the image teaches (visual system)

1. **The app is one floating object.**
   - A rounded slab (radius about 28px) sits on a cool grey backdrop.
   - Inside it, panels are inset at radius 24px, and cells and chips at radius 12-16px.
   - Depth comes from tone steps, never from 1px borders:
     - backdrop #A9AFBA-ish (in our app: a cool grey canvas)
     - shell #EEF0F3
     - panel #F6F7F9
     - cell #FFFFFF
   - Each raised layer has a soft, large, low-opacity shadow plus a 1px inner white highlight on its top edge, which makes it read as a tactile, slightly pillowy surface.
2. **Neutral chrome, saturated meaning.**
   - The UI chrome is nearly greyscale.
   - Colour appears only on things that mean something: event and category blocks with a gentle vertical gradient, a frosted circular icon disc on the left, and a white status pill with a dot ("• Approved").
   - Categories in the reference: violet (paid leave), green (vacation), blue glass (pending or in progress), amber (an event starting soon).
   - A single vivid blue marks "now": the today column and the dashed today line.
3. **A hero visualisation, not a feed.** One screen-wide live visual (a planner timeline with a today line and hatched non-working days) makes the product feel alive.
4. **The AI has a character.** A glossy glass orb is the assistant's avatar. The assistant greets the user by name and offers suggestion chips, and its composer has tool buttons.
5. **Faces.** Every person row has an avatar. With no photos, use beautiful generated avatars, never grey initials circles.
6. **Type.** One geometric grotesk at regular weight and large sizes. Headings are 28-32px at weight 400-500, not bold, and there is no serif.
7. **Navigation.**
   - Pill tabs in a top bar. The active pill is raised: white, with a soft shadow and an inner highlight.
   - An icon-only vertical rail of circular buttons.
   - An avatar stack plus a primary pill action.

## What the video teaches (motion)

Every reveal is choreographed. Nothing just appears.
1. **3D panel entrance.**
   - The detail panel swings in from the right edge in perspective (rotateY about 20-25deg to 0, translateX, opacity), over about 600ms with a soft spring.
   - It arrives as an empty tinted glass slab first. Then the content resolves top to bottom: the title reveals word by word, then the stat card, then the tiles stagger in at about 60ms each.
2. **Numbers count up.** Figures tween from 0 (8% -> 17 -> 26 -> 35 -> 45% over about 1s, ease-out), and mini bar charts grow bar by bar.
3. **Blur-in.** The AI analysis panel materialises from blur (filter blur 12px -> 0, opacity, scale 0.98 -> 1), and its result cards stagger.
4. **Light sweep for attention.** A glowing border tracer (a conic-gradient highlight) travels once around the most important card ("Critical concerns") to pull the eye. It runs once and does not loop.
5. **Energy along connections.** Small light pulses travel along connector lines, and lines draw themselves (stroke-dashoffset) when a node is selected, fanning out to their targets.
6. **Live feedback while typing.** The KPI strip above the composer updates as the query changes, with values tweening.
7. **Depth-of-field scene transitions.** Zoom into the selected thing while the rest blurs and fades.
8. **Ambient.**
   - The dark scenes sit on a deep teal-black radial gradient with a vignette.
   - Glows are soft and coloured: violet, gold and cyan.
   - Glass panels are tinted teal, with a lighter top edge.

## The synthesis for Lobby

- **Light theme (the default)** follows the image: cool soft-tactile neutrals, a floating shell, tonal depth, category gradients, and a vivid blue for "now".
  The customer's brand colour stays the primary-action accent, through the existing accessible accent generator, so the default seed accent becomes a vivid blue.
- **Dark theme** follows the video: a deep teal-black ambient radial gradient, teal-tinted glass panels with top highlights, and soft coloured glows. This is the wow in dark mode.
- **Motion** follows the video, with discipline:
  - Spend the cinematic moments on four places only:
    - first load of Home (staggered build)
    - opening a detail panel (3D swing plus content build)
    - the assistant (orb, blur-in, a light sweep on the top result)
    - selecting a node in the org chart or journey timeline (connector draw with a travelling pulse)
  - Everything else gets fast, crisp response motion: a press scale of 0.97, a hover lift of translateY -1px with the shadow deepening, and a sliding active pill.
  - Under prefers-reduced-motion every effect collapses to a short opacity fade.
- **The Home hero:** a "This week" planner timeline. The rows are me and my team (or my direct reports for a manager). Columns are days, with a today line and hatched weekends. Category blocks come from real data:
  - onboarding steps due
  - new joiners' start days
  - approvals and requests due under SLA
  - announcement acknowledgement deadlines
  - payday
- **The AI assistant card on Home** uses the orb, then "Welcome, Maya. What can I help with today?", suggestion chips and the composer.
- **Avatars:** generated, deterministic illustrated avatars per person, built locally in code. No remote fetch and no fake photos. One option is a small SVG avatar generator seeded by the person's id (abstract or illustrated face shapes on soft gradient discs).

## Guardrails (non-negotiable)

- WCAG AA. Text on category gradients must reach 4.5:1, so darken the gradient stops or use dark text on light tints. The reference fails this and we will not.
- One glass object per screen at most in light mode (the orb and the detail panel). Glass in dark mode is fine, because there it is the material.
- Purple is one category colour, never the brand.
- No imitation 3D except the orb, which is the one sanctioned signature object. Build it from CSS radial gradients plus a highlight. Keep it small and make it breathe slowly.
- Keep every e2e selector contract (accessible names, labels and ids).
- Performance: CSS transforms and opacity only. The `motion` library (already a dependency, v14.2.0) is the one animation library. No canvas or WebGL in this pass.

## Direction card

```
DIRECTION
Subject inventory : the week planner (rows of people, columns of days, a today line); the onboarding
                    checklist ("5/10 tasks done"); the help request with an SLA clock; the approval
                    waiting on a manager; the announcement that must be acknowledged by a date; payday
                    on the last working day; the new joiner's first day; the knowledge page that gets
                    cited; the company's own accent colour; the assistant that answers from company pages.
Audience scene    : an employee at Northwind Labs, at a desk on a laptop or at a standing desk on a phone,
                    between meetings, in daylight; wants to know in three seconds what is due this week
                    and who is new. Managers glance at their reports. Dark theme for the evening and the
                    on-call engineer in a dim room.
Mode              : Operate (Home, the shell, every list and admin screen). The assistant card borrows
                    one Experience object: the orb.
Idea              : "On Home, the week itself becomes the interface: a planner where what is due for me
                    and my team sits on the day it is due, and today is the only thing drawn in colour."
Style family      : soft-tactile tonal UI (light) and teal cinematic glass (dark). Depth from lightness
                    steps, a large soft shadow and a 1px top highlight, never a 1px border. It fits
                    because an intranet is a calendar of obligations; a pillowy, physical surface makes
                    a list of duties feel handled rather than nagging.
Theme             : both, designed separately. Light is the default (daylight office). Dark is teal-black
                    with glass because the reference video sets it and because a dim-room reader wants
                    low-luminance panels with coloured glows, not inverted grey.
Colour strategy   : Restrained chrome + Full palette for meaning. Neutrals tinted cool (hue 230, chroma
                    0.006). Categories are the only saturated fields: violet = onboarding step,
                    green = a new joiner's first day, blue = a request or approval under SLA,
                    amber = an announcement deadline, coral = payday. Vivid blue marks "now" (today
                    column, today line). The customer brand accent stays on the primary action,
                    selection and focus, through the existing accessible generator; the default seed
                    becomes vivid blue #2A5FE6 so "now" and "act" share one family.
Type              : Plus Jakarta Sans only (variable 300-800). Chosen over Outfit/Urbanist because its
                    round geometric lowercase matches the reference while its x-height and open
                    apertures keep 13-14px body readable, and it has real tabular figures for the
                    planner and counts. Headings 28-32px at weight 500, tracking -0.02em; body 14/20;
                    scale ratio about 1.2. No serif anywhere; the old font-serif alias resolves to it.
Density           : comfortable. Base unit 4px; 8/12/16/24/32 rhythm; rows 44-52px; cells 44-56px.
Signature move    : the "This week" planner hero with its dashed blue today line and hatched weekends,
                    and the glossy orb as the assistant's face. Everything else stays quiet.
Motion budget     : one authored moment per place: Home first load (staggered build, 900ms total,
                    numbers count up), detail panel (3D swing 600ms spring + content build), assistant
                    (orb breathes, blur-in, one light sweep on the top source). Response motion:
                    press scale 0.97 at 120ms, hover lift -1px at 160ms, sliding active pill
                    (spring, bounce 0). Reduced motion: every effect is an opacity fade.
Depth / 3D        : subtle. Tonal elevation plus one perspective entrance (the panel) and one
                    CSS-radial object (the orb, sanctioned by the brief). No WebGL, no tilt cards.
Refusing          : Inter; purple-to-blue gradient as brand; 1px borders on cards; identical cards
                    with the same shadow for every list; a hover lift on every card; glass panels in
                    light mode beyond the orb and the detail panel; a fade-up on every section;
                    the newspaper serif and rule from v1; grey initials circles.
```

Card tests:
1. Competitor test: "On Rippling's home, the week becomes the interface" still reads. Changed the Idea
   to pin what only Lobby has: the rows are built from Lobby's own obligations (journey steps, SLA
   clocks, acknowledgement deadlines, payday) and the viewer's reporting line, so the planner is a
   read of this company's data, not a calendar widget.
2. Category-guess test: "intranet, so a sidebar and a feed" is the category default; v2 refuses the
   feed-first layout and the sidebar-of-text. Pass.
3. One material: the accent, the type and the signature move all come from "the week as a tactile
   object": a vivid blue for now, round geometric type, pillowy cells. The category colours are
   semantic, not decorative, and purple is a category only. Pass.
4. Own prior: the SaaS prior (Inter, purple gradient, identical cards) is refused; the "technical"
   dark prior (near-black + neon) is replaced by a tinted teal-black with glass and warm/cool glows
   taken from the reference video. The orb is imitation material and is kept only because the brief
   sanctions it as the one signature object; it is small and breathes slowly.

## Wave 3 amendments (2026-10-16)

A blind review scored v2 at 7.0 and said it fails the "wow" bar below the first fold (design/v2-review.md).
The system changes that answer it:
- **Type with confidence.** Page titles 44px, hero titles 32px, row text 15px, a 13px floor, sections at 24px. Levels separate by size, not by grey. No tracked capitals except one eyebrow per screen.
- **Dark is lit, not flat.** Every hero carries ONE coloured light source tied to its data (amber due, teal working, red breaching, blue info). "Now" is a glowing rail, not a dashed hairline. Connector sparks are comets with a halo that pulse the node they reach. The light-mode beam is a saturated stroke with a coloured outer glow.
- **One navigation model.** The pill track is the only "where am I" material: the top bar, the admin second row, the setup steps and the phone section switcher. No sidebars.
- **Lists are raised cells, categories are filled blocks, catalogues are tile walls.** Hairline tables only for true data grids.
- **The assistant answers in cards.** Even without generation, the best match leads with its key fact.
- **Teal joins the categories** as "working / in progress".
