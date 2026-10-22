import { Plus_Jakarta_Sans } from "next/font/google";

/*
 * One typeface for the whole product: Plus Jakarta Sans, a round geometric grotesk.
 * Chosen over Outfit, Urbanist and Figtree because its lowercase matches the reference's round
 * geometric face while its x-height and open apertures keep 13-14px body text readable, and it
 * ships real tabular figures for the planner and the counts.
 *
 * The CSS variable is deliberately NOT named --font-sans. globals.css maps it into Tailwind's
 * theme as `--font-sans: var(--font-jakarta)`; a theme key that equals its source is a circular
 * reference and Tailwind drops the utility silently. `--font-serif` now resolves to the same
 * face, so the v1 `font-serif` classes still compile and render sans (there is no serif in v2).
 */
const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
  display: "swap",
  weight: "variable",
});

export const fontVariables = jakarta.variable;
