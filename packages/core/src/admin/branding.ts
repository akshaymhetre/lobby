import { z } from "zod";
import { audit } from "../audit";
import { parseHex } from "../color";
import { getOrgSettings, updateOrgSettings, type OrgSettings } from "../settings";
import { ValidationError } from "./setup";

export const brandingInput = z.object({
  companyName: z.string().trim().min(1, "Enter your company name.").max(80, "Keep it under 80 characters."),
  productName: z.string().trim().max(40, "Keep it under 40 characters.").optional().default("Lobby"),
  logoUrl: z
    .string()
    .trim()
    .optional()
    .default("")
    .refine((v) => !v || /^\/api\/uploads\/[a-f0-9]{32}\.(png|jpg|gif|webp|svg)$/.test(v), "Upload the logo again."),
  accentColor: z
    .string()
    .trim()
    .refine((v) => !!parseHex(v), "Use a hex colour such as #2A5FE6."),
  timezone: z
    .string()
    .trim()
    .refine((tz) => {
      try {
        new Intl.DateTimeFormat("en", { timeZone: tz });
        return true;
      } catch {
        return false;
      }
    }, "Pick a timezone from the list."),
  workingDays: z.array(z.number().int().min(1).max(7)).min(1, "Pick at least one working day."),
  emailDomain: z
    .string()
    .trim()
    .toLowerCase()
    .optional()
    .default("")
    .refine((v) => !v || /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(v.replace(/^@/, "")), "Enter a domain such as northwind.example"),
});
export type BrandingInput = z.input<typeof brandingInput>;

export function normaliseHex(hex: string): string {
  const rgb = parseHex(hex)!;
  return "#" + rgb.map((v) => Math.round(v * 255).toString(16).padStart(2, "0")).join("").toUpperCase();
}

export async function saveBranding(actorId: string, input: BrandingInput): Promise<OrgSettings> {
  const r = brandingInput.safeParse(input);
  if (!r.success) {
    const errors: Record<string, string> = {};
    for (const issue of r.error.issues) errors[String(issue.path[0])] ??= issue.message;
    throw new ValidationError(errors);
  }
  const v = r.data;
  const before = await getOrgSettings();
  const patch = {
    companyName: v.companyName,
    productName: v.productName || "Lobby",
    logoUrl: v.logoUrl || null,
    accentColor: normaliseHex(v.accentColor),
    timezone: v.timezone,
    workingDays: [...new Set(v.workingDays)].sort(),
    emailDomain: v.emailDomain.replace(/^@/, "") || null,
  };
  const changed = Object.fromEntries(
    Object.entries(patch).filter(([k, val]) => JSON.stringify(before[k as keyof OrgSettings]) !== JSON.stringify(val)),
  );
  const org = await updateOrgSettings(patch);
  await audit(actorId, "branding.updated", { type: "org_settings", id: "1" }, { changed: Object.keys(changed) });
  return org;
}
