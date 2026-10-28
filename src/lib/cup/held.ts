/**
 * カップ麺の在庫と品名の控え。ブラウザのメモリだけ。
 * 画面は /cup。保存のあとは CupApp の reload が getCupState で上書きする。
 * テーブルは cup_items（品名）と cup_stocks（期限・個数）。在庫のルール自体は cup/api.ts。
 * 期限が近い強調（30日）は画面側。ここは配列を持つだけ。
 */
import type { CupItem, CupStock } from "@/lib/cup/api";

type HeldCup = { items: CupItem[]; stocks: CupStock[] };

let held: HeldCup | null = null;

/** 控えが無ければ null。在庫タブを先に出すときに使う。 */
export function peekCup(): HeldCup | null {
  return held;
}

/** 品名と在庫をまとめて上書きする。自分の user_id の行だけが入っている前提。 */
export function holdCup(next: HeldCup) {
  held = next;
}
