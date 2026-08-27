import { useEffect, useState, type FormEvent } from "react";
import { getSmokingState, setRemaining, smokeOne } from "@/lib/smoking/api";
import { formatCountdown, formatJaDateTime } from "@/lib/smoking/period";
import type { SmokingState } from "@/lib/smoking/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function CountPanel({
  state,
  onChange,
  onOpenMaster,
}: {
  state: SmokingState;
  onChange: (next: SmokingState) => void;
  onOpenMaster: () => void;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(state.remaining));
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    setDraft(String(state.remaining));
    setEditing(false);
  }, [state.remaining, state.periodStartedAt]);

  useEffect(() => {
    const id = window.setInterval(() => {
      const stamp = Date.now();
      setNow(stamp);
      if (stamp >= Date.parse(state.resetsAt)) {
        void getSmokingState().then(onChange).catch(() => undefined);
      }
    }, 1000);
    return () => window.clearInterval(id);
  }, [onChange, state.resetsAt]);

  async function run(action: () => Promise<SmokingState>) {
    setPending(true);
    setError(null);
    try {
      onChange(await action());
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存できませんでした");
    } finally {
      setPending(false);
    }
  }

  function onSaveEdit(event: FormEvent) {
    event.preventDefault();
    const value = Number(draft);
    if (!Number.isInteger(value) || value < 0) {
      setError("本数を整数で入力してください");
      return;
    }
    void run(() => setRemaining({ data: { remaining: value } })).then(() => setEditing(false));
  }

  const ratio = state.dailyLimit > 0 ? state.remaining / state.dailyLimit : 0;
  const ringPct = Math.min(100, Math.max(0, ratio * 100));
  const empty = state.remaining <= 0;
  const untilReset = Date.parse(state.resetsAt) - now;

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-xl border border-border bg-surface px-5 py-6 shadow-card">
        <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div
            className="grid size-36 place-items-center rounded-full"
            style={{
              background: `conic-gradient(var(--color-primary) ${ringPct}%, var(--color-surface-2) 0)`,
            }}
            aria-hidden="true"
          >
            <div className="grid size-28 place-items-center rounded-full bg-surface text-center">
              <p className="font-display text-3xl font-semibold tabular-nums leading-none text-fg">
                {state.remaining}
              </p>
              <p className="mt-1 text-xs tracking-widest text-subtle">残り</p>
            </div>
          </div>
          <div className="w-full flex-1 text-center sm:text-left">
            <p className="text-sm text-muted">上限 {state.dailyLimit} 本 / 1日</p>
            <p className={`mt-1 font-display text-xl font-semibold ${empty ? "text-danger" : "text-fg"}`}>
              {empty ? "残りはありません" : `あと ${state.remaining} 本`}
            </p>
            <p className="mt-2 text-sm text-muted">
              {formatJaDateTime(state.resetsAt)} にリセット
              <span className="ml-1 text-subtle">（{formatCountdown(untilReset)}）</span>
            </p>
            <button
              type="button"
              className="mt-2 text-sm font-medium text-primary underline-offset-4 hover:underline"
              onClick={onOpenMaster}
            >
              上限を変更する
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-surface p-5 shadow-card">
        <p className="font-display text-lg font-semibold text-fg">減算</p>
        <p className="mt-1 text-sm text-muted">吸ったらボタンを押すと、残り本数が1本減ります。</p>
        <Button
          type="button"
          size="lg"
          className="mt-4 w-full"
          disabled={pending || empty}
          onClick={() => void run(() => smokeOne())}
        >
          1本 減らす
        </Button>
        {empty ? (
          <p className="mt-3 text-sm text-muted">リセットまで待つ、または修正で本数を戻せます。</p>
        ) : null}
      </div>

      <div className="rounded-xl border border-border bg-surface p-5 shadow-card">
        <div>
          <div className="flex items-center justify-between gap-3">
            <p className="font-display text-lg font-semibold text-fg">前回吸った日時</p>
            {!editing ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={pending}
                onClick={() => {
                  setDraft(String(state.remaining));
                  setEditing(true);
                  setError(null);
                }}
              >
                修正
              </Button>
            ) : null}
          </div>
          <p className="mt-2 text-fg">
            {state.lastSmokedAt ? formatJaDateTime(state.lastSmokedAt) : "まだ減算していません"}
          </p>
        </div>

        {editing ? (
          <form className="mt-4 space-y-3" onSubmit={onSaveEdit}>
            <div className="space-y-1.5">
              <Label htmlFor="remaining-edit">残り本数</Label>
              <Input
                id="remaining-edit"
                type="number"
                inputMode="numeric"
                min={0}
                max={state.dailyLimit}
                step={1}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={pending} className="flex-1">
                保存
              </Button>
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                disabled={pending}
                onClick={() => {
                  setEditing(false);
                  setDraft(String(state.remaining));
                }}
              >
                キャンセル
              </Button>
            </div>
          </form>
        ) : (
          <p className="mt-3 text-sm text-muted">打ち間違いや押し忘れは、修正から本数を直接変えられます。</p>
        )}
      </div>

      {error ? (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
