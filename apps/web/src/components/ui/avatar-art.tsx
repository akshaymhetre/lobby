import * as React from "react";

/**
 * Generated avatars: a deterministic illustrated face on a soft gradient disc, built locally as
 * inline SVG from a seed (the person's id, or their name). No network, no photos, no grey
 * initials. The same seed always draws the same person, everywhere.
 *
 * The drawing is deliberately simple and geometric: a disc, shoulders, a head, one of six hair
 * shapes, eyes, a smile, sometimes glasses. Colours come from small, measured sets so every
 * combination stays soft and readable at 20px.
 */

/** FNV-1a 32-bit, so a seed maps to a stable number on the server and the client. */
export function hashSeed(seed: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

const DISCS: [string, string][] = [
  ["#d9ccff", "#9b86ff"],
  ["#c3f0d9", "#63cf9f"],
  ["#ffd9c7", "#ff9a78"],
  ["#c9e0ff", "#6ea3ff"],
  ["#ffe9ad", "#f0c04a"],
  ["#ffd0e2", "#f08ab7"],
  ["#c4ebef", "#5fbfcb"],
  ["#e8d4ff", "#bd8ff3"],
];
const SKIN = ["#f7d9c4", "#edbf9e", "#d6a079", "#b37d57", "#8f5c3c", "#5f3b27"];
const HAIR = ["#2a2019", "#4a2e1c", "#7b4b2a", "#bb8b5a", "#dcbc8d", "#1f1f27", "#8d8d99", "#c84b2f"];
const SHIRT = ["#1f2a44", "#2f4a3e", "#5b3a6b", "#3b4f7a", "#6b4a2e", "#2d3a3a", "#8a3b4a", "#3d3d4a"];

export interface AvatarArtTraits {
  disc: [string, string];
  skin: string;
  hair: string;
  shirt: string;
  style: number;
  glasses: boolean;
  smile: number;
}

export function traitsFor(seed: string): AvatarArtTraits {
  const h = hashSeed(seed);
  return {
    disc: DISCS[h % DISCS.length]!,
    skin: SKIN[(h >>> 3) % SKIN.length]!,
    hair: HAIR[(h >>> 7) % HAIR.length]!,
    shirt: SHIRT[(h >>> 11) % SHIRT.length]!,
    style: (h >>> 15) % 6,
    glasses: ((h >>> 19) & 3) === 0,
    smile: (h >>> 22) % 3,
  };
}

/** The hair shape for a head centred at (32, 29) with radius 13, in a 64x64 box. */
function hairPath(style: number): { back?: string; front: string } {
  switch (style) {
    case 0: // short cap
      return { front: "M19 29 C19 18 24 14 32 14 C40 14 45 18 45 29 C44 24 40 21 32 21 C24 21 20 24 19 29 Z" };
    case 1: // side-swept
      return { front: "M19 30 C18 19 24 13 33 13.5 C41 14 46 19 45.5 28 C42 22 38 21 30 23 C25 24 21 26 19 30 Z" };
    case 2: // curly
      return {
        front:
          "M18 29 C16 24 18 19 22 18 C22 14 27 12 31 13.5 C34 11 40 12 42 16 C46 16 48 21 46 25 C47 28 45 31 44 30 C43 25 39 22 32 22 C25 22 21 25 20 30 C19 31 18 30 18 29 Z",
      };
    case 3: // long, to the shoulders
      return {
        back: "M17 30 C17 17 24 13 32 13 C40 13 47 17 47 30 L48 50 L16 50 Z",
        front: "M19 30 C19 19 24 15 32 15 C40 15 45 19 45 30 C43 24 39 22 32 22 C25 22 21 24 19 30 Z",
      };
    case 4: // bun
      return { back: "M27 11 a5 5 0 1 1 10 0 a5 5 0 1 1 -10 0 Z", front: "M19 29 C19 18 24 14 32 14 C40 14 45 18 45 29 C44 24 40 21 32 21 C24 21 20 24 19 29 Z" };
    default: // buzz: a thin cap
      return { front: "M19.5 27 C20 19 25 15.5 32 15.5 C39 15.5 44 19 44.5 27 C43 23 39 21 32 21 C25 21 21 23 19.5 27 Z" };
  }
}

export interface AvatarArtProps extends React.ComponentProps<"svg"> {
  seed: string;
  /** Accessible name; the art is decorative when the name is rendered beside it. */
  title?: string;
}

export function AvatarArt({ seed, title, className, ...props }: AvatarArtProps) {
  const t = traitsFor(seed);
  const hair = hairPath(t.style);
  const id = React.useId().replace(/:/g, "");
  const smile =
    t.smile === 0 ? "M27.5 35.5 Q32 39 36.5 35.5" : t.smile === 1 ? "M28 36 Q32 38.5 36 36" : "M28.5 36.2 L35.5 36.2";
  return (
    <svg viewBox="0 0 64 64" className={className} role={title ? "img" : "presentation"} aria-label={title} aria-hidden={title ? undefined : true} {...props}>
      <defs>
        <linearGradient id={`${id}-disc`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={t.disc[0]} />
          <stop offset="1" stopColor={t.disc[1]} />
        </linearGradient>
        <clipPath id={`${id}-clip`}>
          <circle cx="32" cy="32" r="32" />
        </clipPath>
      </defs>
      <circle cx="32" cy="32" r="32" fill={`url(#${id}-disc)`} />
      <g clipPath={`url(#${id}-clip)`}>
        {hair.back ? <path d={hair.back} fill={t.hair} /> : null}
        {/* shoulders */}
        <path d="M10 66 C10 50 18 44 32 44 C46 44 54 50 54 66 Z" fill={t.shirt} />
        {/* neck */}
        <rect x="27.5" y="38" width="9" height="9" rx="3" fill={t.skin} />
        {/* head */}
        <circle cx="32" cy="29" r="13" fill={t.skin} />
        <path d={hair.front} fill={t.hair} />
        {/* eyes */}
        <circle cx="27.6" cy="30.2" r="1.45" fill="#2a2019" />
        <circle cx="36.4" cy="30.2" r="1.45" fill="#2a2019" />
        <path d={smile} stroke="#2a2019" strokeWidth="1.3" strokeLinecap="round" fill="none" />
        {t.glasses ? (
          <g fill="none" stroke="#2a2019" strokeWidth="1.1" opacity="0.8">
            <circle cx="27.6" cy="30.4" r="3.6" />
            <circle cx="36.4" cy="30.4" r="3.6" />
            <path d="M31.2 30.4 L32.8 30.4" />
          </g>
        ) : null}
      </g>
      {/* a soft inner edge so the disc reads as a coin on any ground */}
      <circle cx="32" cy="32" r="31.5" fill="none" stroke="rgb(0 0 0 / 0.06)" strokeWidth="1" />
    </svg>
  );
}
