import type { ReactNode } from "react";
import { useRouteContext } from "@tanstack/react-router";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { AppShell } from "@/components/app-shell";
import { AuthSplash } from "@/components/login-form";

export function Protected({ children }: { children: ReactNode }) {
  const { sessionUser } = useRouteContext({ from: "__root__" });
  const { user, isPending } = useCurrentUserState();
  if (!user && !sessionUser && isPending) return <AuthSplash />;
  if (!user && !sessionUser) return <RedirectToSignIn />;
  return <AppShell>{children}</AppShell>;
}
