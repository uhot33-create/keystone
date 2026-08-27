import { useState } from "react";
import { signOut } from "@/lib/auth/client";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export function AccountChip() {
  const user = useCurrentUser();
  const [signingOut, setSigningOut] = useState(false);

  if (!user) {
    return <Skeleton className="h-11 w-40 rounded-md" />;
  }

  const label = user.primaryEmail ?? user.displayName ?? "アカウント";
  const initial = label.charAt(0).toUpperCase();

  return (
    <div className="flex min-w-0 items-center gap-2">
      <span
        className="grid size-9 shrink-0 place-items-center rounded-full bg-surface-2 font-display text-sm font-semibold text-primary"
        aria-hidden="true"
      >
        {initial}
      </span>
      <span className="hidden min-w-0 truncate text-sm text-muted sm:inline">
        {label}
      </span>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={signingOut}
        className="shrink-0 text-muted"
        onClick={() => {
          setSigningOut(true);
          void signOut("/login").catch(() => setSigningOut(false));
        }}
      >
        {signingOut ? "処理中…" : "ログアウト"}
      </Button>
    </div>
  );
}
