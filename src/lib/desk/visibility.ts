/**
 * 机パネルの表示スイッチ。
 * 画面はホームの DeskPanel と設定。項目を足すときは DESK_ITEMS に id とラベルを追加する。
 * id は onThisDay, quote, story, dogFact, dogNews, fortune。settings.ts の列名も対応している。
 * チェックを変えるとすぐ画面に反映し、裏で saveUserSettings する。失敗しても表示は戻さない。
 * 起動時はルートの desk があればそれを使い、無ければ getUserSettings で読む。
 */
import { useLayoutEffect, useSyncExternalStore } from "react";
import { useRouteContext } from "@tanstack/react-router";
import { getUserSettings, saveUserSettings } from "./settings";

/** パネル項目の id と画面の名前。項目を増減するときはこの配列。 */
export const DESK_ITEMS = [
  { id: "onThisDay", label: "今日は何の日" },
  { id: "quote", label: "今日の格言" },
  { id: "story", label: "今日の小話" },
  { id: "dogFact", label: "今日の犬の豆知識" },
  { id: "dogNews", label: "最近の犬ネタ" },
  { id: "fortune", label: "今日の占い" },
] as const;

/** DESK_ITEMS の id。設定のキーと揃える。 */
export type DeskItemId = (typeof DESK_ITEMS)[number]["id"];

/** 項目 id ごとのオンオフ。 */
export type DeskVisibility = Record<DeskItemId, boolean>;

const listeners = new Set<() => void>();
let snapshot: DeskVisibility | null = null;
let hydrateStarted = false;

function emit(next: DeskVisibility) {
  snapshot = next;
  for (const listener of listeners) listener();
}

/** 1項目のオンオフを保存する。base は今の6項目全部。 */
export function setDeskItemVisible(id: DeskItemId, visible: boolean, base: DeskVisibility) {
  const next = { ...base, [id]: visible };
  emit(next);
  void saveUserSettings({ data: next }).catch(() => {
    /* keep optimistic value; next load will correct */
  });
}

/** 画面内の最新のオンオフ。まだ読む前は null。 */
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

/** メモリにあればそれ、無ければルートの desk。 */
export function useResolvedDeskVisibility(): DeskVisibility | null {
  const stored = useDeskVisibility();
  const { desk } = useRouteContext({ from: "__root__" });
  return stored ?? desk;
}

/** 初回だけ設定をメモリへ載せる。机パネルより先に呼ぶ想定。 */
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
