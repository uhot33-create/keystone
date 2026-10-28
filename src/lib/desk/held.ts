/**
 * 机パネルの表示済み内容。ブラウザのメモリだけ。
 * 画面はホームの DeskPanel。暮らし帳へ戻ったとき、再取得を待たずに peek を出す。
 * テーブルは user_settings（出す項目）と user_dog_facts / desk_dog_news（取得キャッシュ）。
 * オンオフのメモリは visibility.ts。中身の形は DeskState（desk/types.ts）。
 */
import type { DeskState } from "@/lib/desk/types";

let held: DeskState | null = null;

/** まだ描いたことが無ければ null。 */
export function peekDesk(): DeskState | null {
  return held;
}

/** getDesk の結果で上書きする。項目を足すときは DeskState 側も足す。 */
export function holdDesk(next: DeskState) {
  held = next;
}
