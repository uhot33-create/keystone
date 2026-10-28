/**
 * /login。すでにログイン済みならトップへ戻す。
 * フォーム本体は components/login-form.tsx。認証の有無は VITE_AUTH_ENABLED。
 */
import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { AuthSplash, LoginScreen } from "@/components/login-form";

/** ログイン専用ルート。確認中は待ち画面。 */
export const Route = createFileRoute("/login")({ component: Login });

/** 確認中は待ち画面。ログイン済みならトップへ戻し、未ログインだけフォームを出す。 */
function Login() {
  const { user, isPending } = useCurrentUserState();
  if (isPending) return <AuthSplash />;
  if (user) return <Navigate to="/" />;
  return <LoginScreen />;
}
