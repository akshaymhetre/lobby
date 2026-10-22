import "server-only";
import type { StepTarget } from "@lobby/core/journeys";
import type { AppIconData } from "@/components/apps/app-icon";
import { resolveAppIcon } from "@/components/apps/brand-icons";

/** Brand icons for the app steps in a set of targets, keyed by app slug. */
export function appIconsFor(targets: StepTarget[]): Record<string, AppIconData> {
  const out: Record<string, AppIconData> = {};
  for (const t of targets) {
    if (t?.kind !== "app") continue;
    const slug = t.href.split("/").pop();
    if (slug && !out[slug]) out[slug] = resolveAppIcon({ name: t.name, icon: t.icon, color: t.color });
  }
  return out;
}
