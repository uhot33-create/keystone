import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { APP_NAME } from "@/lib/app-meta";
import { AccountChip } from "@/components/account-chip";
import { BrandMark } from "@/components/brand-mark";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="paper-wash flex min-h-dvh flex-col">
      <header className="border-b border-border/80 bg-surface/80">
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
          <AccountChip />
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-5 py-8 sm:py-12">
        {children}
      </main>
    </div>
  );
}
