import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { type FormEvent, useState } from "react";
import { authClient } from "@/lib/auth/client";
import { toJapaneseAuthError } from "@/lib/auth-errors";
import { Protected } from "@/components/protected";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/password")({
  component: PasswordPage,
});

function PasswordPage() {
  return (
    <Protected>
      <ChangePasswordForm />
    </Protected>
  );
}

function ChangePasswordForm() {
  const navigate = useNavigate();
  const [currentPassword, setCurrentPassword] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, setPending] = useState(false);

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
    setPending(true);
    try {
      const { error: changeError } = await authClient.changePassword({
        currentPassword,
        newPassword: password,
        revokeOtherSessions: true,
      });
      if (changeError) throw changeError;
      setDone(true);
      window.setTimeout(() => {
        void navigate({ to: "/" });
      }, 1200);
    } catch (err) {
      setError(toJapaneseAuthError(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="stagger-in mx-auto w-full max-w-sm">
      <h1 className="font-display text-2xl font-semibold text-fg">パスワードの再設定</h1>
      <p className="mt-2 text-sm text-muted">現在のパスワードを確認してから、新しいパスワードにします。</p>
      {done ? (
        <p className="mt-6 text-sm text-muted">更新しました。</p>
      ) : (
        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          <div className="space-y-1.5">
            <Label htmlFor="current-password">現在のパスワード</Label>
            <Input
              id="current-password"
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="change-password">新しいパスワード</Label>
            <Input
              id="change-password"
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
            <Label htmlFor="change-password-confirm">パスワード（確認）</Label>
            <Input
              id="change-password-confirm"
              type="password"
              autoComplete="new-password"
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
            {pending ? "保存しています…" : "更新する"}
          </Button>
        </form>
      )}
      <p className="mt-5 text-sm">
        <Link to="/" className="text-primary underline-offset-4 hover:underline">
          メニューへ
        </Link>
      </p>
    </div>
  );
}
