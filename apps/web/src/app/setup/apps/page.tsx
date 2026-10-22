import { db, isNotNull, s } from "@lobby/db";
import { getOrgSettings } from "@lobby/core";
import { StepHeader } from "@/components/setup/step-header";
import { StepFooter } from "@/components/setup/step-nav";
import { AppsPicker, type PickerPreset } from "@/components/setup/apps-picker";
import type { AppIconData } from "@/components/apps/app-icon";
import { guardSetup } from "../_guard";

export const metadata = { title: "Apps" };

type Preset = { key: string; name: string; description?: string; category?: string; launchUrl?: string; color?: string };

/** Loads the app presets from the apps module, tolerating it not being installed. */
async function loadPresets(): Promise<{ presets: PickerPreset[]; available: boolean }> {
  try {
    const name = "apps";
    const mod = (await import(`@lobby/core/${name}/index`)) as { APP_PRESETS?: readonly Preset[] };
    if (!Array.isArray(mod.APP_PRESETS)) return { presets: [], available: false };
    let resolve: ((a: { name: string; icon: string | null; color: string | null }) => AppIconData) | null = null;
    try {
      resolve = (await import("@/components/apps/brand-icons")).resolveAppIcon;
    } catch {
      resolve = null;
    }
    const presets = mod.APP_PRESETS.filter((p) => p.key !== "custom").map((p) => ({
      key: p.key,
      name: p.name,
      description: p.description ?? "",
      category: p.category ?? "General",
      needsTenant: !!p.launchUrl?.includes("{tenant}"),
      needsDomain: !!p.launchUrl?.includes("{domain}"),
      icon: resolve ? resolve({ name: p.name, icon: `preset:${p.key}`, color: p.color ?? null }) : null,
    }));
    return { presets, available: true };
  } catch {
    return { presets: [], available: false };
  }
}

export default async function AppsStep() {
  await guardSetup("apps");
  const [org, { presets, available }, existing] = await Promise.all([
    getOrgSettings(),
    loadPresets(),
    db.select({ key: s.apps.presetKey }).from(s.apps).where(isNotNull(s.apps.presetKey)),
  ]);
  const tenantGuess = (org.emailDomain ?? org.companyName).split(".")[0]!.toLowerCase().replace(/[^a-z0-9-]/g, "");
  return (
    <StepHeader step="apps" aside="slot">
      <AppsPicker
        presets={presets}
        available={available}
        installed={existing.map((e) => e.key!).filter(Boolean)}
        tenantGuess={tenantGuess}
        domain={org.emailDomain}
      />
      <StepFooter step="apps" continueLabel="Continue" />
    </StepHeader>
  );
}
