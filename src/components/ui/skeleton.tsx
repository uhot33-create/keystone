/**
 * 読み込み中の灰色の骨組み。データが来るまで形だけ見せる。
 * 色は bg-surface-2（styles.css）。大きさは className で渡す。
 */
import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/** 点滅するプレースホルダ。中身は空。 */
export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-surface-2", className)}
      {...props}
    />
  );
}
