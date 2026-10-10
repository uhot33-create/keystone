/**
 * トップメニューをアイコンか一覧のどちらで出すか。localStorage に保存する。
 * キーは KEY。初期値は icons。切り替え UI は components/account-chip.tsx。
 * メニュー項目そのものは lib/app-meta.ts の MENUS。
 */
import { useSyncExternalStore } from "react";

/** localStorage のキー。変えると保存済みの並び方がリセットされる。 */
const KEY = "kurashi-menu-layout";
/** icons は格子、list は縦の一覧。 */
export type MenuLayout = "icons" | "list";

const listeners = new Set<() => void>();
let current: MenuLayout = read();

function read(): MenuLayout {
  if (typeof localStorage === "undefined") return "icons";
  return localStorage.getItem(KEY) === "list" ? "list" : "icons";
}

/** 表示を切り替えて保存し、見ている画面へ知らせる。 */
export function setMenuLayout(next: MenuLayout) {
  current = next;
  try {
    localStorage.setItem(KEY, next);
  } catch {
    /* ignore */
  }
  for (const listener of listeners) listener();
}

/** 今の並び。サーバー描画時は icons。 */
export function useMenuLayout(): MenuLayout {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => current,
    () => "icons",
  );
}
