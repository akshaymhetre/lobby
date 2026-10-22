/**
 * Brand colour -> accessible accent tokens.
 * Any customer brand colour is moved along OKLCH lightness (hue and chroma kept) until text on it,
 * and the accent used as text, meet WCAG AA (4.5:1) in both the light and the dark theme.
 */

type Rgb = [number, number, number];
type Oklch = { l: number; c: number; h: number };

const LIGHT_SURFACES = ["#FFFFFF", "#F6F7F9", "#EEF0F3", "#E5E8ED"];
const DARK_SURFACES = ["#11262B", "#0B191C", "#183238"];
const DARK_FG = "#0B191C";

export function parseHex(hex: string): Rgb | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  let h = m[1]!;
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255) as Rgb;
}

const toHex = (rgb: Rgb) =>
  "#" + rgb.map((v) => Math.round(Math.min(1, Math.max(0, v)) * 255).toString(16).padStart(2, "0")).join("").toUpperCase();

const lin = (v: number) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
const delin = (v: number) => (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055);

function rgbToOklch([r, g, b]: Rgb): Oklch {
  const [lr, lg, lb] = [lin(r), lin(g), lin(b)];
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  return { l: L, c: Math.hypot(A, B), h: (Math.atan2(B, A) * 180) / Math.PI };
}

function oklchToLinear({ l, c, h }: Oklch): Rgb {
  const a = c * Math.cos((h * Math.PI) / 180);
  const b = c * Math.sin((h * Math.PI) / 180);
  const l_ = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m_ = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s_ = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_,
    -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_,
    -0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_,
  ];
}

/** OKLCH -> sRGB, reducing chroma until the colour fits the gamut. */
function oklchToRgb(c: Oklch): Rgb {
  let cur = { ...c };
  for (let i = 0; i < 40; i++) {
    const linear = oklchToLinear(cur);
    if (linear.every((v) => v >= -0.0005 && v <= 1.0005)) return linear.map(delin) as Rgb;
    cur = { ...cur, c: cur.c * 0.92 };
  }
  return oklchToLinear({ ...cur, c: 0 }).map(delin) as Rgb;
}

export function luminance(rgb: Rgb): number {
  const [r, g, b] = rgb.map(lin) as Rgb;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a: string | Rgb, b: string | Rgb): number {
  const ra = typeof a === "string" ? parseHex(a)! : a;
  const rb = typeof b === "string" ? parseHex(b)! : b;
  const [la, lb] = [luminance(ra), luminance(rb)];
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** Step lightness in `dir` until `ok` passes. */
function walk(base: Oklch, dir: 1 | -1, ok: (hex: string) => boolean): string {
  let l = base.l;
  for (let i = 0; i < 100; i++) {
    const hex = toHex(oklchToRgb({ ...base, l }));
    if (ok(hex)) return hex;
    l = Math.min(0.99, Math.max(0.05, l + dir * 0.01));
  }
  return dir < 0 ? "#000000" : "#FFFFFF";
}

const passesAll = (hex: string, surfaces: string[], min = 4.5) => surfaces.every((s) => contrast(hex, s) >= min);

export interface AccentTokens {
  accent: string;
  accentHover: string;
  accentFg: string;
  accentSoft: string;
  accentText: string;
  accentRing: string;
}

export function accentTokens(brand: string): { light: AccentTokens; dark: AccentTokens } {
  const rgb = parseHex(brand) ?? parseHex("#2A5FE6")!;
  const base = rgbToOklch(rgb);
  const chroma = Math.min(base.c, 0.2);

  // Light: white text on the fill, darken until AA.
  const lAccent = walk({ ...base, c: chroma }, -1, (hex) => contrast(hex, "#FFFFFF") >= 4.5);
  const lBase = rgbToOklch(parseHex(lAccent)!);
  const light: AccentTokens = {
    accent: lAccent,
    accentHover: toHex(oklchToRgb({ ...lBase, l: Math.max(0.05, lBase.l - 0.06) })),
    accentFg: "#FFFFFF",
    accentSoft: toHex(oklchToRgb({ l: 0.94, c: Math.min(chroma * 0.22, 0.02), h: base.h })),
    accentText: walk({ ...base, c: chroma }, -1, (hex) => passesAll(hex, LIGHT_SURFACES)),
    accentRing: toHex(oklchToRgb({ l: Math.min(0.62, lBase.l + 0.12), c: chroma, h: base.h })),
  };

  // Dark: a lighter fill with dark text on it, lighten until AA.
  const dAccent = walk({ ...base, l: Math.max(base.l, 0.66), c: chroma }, 1, (hex) => contrast(hex, DARK_FG) >= 4.8);
  const dBase = rgbToOklch(parseHex(dAccent)!);
  const dark: AccentTokens = {
    accent: dAccent,
    accentHover: toHex(oklchToRgb({ ...dBase, l: Math.min(0.97, dBase.l + 0.05) })),
    accentFg: DARK_FG,
    accentSoft: toHex(oklchToRgb({ l: 0.28, c: Math.min(chroma * 0.45, 0.04), h: base.h })),
    accentText: walk({ ...base, l: Math.max(base.l, 0.7), c: chroma }, 1, (hex) => passesAll(hex, DARK_SURFACES)),
    accentRing: toHex(oklchToRgb({ ...dBase, l: Math.max(0.6, dBase.l - 0.05) })),
  };
  return { light, dark };
}

const block = (t: AccentTokens) =>
  `--lb-accent:${t.accent};--lb-accent-hover:${t.accentHover};--lb-accent-fg:${t.accentFg};` +
  `--lb-accent-soft:${t.accentSoft};--lb-accent-text:${t.accentText};--lb-accent-ring:${t.accentRing};`;

/** CSS injected by the root layout. */
export function accentCss(brand: string): string {
  const { light, dark } = accentTokens(brand);
  // html:root and html.dark outrank the defaults in globals.css whatever order the styles load in.
  return `html:root{${block(light)}}html.dark{${block(dark)}}`;
}
