/**
 * ヘッダーとログイン画面のマーク（ノート形の SVG）。
 * 形を変えるときは下の rect と path。色は text-primary なので配色テーマに従う。
 * アプリ名の文字はここではなく lib/app-meta.ts。
 */
import { cn } from "@/lib/utils";

/** ロゴ。className で大きさだけ渡す。読み上げはしない（aria-hidden）。 */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={cn("text-primary", className)}
      fill="none"
      aria-hidden="true"
    >
      <rect
        x="7"
        y="5"
        width="18"
        height="22"
        rx="2.5"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path
        d="M12 12h8M12 16.5h8M12 21h5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}
