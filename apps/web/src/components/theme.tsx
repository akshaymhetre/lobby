"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { THEME_COOKIE } from "@/lib/theme-cookie";

/**
 * Light/dark theme. The choice lives in a cookie that the root layout reads on the server and
 * renders as the `dark` class on <html>, so the first paint is already right and no inline
 * script is needed. Light is the default.
 */
export type Theme = "light" | "dark";

interface ThemeValue {
  theme: Theme;
  resolvedTheme: Theme;
  setTheme: (t: Theme | string) => void;
}

const ThemeContext = createContext<ThemeValue>({ theme: "light", resolvedTheme: "light", setTheme: () => {} });

export function ThemeProvider({ initialTheme, children }: { initialTheme: Theme; children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(initialTheme);

  const setTheme = useCallback((value: Theme | string) => {
    const t: Theme = value === "dark" ? "dark" : "light";
    const root = document.documentElement;
    // Switch without animating every colour transition on the page.
    root.classList.add("theme-switching");
    root.classList.toggle("dark", t === "dark");
    root.style.colorScheme = t;
    document.cookie = `${THEME_COOKIE}=${t}; path=/; max-age=31536000; samesite=lax`;
    requestAnimationFrame(() => requestAnimationFrame(() => root.classList.remove("theme-switching")));
    setThemeState(t);
  }, []);

  const value = useMemo(() => ({ theme, resolvedTheme: theme, setTheme }), [theme, setTheme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);
