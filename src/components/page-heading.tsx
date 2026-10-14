/**
 * 各画面の先頭に出す機能名。大きさは全画面で同じ。
 */
import type { ReactNode } from "react";

export function PageHeading({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h1 className="min-w-0 truncate font-display text-lg font-semibold text-fg">{title}</h1>
      {children ? <div className="flex shrink-0 gap-2">{children}</div> : null}
    </div>
  );
}
