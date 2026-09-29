import { useLayoutEffect, useSyncExternalStore } from "react";
import { useRouteContext } from "@tanstack/react-router";
import { getUserSettings, saveUserSettings } from "./settings";

export const DESK_ITEMS = [
  { id: "onThisDay", label: "今日は何の日" },
  { id: "quote", label: "今日の格言" },
  { id: "story", label: "今日の小話" },
  { id: "dogFact", label: "今日の犬の豆知識" },
  { id: "dogNews", label: "最近の犬ネタ" },
  { id: "fortune", label: "今日の占い" },
] as const;

export type DeskItemId = (typeof DESK_ITEMS)[number]["id"];

export type DeskVisibility = Record<DeskItemId, boolean>;

const listeners = new Set<() => void>();
let snapshot: DeskVisibility | null = null;
let hydrateStarted = false;

function emit(next: DeskVisibility) {
  snapshot = next;
  for (const listener of listeners) listener();
}

export function setDeskItemVisible(id: DeskItemId, visible: boolean, base: DeskVisibility) {
  const next = { ...base, [id]: visible };
  emit(next);
  void saveUserSettings({ data: next }).catch(() => {
    /* keep optimistic value; next load will correct */
  });
}

export function useDeskVisibility(): DeskVisibility | null {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => snapshot,
    () => null,
  );
}

export function useResolvedDeskVisibility(): DeskVisibility | null {
  const stored = useDeskVisibility();
  const { desk } = useRouteContext({ from: "__root__" });
  return stored ?? desk;
}

export function useHydrateDeskVisibility() {
  const { desk, sessionUser } = useRouteContext({ from: "__root__" });
  useLayoutEffect(() => {
    if (snapshot) return;
    if (desk) {
      emit(desk);
      return;
    }
    if (!sessionUser || hydrateStarted) return;
    hydrateStarted = true;
    getUserSettings()
      .then((next) => emit(next))
      .catch(() => undefined);
  }, [desk, sessionUser]);
}
