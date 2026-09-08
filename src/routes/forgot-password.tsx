import { Link, createFileRoute } from "@tanstack/react-router";
import { type FormEvent, useState } from "react";
import { z } from "zod";
import { authClient, authEnabled } from "@/lib/auth/client";
import { toJapaneseAuthError } from "@/lib/auth-errors";
import { APP_NAME, APP_TAGLINE } from "@/lib/app-meta";
import { BrandMark } from "@/components/brand-mark";
import { PaperWash } from "@/components/theme-motif";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/forgot-password")({
  component: ForgotPasswordPage,
});

const emailSchema = z
  .string()
  .trim()
  .min(1, "メールアドレスを入力してください")
  .email("メールアドレスの形式が正しくありません");

function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const parsed = emailSchema.safeParse(email);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "入力内容を確認してください");
      return;
    }
    if (!authEnabled) {
      setError("ログイン機能が無効です");
      return;
    }
    setPending(true);
    try {
      const { error: resetError } = await authClient.requestPasswordReset({
        email: parsed.data,
        redirectTo: "/reset-password",
      });
      if (resetError) throw resetError;
      setDone(true);
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
          <h2 className="font-display text-lg font-semibold text-fg">パスワードの再設定</h2>
          {done ? (
            <p className="mt-4 text-sm leading-relaxed text-muted">
              登録がある場合、再設定用のメールを送りました。メールのリンクから新しいパスワードを設定してください。
            </p>
          ) : (
            <form className="mt-4 space-y-4" onSubmit={onSubmit} noValidate>
              <div className="space-y-1.5">
                <Label htmlFor="forgot-email">メールアドレス</Label>
                <Input
                  id="forgot-email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  autoCapitalize="none"
                  spellCheck={false}
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                />
              </div>
              {error ? (
                <p className="text-sm text-danger" role="alert">
                  {error}
                </p>
              ) : null}
              <Button type="submit" className="w-full" disabled={pending}>
                {pending ? "送信しています…" : "再設定メールを送る"}
              </Button>
            </form>
          )}
        </div>
        <p className="mt-5 text-center text-sm">
          <Link to="/login" className="text-primary underline-offset-4 hover:underline">
            ログインへ
          </Link>
        </p>
      </div>
    </PaperWash>
  );
}
