# Lobby tokens

Source of truth for values: `apps/web/src/app/globals.css`.
Source of truth for intent: `design/KERNEL.md`.
Raw tokens are `--lb-*` CSS variables on `:root` (light) and `.dark`.
Tailwind utilities read them through `@theme inline` as `--color-*`, so `bg-page`, `text-muted`, `border-border` and so on all switch with the theme.
A theme key must never reference a variable of the same name (`--color-x: var(--color-x)` is circular and Tailwind drops it silently), which is why raw tokens carry the `lb-` prefix.

## Surfaces and lines

| Token | Utility | Light | Dark |
|---|---|---|---|
| `--lb-page` | `bg-page` | `#F7F6F3` | `#131312` |
| `--lb-surface` | `bg-surface` | `#FFFFFF` | `#1A1A18` |
| `--lb-raised` | `bg-raised` (menus, dialogs, sheets) | `#FFFFFF` | `#21211F` |
| `--lb-sunken` | `bg-sunken` | `#F1EFEA` | `#0F0F0E` |
| `--lb-hover` | `bg-hover` | `rgb(28 27 25 / 0.045)` | `rgb(236 234 228 / 0.05)` |
| `--lb-selected` | `bg-selected` | `rgb(28 27 25 / 0.075)` | `rgb(236 234 228 / 0.085)` |
| `--lb-overlay` | `bg-overlay` (scrim) | `rgb(28 27 25 / 0.32)` | `rgb(0 0 0 / 0.56)` |
| `--lb-border` | `border-border` | `#E4E1DA` | `#2D2C29` |
| `--lb-border-strong` | `border-border-strong` (inputs, secondary buttons) | `#D3CFC6` | `#3B3A36` |
| `--lb-control-border` | `border-control-border` (checkbox, radio, switch track) | `#8C877E` | `#716C64` |

## Text

| Token | Utility | Light | Dark |
|---|---|---|---|
| `--lb-fg` | `text-fg` | `#1C1B19` | `#ECEAE4` |
| `--lb-muted` | `text-muted` | `#5F5C56` | `#A39E94` |
| `--lb-subtle` | `text-subtle` (captions, placeholders, shortcuts) | `#6F6A62` | `#8E897F` |

Light `muted` and `subtle` are darker than the kernel's first draft (`#6B675F`, `#8A857C`), because the kernel's subtle measured 3.19:1 on sunken and failed AA.

## Accent

The root layout overrides these six per theme from the org's brand colour.
The values below are the default spruce family.

| Token | Utility | Light | Dark |
|---|---|---|---|
| `--lb-accent` | `bg-accent` | `#2F5D50` | `#6AA895` |
| `--lb-accent-hover` | `bg-accent-hover` | `#264C42` | `#7CB6A3` |
| `--lb-accent-fg` | `text-accent-fg` | `#FFFFFF` | `#0F1A17` |
| `--lb-accent-soft` | `bg-accent-soft` | `#E5EEEA` | `#1A2C26` |
| `--lb-accent-text` | `text-accent-text` | `#2F5D50` | `#86C0AC` |
| `--lb-accent-ring` | `outline-accent-ring`, `ring-accent-ring` | `#2F5D50` | `#6AA895` |

## Reaction and rail (added 2026-10-15, revamp phase 1)

| Token | Utility | Light | Dark | Use |
|---|---|---|---|---|
| `--lb-reaction` | `text-reaction`, `bg-reaction` | `#A94A33` | `#E59A86` | a like, pressed: icon fill and count. Never `danger`, never the accent |
| `--lb-reaction-soft` | `bg-reaction-soft` | `#F6E7E1` | `#33201B` | hover tint behind a pressed reaction |
| `--lb-rail` | `bg-rail` | `#F1EFEA` | `#0F0F0E` | the shell rail and the mobile menu's nav area, one step below the page |
| `--lb-rail-selected` | `bg-rail-selected` | `rgb(28 27 25 / 0.09)` | `rgb(236 234 228 / 0.10)` | the active rail item |

`reaction` clears 4.5:1 on page, surface, sunken, raised and on `reaction-soft` in both themes (lowest 4.69 light, 6.82 dark).

## Page widths

| Token | Utility | Value |
|---|---|---|
| `--container-page-wide` | `max-w-(--container-page-wide)` through `<Page width="wide">` | 1200px |
| `--container-page-prose` | `max-w-(--container-page-prose)` through `<Page width="prose">` | 760px |

`<Page width="full">` sets no max width. These three are the only page widths; nothing else sets `max-w-[NNNpx]` on a page.

## Section rhythm

| Utility | Value | Use |
|---|---|---|
| `section-stack` | flex column, 40px gap | between the sections of a page |
| `section-group` | flex column, 24px gap | between a section heading block and its content (what `<Section>` renders) |
| `section-content` | flex column, 16px gap | between siblings inside a section |

