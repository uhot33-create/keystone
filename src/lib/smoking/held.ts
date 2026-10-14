/**
 * 喫煙画面の控え。本数の変更はここに残し、開き直しても取り直さない。
 * バッチを一度取ったあとも、同じ内容を使う。
 */
import type { SmokingState } from "@/lib/smoking/types";

let held: SmokingState | null = null;
let badgesLoaded = false;

export function peekSmoking(): SmokingState | null {
  return held;
}

export function smokingBadgesLoaded(): boolean {
  return badgesLoaded;
}

export function holdSmoking(next: SmokingState, withBadges = badgesLoaded) {
  held = next;
  badgesLoaded = withBadges;
}
