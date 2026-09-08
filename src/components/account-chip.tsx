import { Link } from "@tanstack/react-router";
import { useEffect, useId, useRef, useState } from "react";
import { signOut } from "@/lib/auth/client";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ThemeSettings } from "@/components/theme-settings";

export function AccountChip() {
  const user = useCurrentUser();
  const [signingOut, setSigningOut] = useState(false);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    function onPointer(event: PointerEvent) {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (rootRef.current?.contains(target)) return;
      if (target instanceof Element && target.closest("[data-theme-dialog]")) return;
      setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      if (document.querySelector("[data-theme-dialog]")) return;
      setOpen(false);
    }
    window.addEventListener("pointerdown", onPointer);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onPointer);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!user) {
    return <Skeleton className="h-11 w-40 rounded-md" />;
  }

  const label = user.primaryEmail ?? user.displayName ?? "アカウント";
  const initial = label.charAt(0).toUpperCase();

  return (
    <div ref={rootRef} className="relative flex min-w-0 items-center gap-2">
      <button
        type="button"
        className="grid size-9 shrink-0 place-items-center rounded-full bg-surface-2 font-display text-sm font-semibold text-primary outline-none focus-visible:ring-2 focus-visible:ring-ring/35"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label="アカウント"
        onClick={() => setOpen((value) => !value)}
      >
        {initial}
      </button>
      <div
        id={panelId}
        hidden={!open}
        className="absolute right-0 top-[calc(100%+0.5rem)] z-30 w-[min(18rem,calc(100vw-2.5rem))] rounded-xl border border-border bg-surface p-4 shadow-card-hover"
      >
        <p className="break-all text-sm text-fg">{label}</p>
        <div className="mt-3 flex items-center justify-between gap-2">
          <span className="text-sm text-fg">配色</span>
          <ThemeSettings />
        </div>
        <Link
          to="/password"
          className="mt-3 inline-flex min-h-11 items-center text-sm text-primary underline-offset-4 hover:underline"
          onClick={() => setOpen(false)}
        >
          パスワードの再設定
        </Link>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={signingOut}
        className="shrink-0 text-muted"
        onClick={() => {
          if (!window.confirm("ログアウトしますか？")) return;
          setSigningOut(true);
          void signOut("/login").catch(() => setSigningOut(false));
        }}
      >
        {signingOut ? "処理中…" : "ログアウト"}
      </Button>
    </div>
  );
}
