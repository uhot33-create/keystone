/**
 * 選んでいる配色をアプリ全体に配る。
 * テーマ id と保存キーは lib/theme.ts。色の実体は styles.css の data-theme。
 * 切り替えボタンは theme-settings.tsx。
 */
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { applyTheme, readStoredTheme, type ThemeId } from "@/lib/theme";

const ThemeContext = createContext<{
  theme: ThemeId;
  setTheme: (theme: ThemeId) => void;
}>({
  theme: "default",
  setTheme: () => {},
});

/** 起動時に保存済みの配色を読み、html に data-theme を付ける。 */
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

/** 今のテーマ id と、切り替える setTheme。 */
export function useTheme() {
  return useContext(ThemeContext);
}
