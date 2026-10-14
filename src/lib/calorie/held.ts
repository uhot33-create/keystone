/**
 * 暮らし帳とわんカロリー画面で共有する、今開いているデータ。
 * 画面を行き来するときはサーバーへ取り直さず、これを渡す。
 * 日付もこの中の date。タブを閉じると消える。
 */
import type { CalorieState } from "@/lib/calorie/types";

let held: CalorieState | null = null;

/** いま持っているデータ。無ければ null。 */
export function peekCalorieState(): CalorieState | null {
  return held;
}

/** 日付変更や保存のあと、両方の画面が同じ内容を見るように残す。 */
export function holdCalorieState(state: CalorieState) {
  held = state;
}
