/**
 * おさんぽログ一覧の控え。ブラウザのメモリだけ（テーブル walk_logs そのものではない）。
 * 画面は /dogwalklogs。取り込み（saveWalkLog）の戻りで hold し、削除のときは drop して次に取り直す。
 * 月地図の軌跡はここには入れない。年月のまとめは walk_month_tracks（merge.ts）。
 * 中身の形は WalkLogList（walk-log/api.ts）。ユーザーを切り替えたあとの消し忘れに注意。
 */
import type { WalkLogList } from "@/lib/walk-log/api";

let held: WalkLogList | null = null;

/** 控えが無ければ null。一覧を開いたときの先出しに使う。 */
export function peekWalkLogs(): WalkLogList | null {
  return held;
}

/** 取り込み直後の一覧で上書きする。 */
export function holdWalkLogs(next: WalkLogList) {
  held = next;
}

/** 控えを捨てる。1件削除のあと、次の表示で getWalkLogs を取り直す。 */
export function dropWalkLogs() {
  held = null;
}
