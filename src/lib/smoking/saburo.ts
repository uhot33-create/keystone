/**
 * 残り本数に合わせた三郎の写真。
 * 画面は /smoking の減算タブ（丸い画像）。
 * 限度超えは STAGES の最後（激おこ）。それ以外は残り÷上限。
 * 境界は 75% 以上、50% 以上、25% 以上、それ未満。画像を差し替えるときは src。
 */
import type { SmokingState } from "./types";

/** 残りが多い順。0が仕方ない、4が激おこ。差し替えは src。 */
const STAGES = [
  { src: "/smoking/saburo/01-resigned.jpg", label: "仕方ない" },
  { src: "/smoking/saburo/02-annoyed.jpg", label: "ちょっと不満" },
  { src: "/smoking/saburo/03-angry.jpg", label: "怒り" },
  { src: "/smoking/saburo/04-very-angry.jpg", label: "かなり怒り" },
  { src: "/smoking/saburo/05-furious.jpg", label: "激おこ" },
] as const;

/** いまの残りと限度超えフラグから、出す画像を1枚選ぶ。 */
export function saburoStage(state: SmokingState) {
  if (state.exceeded) return STAGES[4];
  const ratio = state.dailyLimit > 0 ? state.remaining / state.dailyLimit : 0;
  if (ratio >= 0.75) return STAGES[0];
  if (ratio >= 0.5) return STAGES[1];
  if (ratio >= 0.25) return STAGES[2];
  return STAGES[3];
}
