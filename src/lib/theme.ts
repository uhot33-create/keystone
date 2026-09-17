export const THEME_KEY = "kurashi-theme";

export const THEMES = [
  { id: "default", label: "既定", swatch: "#2f3a32", paper: "#f3efe8" },
  { id: "spring", label: "春", swatch: "#c45c78", paper: "#fbf4f6" },
  { id: "midori", label: "新緑", swatch: "#4a7a48", paper: "#eef5e8" },
  { id: "tsuyu", label: "梅雨", swatch: "#5a6a9a", paper: "#eef0f7" },
  { id: "summer", label: "夏", swatch: "#2a7a8c", paper: "#eef6f8" },
  { id: "autumn", label: "秋", swatch: "#a04828", paper: "#f6efe4" },
  { id: "tsukimi", label: "月見", swatch: "#8a6a3a", paper: "#f4efe4" },
  { id: "winter", label: "冬", swatch: "#3a4e68", paper: "#eef1f5" },
] as const;

export type ThemeId = (typeof THEMES)[number]["id"];

export function isThemeId(value: unknown): value is ThemeId {
  return THEMES.some((item) => item.id === value);
}

export function readStoredTheme(): ThemeId {
  if (typeof localStorage === "undefined") return "default";
  try {
    const value = localStorage.getItem(THEME_KEY);
    return isThemeId(value) ? value : "default";
  } catch {
    return "default";
  }
}

export function applyTheme(theme: ThemeId) {
  if (typeof document === "undefined") return;
  if (theme === "default") document.documentElement.removeAttribute("data-theme");
  else document.documentElement.setAttribute("data-theme", theme);
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    /* ignore */
  }
}

export const THEME_BOOT_SCRIPT = `try{var t=localStorage.getItem("${THEME_KEY}");if(t==="spring"||t==="midori"||t==="tsuyu"||t==="summer"||t==="autumn"||t==="tsukimi"||t==="winter")document.documentElement.setAttribute("data-theme",t)}catch(e){}`;
