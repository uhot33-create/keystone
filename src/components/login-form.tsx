import { useRouter } from "@tanstack/react-router";
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

const credentialsSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "メールアドレスを入力してください")
    .email("メールアドレスの形式が正しくありません"),
  password: z.string().min(8, "パスワードは8文字以上にしてください"),
});

export function LoginScreen() {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const parsed = credentialsSchema.safeParse({ email, password });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "入力内容を確認してください");
      return;
    }
    if (mode === "signup" && password !== confirm) {
      setError("パスワードが一致しません");
      return;
    }
    if (!authEnabled) {
      setError("ログイン機能が無効です");
      return;
    }

    setPending(true);
    try {
      if (mode === "signup") {
        const { error: signUpError } = await authClient.signUp.email({
          email: parsed.data.email,
          password: parsed.data.password,
          name: parsed.data.email.split("@")[0] || "ユーザー",
        });
        if (signUpError) throw signUpError;
      } else {
        const { error: signInError } = await authClient.signIn.email({
          email: parsed.data.email,
          password: parsed.data.password,
        });
        if (signInError) throw signInError;
      }
      await router.invalidate();
      await router.navigate({ to: "/" });
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
          <h1 className="mt-4 font-display text-3xl font-semibold tracking-tight text-fg">
            {APP_NAME}
          </h1>
          <p className="mt-2 text-sm text-muted">{APP_TAGLINE}</p>
        </div>

        <div className="rounded-xl border border-border bg-surface p-6 shadow-card">
          <div className="mb-6 grid grid-cols-2 rounded-md bg-surface-2 p-1">
            <button
              type="button"
              className={tabClass(mode === "signin")}
              onClick={() => {
                setMode("signin");
                setError(null);
              }}
            >
              ログイン
            </button>
            <button
              type="button"
              className={tabClass(mode === "signup")}
              onClick={() => {
                setMode("signup");
                setError(null);
              }}
            >
              新規登録
            </button>
          </div>

          <form className="space-y-4" onSubmit={onSubmit} noValidate>
            <div className="space-y-1.5">
              <Label htmlFor="email">メールアドレス</Label>
              <Input
                id="email"
                name="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                autoCapitalize="none"
                spellCheck={false}
                placeholder="you@example.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password">パスワード</Label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                placeholder="8文字以上"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                minLength={8}
              />
            </div>

            {mode === "signup" ? (
              <div className="space-y-1.5">
                <Label htmlFor="confirm">パスワード（確認）</Label>
                <Input
                  id="confirm"
                  name="confirm"
                  type="password"
                  autoComplete="new-password"
                  placeholder="もう一度入力"
                  value={confirm}
                  onChange={(event) => setConfirm(event.target.value)}
                  required
                  minLength={8}
                />
              </div>
            ) : null}

            {error ? (
              <p className="text-sm text-danger" role="alert">
                {error}
              </p>
            ) : null}

            <Button type="submit" className="w-full" disabled={pending}>
              {pending
                ? "処理しています…"
                : mode === "signup"
                  ? "登録してはじめる"
                  : "ログイン"}
            </Button>
          </form>
        </div>

        <p className="mt-5 text-center text-xs leading-relaxed text-subtle">
          メールアドレス形式のみでご利用いただけます。
        </p>
      </div>
    </PaperWash>
  );
}

export function AuthSplash() {
  return (
    <PaperWash className="grid min-h-dvh place-items-center px-5">
      <div className="relative z-10 flex flex-col items-center text-center">
        <BrandMark className="size-10" />
        <p className="mt-4 font-display text-2xl font-semibold text-fg">{APP_NAME}</p>
        <p className="mt-2 text-sm text-muted">読み込み中</p>
      </div>
    </PaperWash>
  );
}

function tabClass(active: boolean) {
  return [
    "h-10 rounded-sm text-sm font-medium transition-colors duration-150",
    active ? "bg-surface text-fg shadow-card" : "text-muted hover:text-fg",
  ].join(" ");
}
