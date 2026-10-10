/**
 * フォームのラベル。入力欄の htmlFor と id を揃えて使う。
 * 文字色は text-fg。無効な隣の入力があるときは薄くなる。
 */
import * as LabelPrimitive from "@radix-ui/react-label";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/** ラベル文言。className で余白だけ足すことが多い。 */
export function Label({
  className,
  ...props
}: ComponentProps<typeof LabelPrimitive.Root>) {
  return (
    <LabelPrimitive.Root
      className={cn(
        "text-sm font-medium text-fg peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}
