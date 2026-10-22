import type { MetadataRoute } from "next";
import { getOrgSettings } from "@lobby/core";

export const dynamic = "force-dynamic";

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const org = await getOrgSettings();
  return {
    name: `${org.companyName} · ${org.productName}`,
    short_name: org.productName,
    start_url: "/",
    display: "standalone",
    background_color: "#F7F6F3",
    theme_color: "#F7F6F3",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
