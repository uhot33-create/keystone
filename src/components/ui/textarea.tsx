import type { TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "flex min-h-28 w-full rounded-md border border-border bg-surface px-3 py-2.5 text-base text-fg shadow-card outline-none transition-[box-shadow,border-color] duration-150 ease-[var(--ease-out)] placeholder:text-subtle",
        "focus-visible:border-primary/40 focus-visible:ring-2 focus-visible:ring-ring/25",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}
