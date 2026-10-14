/**
 * おさんぽログ一覧の控え。取り込みで更新し、削除のときは消して次に取り直す。
 */
import type { WalkLogList } from "@/lib/walk-log/api";

let held: WalkLogList | null = null;

export function peekWalkLogs(): WalkLogList | null {
  return held;
}

export function holdWalkLogs(next: WalkLogList) {
  held = next;
}

export function dropWalkLogs() {
  held = null;
}
