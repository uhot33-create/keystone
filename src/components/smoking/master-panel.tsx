import { useEffect, useState, type FormEvent } from "react";
import { saveDailyLimit } from "@/lib/smoking/api";
import { formatJaDateTime } from "@/lib/smoking/period";
import type { SmokingState } from "@/lib/smoking/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function MasterPanel({
  state,
  onChange,
}: {
  state: SmokingState;
  onChange: (next: SmokingState) => void;
}) {
  const [limit, setLimit] = useState(String(state.dailyLimit));
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLimit(String(state.dailyLimit));
  }, [state.dailyLimit]);

  async function onSave(event: FormEvent) {
    event.preventDefault();
    const dailyLimit = Number(limit);
    if (!Number.isInteger(dailyLimit) || dailyLimit < 1) {
      setError("1本以上の整数を入力してください");
      return;
    }
    setPending(true);
    setError(null);
    setMessage(null);
    try {
      onChange(await saveDailyLimit({ data: { dailyLimit } }));
      setMessage("上限本数を保存しました");
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存できませんでした");
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="rounded-xl border border-border bg-surface p-5 shadow-card" onSubmit={onSave}>
      <p className="font-display text-lg font-semibold text-fg">1日の上限</p>
      <p className="mt-1 text-sm text-muted">
        24時間ごとの上限本数です。期間が終わると、残りはここで決めた本数に戻ります。
      </p>

      <div className="mt-4 space-y-1.5">
        <Label htmlFor="daily-limit">上限本数</Label>
        <Input
          id="daily-limit"
          type="number"
          inputMode="numeric"
          min={1}
          max={80}
          step={1}
          value={limit}
          onChange={(event) => setLimit(event.target.value)}
          required
        />
      </div>

      <div className="mt-5 rounded-md bg-surface-2 px-4 py-4 text-sm text-muted">
        <p>
          いまの残り {state.remaining} 本 ／ 上限 {state.dailyLimit} 本
        </p>
        <p className="mt-1">次回リセット {formatJaDateTime(state.resetsAt)}</p>
      </div>

      <Button type="submit" className="mt-4 w-full" disabled={pending}>
        上限を保存
      </Button>

      {message ? <p className="mt-3 text-sm text-accent">{message}</p> : null}
      {error ? (
        <p className="mt-3 text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}
    </form>
  );
}
