/**
 * ログイン必須の中身を包む部品。
 * 確認中は待ち画面、未ログインはログインへ、通ったら AppShell の中に出す。
 * 戻り先のパスは lib/auth/gates.tsx の SIGN_IN_PATH。
 */
import type { ReactNode } from "react";
import { useRouteContext } from "@tanstack/react-router";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { AppShell } from "@/components/app-shell";
import { AuthSplash } from "@/components/login-form";

/** 子要素を、ログイン済みのときだけアプリ枠に入れる。 */
export function Protected({ children }: { children: ReactNode }) {
  const { sessionUser } = useRouteContext({ from: "__root__" });
  const { user, isPending } = useCurrentUserState();
  if (!user && !sessionUser && isPending) return <AuthSplash />;
  if (!user && !sessionUser) return <RedirectToSignIn />;
  return <AppShell>{children}</AppShell>;
}
