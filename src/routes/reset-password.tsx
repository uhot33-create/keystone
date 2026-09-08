import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { type FormEvent, useMemo, useState } from "react";
import { authClient, authEnabled } from "@/lib/auth/client";
import { toJapaneseAuthError } from "@/lib/auth-errors";
import { APP_NAME, APP_TAGLINE } from "@/lib/app-meta";
import { BrandMark } from "@/components/brand-mark";
import { PaperWash } from "@/components/theme-motif";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/reset-password")({
  validateSearch: (search: Record<string, unknown>) => ({
    token: typeof search.token === "string" ? search.token : "",
    error: typeof search.error === "string" ? search.error : "",
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const { token, error: searchError } = Route.useSearch();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const invalidLink = useMemo(
    () => Boolean(searchError) || !token,
    [searchError, token],
  );

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("パスワードは8文字以上にしてください");
      return;
    }
    if (password !== confirm) {
      setError("パスワードが一致しません");
      return;
    }
    if (!authEnabled) {
      setError("ログイン機能が無効です");
      return;
    }
    setPending(true);
    try {
      const { error: resetError } = await authClient.resetPassword({
        newPassword: password,
        token,
      });
      if (resetError) throw resetError;
      await navigate({ to: "/login" });
    } catch (err) {
      setError(toJapaneseAuthError(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <PaperWash className="grid min-h-dvh place-items-center px-5 py-10">
      <div className="relative z-10 stagger-in w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <BrandMark className="size-10" />
          <h1 className="mt-4 font-display text-3xl font-semibold tracking-tight text-fg">{APP_NAME}</h1>
          <p className="mt-2 text-sm text-muted">{APP_TAGLINE}</p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-6 shadow-card">
          <h2 className="font-display text-lg font-semibold text-fg">新しいパスワード</h2>
          {invalidLink ? (
            <p className="mt-4 text-sm leading-relaxed text-danger">
              再設定用のリンクが無効か、期限切れです。もう一度メールを送ってください。
            </p>
          ) : (
            <form className="mt-4 space-y-4" onSubmit={onSubmit}>
              <div className="space-y-1.5">
                <Label htmlFor="new-password">新しいパスワード</Label>
                <Input
                  id="new-password"
                  type="password"
                  autoComplete="new-password"
                  placeholder="8文字以上"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  minLength={8}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="new-password-confirm">パスワード（確認）</Label>
                <Input
                  id="new-password-confirm"
                  type="password"
                  autoComplete="new-password"
                  placeholder="もう一度入力"
                  value={confirm}
                  onChange={(event) => setConfirm(event.target.value)}
                  required
                  minLength={8}
                />
              </div>
              {error ? (
                <p className="text-sm text-danger" role="alert">
                  {error}
                </p>
              ) : null}
              <Button type="submit" className="w-full" disabled={pending}>
                {pending ? "保存しています…" : "パスワードを更新"}
              </Button>
            </form>
          )}
        </div>
        <p className="mt-5 text-center text-sm">
          <Link to="/forgot-password" className="text-primary underline-offset-4 hover:underline">
            メールを再送する
          </Link>
          <span className="text-subtle"> ／ </span>
          <Link to="/login" className="text-primary underline-offset-4 hover:underline">
            ログインへ
          </Link>
        </p>
      </div>
    </PaperWash>
  );
}
