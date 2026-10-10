/**
 * 配色の一覧と、選んだテーマの保存・適用。
 * テーマを足すときは THEMES に id を追加し、styles.css の data-theme と theme-motif.tsx の MOTIFS も揃える。
 * 保存キーは THEME_KEY。最初の描画のちらつき防止は THEME_BOOT_SCRIPT（id を足したら文字列も足す）。
 */
/** localStorage のキー。変えると保存済みの配色がリセットされる。 */
export const THEME_KEY = "kurashi-theme";

/** 選べる配色。id は styles.css の data-theme と一致。swatch と paper は設定画面の見本。 */
export const THEMES = [
  { id: "default", label: "既定", swatch: "#2f3a32", paper: "#f3efe8" },
  { id: "spring", label: "春", swatch: "#c45c78", paper: "#fbf4f6" },
  { id: "midori", label: "新緑", swatch: "#4a7a48", paper: "#eef5e8" },
  { id: "tsuyu", label: "梅雨", swatch: "#5a6a9a", paper: "#eef0f7" },
  { id: "summer", label: "夏", swatch: "#2a7a8c", paper: "#eef6f8" },
  { id: "autumn", label: "秋", swatch: "#a04828", paper: "#f6efe4" },
  { id: "tsukimi", label: "月見", swatch: "#8a6a3a", paper: "#f4efe4" },
  { id: "winter", label: "冬", swatch: "#3a4e68", paper: "#eef1f5" },
  { id: "macaron", label: "マカロン", swatch: "#c46b7a", paper: "#fbf6f2" },
] as const;

/** THEMES の id の型。 */
export type ThemeId = (typeof THEMES)[number]["id"];

/** 保存値が本当にテーマ id か。 */
export function isThemeId(value: unknown): value is ThemeId {
  return THEMES.some((item) => item.id === value);
}

/** 保存済みテーマ。無い・壊れている・サーバー上では既定。 */
export function readStoredTheme(): ThemeId {
  if (typeof localStorage === "undefined") return "default";
  try {
    const value = localStorage.getItem(THEME_KEY);
    return isThemeId(value) ? value : "default";
  } catch {
    return "default";
  }
}

/** html に data-theme を付けて色を切り替え、同時に保存する。既定は属性を外す。 */
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

/** 最初の描画前に head で実行するスクリプト。THEMES に id を足したらここの比較も足す。 */
export const THEME_BOOT_SCRIPT = `try{var t=localStorage.getItem("${THEME_KEY}");if(t==="spring"||t==="midori"||t==="tsuyu"||t==="summer"||t==="autumn"||t==="tsukimi"||t==="winter"||t==="macaron")document.documentElement.setAttribute("data-theme",t)}catch(e){}`;
