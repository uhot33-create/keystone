/**
 * カップ麺の在庫と品名。保存のあとは reload で上書きする。
 */
import type { CupItem, CupStock } from "@/lib/cup/api";

type HeldCup = { items: CupItem[]; stocks: CupStock[] };

let held: HeldCup | null = null;

export function peekCup(): HeldCup | null {
  return held;
}

export function holdCup(next: HeldCup) {
  held = next;
}
