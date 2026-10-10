/**
 * 共通ボタン。variant で塗り・枠線・文字リンクを切り替える。
 * 色クラスは bg-primary など。配色を変えるなら styles.css の --color-primary。
 * 高さは size。タップしやすいよう min-h を維持している。
 */
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/** 見た目の組み合わせ。variant は default / outline / ghost / link。 */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium outline-none transition-[background-color,box-shadow,transform,opacity,color] duration-150 ease-[var(--ease-out)] focus-visible:ring-2 focus-visible:ring-ring/35 disabled:pointer-events-none disabled:opacity-50 active:not-disabled:scale-[0.96] [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-fg shadow-card hover:bg-primary/90",
        outline:
          "border border-border bg-surface text-fg shadow-card hover:bg-surface-2",
        ghost: "text-fg hover:bg-surface-2",
        link: "text-fg underline-offset-4 hover:underline",
      },
      size: {
        default: "h-11 min-h-11 px-4",
        sm: "h-9 min-h-9 px-3 text-xs",
        lg: "h-12 min-h-12 px-6",
        icon: "size-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

/** 通常の button 属性に、variant・size・asChild を足した型。 */
export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  };

/** ボタン本体。asChild なら子要素に同じ class を載せる。 */
export function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}
