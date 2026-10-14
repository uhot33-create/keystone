/**
 * 机パネルの表示済み内容。暮らし帳へ戻ったとき、再取得を待たずに出す。
 */
import type { DeskState } from "@/lib/desk/types";

let held: DeskState | null = null;

export function peekDesk(): DeskState | null {
  return held;
}

export function holdDesk(next: DeskState) {
  held = next;
}
