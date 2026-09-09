import { useEffect, useSyncExternalStore } from "react";
import { getUserSettings, saveUserSettings } from "./settings";

export const DESK_ITEMS = [
  { id: "onThisDay", label: "今日は何の日" },
  { id: "quote", label: "今日の格言" },
  { id: "story", label: "今日の小話" },
  { id: "dogFact", label: "今日の犬の豆知識" },
  { id: "fortune", label: "今日の占い" },
] as const;

export type DeskItemId = (typeof DESK_ITEMS)[number]["id"];

export type DeskVisibility = Record<DeskItemId, boolean>;

export const DEFAULT_VISIBILITY: DeskVisibility = {
  onThisDay: true,
  quote: true,
  story: true,
  dogFact: true,
  fortune: true,
};

const listeners = new Set<() => void>();
let snapshot: DeskVisibility = DEFAULT_VISIBILITY;
let hydrated = false;

function emit(next: DeskVisibility) {
  snapshot = next;
  for (const listener of listeners) listener();
}

export function setDeskItemVisible(id: DeskItemId, visible: boolean) {
  const next = { ...snapshot, [id]: visible };
  emit(next);
  void saveUserSettings({ data: next }).catch(() => {
    /* keep optimistic value; next hydrate will correct */
  });
}

export function useDeskVisibility(): DeskVisibility {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => snapshot,
    () => DEFAULT_VISIBILITY,
  );
}

export function useHydrateDeskVisibility() {
  useEffect(() => {
    if (hydrated) return;
    hydrated = true;
    getUserSettings()
      .then((next) => emit(next))
      .catch(() => {
        hydrated = false;
      });
  }, []);
}
