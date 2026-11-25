import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { ThemePreference } from "@shared/settings";
import { useSettings, useUpdateSetting } from "@/features/settings/hooks";
import { applyTheme, cachePreference, readCachedPreference, resolveTheme, type ResolvedTheme } from "./theme-logic";

interface ThemeContextValue {
  preference: ThemePreference;
  resolvedTheme: ResolvedTheme;
  setPreference: (pref: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);
const darkQuery = () => window.matchMedia("(prefers-color-scheme: dark)");

/**
 * Source of truth: the `appearance.theme` setting on the server (follows you
 * across devices). localStorage mirrors it so theme-init.js can paint the
 * right theme before React loads.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const settings = useSettings();
  const update = useUpdateSetting("appearance.theme");
  const [systemDark, setSystemDark] = useState(() => darkQuery().matches);

  const serverPref = settings.isPlaceholderData ? undefined : settings.data?.["appearance.theme"];
  const preference: ThemePreference = serverPref ?? readCachedPreference();
  const resolvedTheme = resolveTheme(preference, systemDark);

  useEffect(() => {
    const mq = darkQuery();
    const onChange = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    applyTheme(resolvedTheme);
    cachePreference(preference);
  }, [resolvedTheme, preference]);

  const { mutate } = update;
  const setPreference = useCallback((pref: ThemePreference) => mutate(pref), [mutate]);

  const value = useMemo(() => ({ preference, resolvedTheme, setPreference }), [preference, resolvedTheme, setPreference]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside <ThemeProvider>");
  return ctx;
}
