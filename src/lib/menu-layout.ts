import { useSyncExternalStore } from "react";

const KEY = "kurashi-menu-layout";
export type MenuLayout = "icons" | "list";

const listeners = new Set<() => void>();
let current: MenuLayout = read();

function read(): MenuLayout {
  if (typeof localStorage === "undefined") return "icons";
  return localStorage.getItem(KEY) === "list" ? "list" : "icons";
}

export function setMenuLayout(next: MenuLayout) {
  current = next;
  try {
    localStorage.setItem(KEY, next);
  } catch {
    /* ignore */
  }
  for (const listener of listeners) listener();
}

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
