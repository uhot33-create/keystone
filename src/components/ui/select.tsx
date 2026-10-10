/**
 * プルダウン。見た目は Input と揃えている。
 * 枠とフォーカスの色は styles.css。選択肢の中身は children に書く。
 */
import type { SelectHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/** select 要素。option は呼び出す側が渡す。 */
export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "flex h-11 w-full rounded-md border border-border bg-surface px-3 text-base text-fg shadow-card outline-none transition-[box-shadow,border-color] duration-150 ease-[var(--ease-out)]",
        "focus-visible:border-primary/40 focus-visible:ring-2 focus-visible:ring-ring/25",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}
