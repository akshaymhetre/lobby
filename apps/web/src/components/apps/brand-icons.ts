import "server-only";
import {
  si1password, siAtlassian, siConfluence, siDatadog, siFigma, siGithub, siGoogle, siGrafana, siHubspot, siJira,
  siLinear, siNotion, siZendesk, siZoom, type SimpleIcon,
} from "simple-icons";
import { luminance, monogram } from "@lobby/core/apps";
import type { AppIconData } from "./app-icon";

/**
 * Brand glyphs from simple-icons (CC0). Brands that are not in simple-icons (Slack, Microsoft,
 * Salesforce, Workday, BambooHR, AWS) fall back to a monogram in the brand colour.
 */
const GLYPHS: Record<string, SimpleIcon> = {
  "google-workspace": siGoogle,
  github: siGithub,
  jira: siJira,
  confluence: siConfluence,
  atlassian: siAtlassian,
  notion: siNotion,
  figma: siFigma,
  linear: siLinear,
  hubspot: siHubspot,
  zoom: siZoom,
  "1password": si1password,
  grafana: siGrafana,
  datadog: siDatadog,
  zendesk: siZendesk,
};

/** Resolves an app's `icon` field to something the client can draw without shipping the icon set. */
export function resolveAppIcon(app: { name: string; icon: string | null; color: string | null }): AppIconData {
  const icon = app.icon?.trim() ?? "";
  if (icon.startsWith("preset:")) {
    const glyph = GLYPHS[icon.slice("preset:".length)];
    if (glyph) {
      const hex = `#${glyph.hex}`;
      // Near-black brand marks follow the text colour so they stay visible in dark mode.
      return { kind: "glyph", path: glyph.path, color: luminance(hex) < 0.05 ? null : hex };
    }
  }
  if (icon.startsWith("https://") || icon.startsWith("/icons/")) return { kind: "image", url: icon };
  return { kind: "monogram", letters: monogram(app.name), color: app.color ?? null };
}

/** Preset keys that have a real brand glyph (for the admin icon picker). */
export const GLYPH_PRESETS = new Set(Object.keys(GLYPHS));
