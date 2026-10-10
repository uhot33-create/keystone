/**
 * ログイン後の共通レイアウト（ヘッダーと本文）。
 * アプリ名は lib/app-meta.ts の APP_NAME。ヘッダーの高さや余白はこの className。
 * 背景色・文字色は styles.css の --color-*（配色テーマに従う）。
 */
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { APP_NAME } from "@/lib/app-meta";
import { AccountChip } from "@/components/account-chip";
import { BrandMark } from "@/components/brand-mark";
import { PaperWash, ThemeMotif } from "@/components/theme-motif";
import { useHydrateDeskVisibility } from "@/lib/desk/visibility";

/** 全画面共通のヘッダーとメイン。children が各ページの中身。 */
export function AppShell({ children }: { children: ReactNode }) {
  useHydrateDeskVisibility();
  return (
    <PaperWash className="flex min-h-dvh flex-col">
      <header className="relative z-20 border-b border-border/80 bg-surface/80">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between gap-3 px-5">
          <Link
            to="/"
            className="flex min-h-11 items-center gap-2 text-fg outline-none focus-visible:ring-2 focus-visible:ring-ring/35"
          >
            <BrandMark className="size-7" />
            <span className="font-display text-lg font-semibold tracking-tight">
              {APP_NAME}
            </span>
          </Link>
          <div className="flex min-w-0 items-center gap-2">
            <ThemeMotif compact />
            <AccountChip />
          </div>
        </div>
      </header>
      <main className="relative z-10 mx-auto flex w-full max-w-3xl flex-1 flex-col px-5 py-8 sm:py-12">
        {children}
      </main>
    </PaperWash>
  );
}