/**
 * 白い枠のカード。余白の揃った見出し・本文に分ける。
 * 枠と影は border-border と shadow-card。色の実体は styles.css。
 */
import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/** カードの外枠。 */
export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-surface text-fg shadow-card",
        className,
      )}
      {...props}
    />
  );
}

/** カード上部の余白。タイトルと説明を縦に並べる。 */
export function CardHeader({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col gap-1.5 p-6", className)} {...props} />;
}

/** カードの見出し。フォントは明朝（font-display）。 */
export function CardTitle({
  className,
  ...props
}: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn("font-display text-lg font-semibold leading-snug", className)}
      {...props}
    />
  );
}

/** 見出しの下の補足。色は muted。 */
export function CardDescription({
  className,
  ...props
}: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-sm text-muted", className)} {...props} />;
}

/** カード本文。上の余白は見出し側に任せている。 */
export function CardContent({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-6 pt-0", className)} {...props} />;
}
