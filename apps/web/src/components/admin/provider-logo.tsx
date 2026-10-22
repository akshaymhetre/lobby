import { siAuthentik, siGoogle, siKeycloak, siOkta, siOpenid } from "simple-icons";
import { cn } from "@/lib/cn";
import type { ProviderKey } from "./identity-providers";

/** Brand glyphs from simple-icons (CC0). Microsoft is not in simple-icons, so its four squares are drawn here. */
const GLYPH: Partial<Record<ProviderKey, { path: string; hex: string }>> = {
  okta: siOkta,
  google: siGoogle,
  keycloak: siKeycloak,
  authentik: siAuthentik,
  oidc: siOpenid,
};

/** An identity provider's mark on a white disc (white in both themes, so every brand colour reads). */
export function ProviderLogo({ provider, size = 40, className }: { provider: ProviderKey; size?: number; className?: string }) {
  const g = GLYPH[provider];
  const inner = Math.round(size * 0.5);
  return (
    <span aria-hidden className={cn("grid shrink-0 place-items-center rounded-full bg-white shadow-cell", className)} style={{ width: size, height: size }}>
      {g ? (
        <svg viewBox="0 0 24 24" width={inner} height={inner} fill={`#${g.hex}`}>
          <path d={g.path} />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" width={inner} height={inner}>
          <rect x="1" y="1" width="10.5" height="10.5" fill="#F25022" />
          <rect x="12.5" y="1" width="10.5" height="10.5" fill="#7FBA00" />
          <rect x="1" y="12.5" width="10.5" height="10.5" fill="#00A4EF" />
          <rect x="12.5" y="12.5" width="10.5" height="10.5" fill="#FFB900" />
        </svg>
      )}
    </span>
  );
}
