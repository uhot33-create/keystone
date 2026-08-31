import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { applyTheme, readStoredTheme, type ThemeId } from "@/lib/theme";

const ThemeContext = createContext<{
  theme: ThemeId;
  setTheme: (theme: ThemeId) => void;
}>({
  theme: "default",
  setTheme: () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeId>(() =>
    typeof window === "undefined" ? "default" : readStoredTheme(),
  );

  useEffect(() => {
    const stored = readStoredTheme();
    setThemeState(stored);
    applyTheme(stored);
  }, []);

  const value = useMemo(
    () => ({
      theme,
      setTheme: (next: ThemeId) => {
        setThemeState(next);
        applyTheme(next);
      },
    }),
    [theme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