## Semantic

Each tone has a solid fill, text on the solid, a soft background and a text colour that works on the soft background and on every surface.

| Tone | Solid L / D | `-fg` L / D | `-soft` L / D | `-text` L / D |
|---|---|---|---|---|
| success | `#2D7A49` / `#55A872` | `#FFFFFF` / `#0E1A12` | `#E4F1E7` / `#16271C` | `#23633B` / `#7CC795` |
| warning | `#A85D08` / `#D89C3C` | `#FFFFFF` / `#1C1408` | `#FBEFD9` / `#2B2214` | `#8A4B05` / `#E4B464` |
| danger | `#C0392F` / `#E5776C` | `#FFFFFF` / `#1E0D0B` | `#FBE8E5` / `#331B18` | `#A8322B` / `#F1958B` |
| info | `#2F64B5` / `#6E9BE0` | `#FFFFFF` / `#0C1424` | `#E6EEF9` / `#172336` | `#2B5597` / `#93B5EA` |

Utilities: `bg-success`, `text-success-fg`, `bg-success-soft`, `text-success-text`, and the same for warning, danger and info.

## Avatar tints

Six warm pairs, `--lb-tint-{1..6}-bg` and `--lb-tint-{1..6}-fg`, picked deterministically from a person's name by `tintFor()` in `components/ui/avatar.tsx`.
Every pair clears 6:1 in light and 8.5:1 in dark.

## Type

Hanken Grotesk (`font-sans`, from `--font-hanken`) for UI, Newsreader (`font-serif`, from `--font-newsreader`) for the greeting, news headlines and Knowledge titles only.

| Utility | Size / line height |
|---|---|
| `text-caption` | 12 / 16 |
| `text-small` | 13 / 18 |
| `text-body` | 14 / 20 (default) |
| `text-body-lg` | 16 / 24 |
| `text-h4` | 18 / 26 |
| `text-h3` | 20 / 28 |
| `text-h2` | 24 / 32, -0.01em |
| `text-h1` | 30 / 38, -0.015em |
| `text-display` | 40 / 48, -0.02em |

Use `tabular` for figures in tables, SLAs and counters.
Weights stop at 600.

## Shape, elevation, motion

| Token | Utility | Value |
|---|---|---|
| `--radius-control` | `rounded-control` | 6px |
| `--radius-card` | `rounded-card` | 10px |
| `--radius-dialog` | `rounded-dialog` | 14px |
| `--lb-shadow-lift` | `shadow-lift` | hairline in light, none in dark |
| `--lb-shadow-popover` | `shadow-popover` | `0 8px 24px -8px rgb(0 0 0 / 0.12)` light; border-led and deeper in dark |
| `--lb-shadow-dialog` | `shadow-dialog` | deeper variant for dialogs and sheets |
| `--lb-ease` | `ease-standard` | `cubic-bezier(0.2, 0, 0, 1)` |
| durations | `duration-120`, `duration-180`, `duration-240` | hover/press, popovers, sheets |

Animations: `animate-pop-in/out`, `animate-dialog-in/out`, `animate-fade-in/out`, `animate-sheet-in/out-{right,left,bottom}`, `animate-shimmer`, `animate-spin-slow`.
Under `prefers-reduced-motion: reduce` every keyframe that moves is redefined as opacity only.

Helper utilities: `focus-ring` (2px accent outline, 2px offset, keyboard only), `touch-target` (grows the hit area to 44px on coarse pointers), `tabular`.

## Contrast audit

Measured with `~/.claude/design/tools/contrast.py` on 2026-10-15 (re-run after the revamp tokens landed: 66 pairs per theme, text at 4.5:1 and UI parts at 3:1, 0 failures in either theme).
All text tokens clear 4.5:1 on page, surface, sunken, rail (and raised in dark); lowest values:

| Pair | Light | Dark |
|---|---|---|
| subtle on sunken / rail / raised | 4.67 | 4.64 (raised) |
| reaction on sunken / reaction-soft | 4.92 / 4.69 | 8.49 / 6.82 |
| accent-ring on rail (3:1) | 6.52 | 6.98 |
| subtle on page | 4.96 | 5.34 |
| muted on sunken / raised | 5.80 | 6.05 (raised) |
| warning-fg on warning | 4.96 | 7.58 |
| success-fg on success | 5.26 | 6.15 |
| control-border on sunken (3:1) | 3.11 | 3.35 (surface) |
| accent-ring on page (3:1) | 6.93 | 6.77 |

Documented exception: `border-strong` (1.55:1) is the outline of text inputs, selects and secondary buttons.
Those controls are identified by their label, placeholder and fill rather than the outline alone, so it does not carry WCAG 1.4.11 on its own.
Controls whose outline is the only identifier (checkbox, radio, switch track) use `control-border` at 3:1 instead.
