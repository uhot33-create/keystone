/**
 * 喫煙画面の控え。ブラウザのメモリだけ。
 * 画面は /smoking。本数の変更（smokeOne など）はここに残し、開き直しても取り直さない。
 * テーブルは smoking_settings と smoking_badges。日付が変わった残りの戻しは period.ts（日本時間0時）。
 * バッチを一度取ったあとも badgesLoaded が true なら、同じ内容を使う。
 */
import type { SmokingState } from "@/lib/smoking/types";

let held: SmokingState | null = null;
let badgesLoaded = false;

/** 控えが無ければ null。残り・上限・resetsAt を含む。 */
export function peekSmoking(): SmokingState | null {
  return held;
}

/** バッチの数字をすでに画面へ載せたか。false のあいだは getSmokingBadges を取る。 */
export function smokingBadgesLoaded(): boolean {
  return badgesLoaded;
}

/** 最新の state を覚える。withBadges を省略すると、いまの badgesLoaded を維持する。 */
export function holdSmoking(next: SmokingState, withBadges = badgesLoaded) {
  held = next;
  badgesLoaded = withBadges;
}
