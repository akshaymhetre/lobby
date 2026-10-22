import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { ThemeProvider } from "@/components/theme";
import { THEME_COOKIE } from "@/lib/theme-cookie";
import { getOrgSettings } from "@lobby/core/settings";
import { accentCss } from "@lobby/core/color";
import { fontVariables } from "./fonts";
import "./globals.css";

/** Every page depends on the signed-in user and the database, so nothing is prerendered at build time. */
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const org = await getOrgSettings();
  return {
    title: { default: org.productName, template: `%s · ${org.productName}` },
    description: `${org.companyName} intranet`,
    manifest: "/manifest.webmanifest",
    icons: { icon: "/icon.svg" },
  };
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#B9BFCA" },
    { media: "(prefers-color-scheme: dark)", color: "#050D0F" },
  ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const org = await getOrgSettings();
  // The saved theme is rendered on the server, so the first paint is already right.
  const theme = (await cookies()).get(THEME_COOKIE)?.value === "dark" ? "dark" : "light";
  return (
    <html lang="en" suppressHydrationWarning className={`${fontVariables}${theme === "dark" ? " dark" : ""}`} style={{ colorScheme: theme }}>
      <head>
        {/* Brand accent, generated so text on it always meets WCAG AA in both themes. */}
        <style id="lobby-accent">{accentCss(org.accentColor)}</style>
      </head>
      <body className="bg-canvas text-fg font-sans antialiased">
        <ThemeProvider initialTheme={theme}>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
