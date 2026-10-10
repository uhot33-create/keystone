/**
 * 1行入力。高さはタップしやすい h-11。
 * 枠色・フォーカスは border と ring（styles.css の --color-*）。
 * プレースホルダの色は subtle。
 */
import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/** input に渡せる属性そのもの。 */
export type InputProps = InputHTMLAttributes<HTMLInputElement>;

/** テキスト入力。type の既定は text。 */
export function Input({ className, type = "text", ...props }: InputProps) {
  return (
    <input
      type={type}
      suppressHydrationWarning
      className={cn(
        "flex h-11 w-full rounded-md border border-border bg-surface px-3 text-base text-fg shadow-card outline-none transition-[box-shadow,border-color] duration-150 ease-[var(--ease-out)] placeholder:text-subtle",
        "focus-visible:border-primary/40 focus-visible:ring-2 focus-visible:ring-ring/25",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}
