/**
 * className を1つにまとめる関数。条件つきクラスと Tailwind の重複を整理する。
 * 色そのものは styles.css。ここはクラス名の結合だけ。
 */
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** 複数の class を1つにまとめる。ボタンや入力欄で使う。 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
