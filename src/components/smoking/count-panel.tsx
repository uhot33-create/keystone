import { useEffect, useState, type FormEvent } from "react";
import { getSmokingState, setRemaining, smokeOne } from "@/lib/smoking/api";
import { formatCountdown, formatJaDateTime } from "@/lib/smoking/period";
import type { SmokingState } from "@/lib/smoking/types";
import { Button } from "@/components/ui/button";
import { BusyOverlay } from "@/components/ui/busy-overlay";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function CountPanel({
  state,
  onChange,
}: {
  state: SmokingState;
  onChange: (next: SmokingState) => void;
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
    <div className="flex flex-col gap-3">
      <BusyOverlay show={pending} label="処理中…" />
      <div className="rounded-xl border border-border bg-surface px-4 py-4 shadow-card">
        <div className="flex items-center gap-4">
          <div
            className="grid size-24 shrink-0 place-items-center rounded-full"
            style={{
              background: `conic-gradient(var(--color-primary) ${ringPct}%, var(--color-surface-2) 0)`,
            }}
            aria-hidden="true"
          >
            <div className="grid size-[4.75rem] place-items-center rounded-full bg-surface text-center">
              <p className="font-display text-3xl font-semibold tabular-nums leading-none text-fg">
                {state.remaining}
              </p>
              <p className="mt-1 text-[10px] tracking-widest text-subtle">残り</p>
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted">上限 {state.dailyLimit} 本 / 1日</p>
            <p className={`mt-0.5 font-display text-lg font-semibold ${empty ? "text-danger" : "text-fg"}`}>
              {empty ? "残りはありません" : `あと ${state.remaining} 本`}
            </p>
            <p className="mt-1 text-xs text-muted">
              {formatJaDateTime(state.resetsAt)}
              <span className="ml-1 text-subtle">（{formatCountdown(untilReset)}）</span>
            </p>
          </div>
        </div>

        <Button
          type="button"
          size="lg"
          className="mt-4 w-full"
          variant={empty ? "outline" : "default"}
          disabled={pending}
          onClick={() => void run(() => smokeOne())}
        >
          {empty ? "限度を超えて吸った" : "1本 減らす"}
        </Button>
        {empty ? (
          <p className="mt-2 text-xs text-muted">
            {state.exceeded
              ? "今日は限度を超えています。ナイスは付きません。"
              : "これ以上吸うと、今日のナイスは付きません。"}
          </p>
        ) : null}

        <div className="mt-4 flex items-start justify-between gap-3 border-t border-border pt-3">
          <div className="min-w-0">
            <p className="text-xs text-muted">前回吸った日時</p>
            <p className="mt-0.5 text-sm text-fg">
              {state.lastSmokedAt ? formatJaDateTime(state.lastSmokedAt) : "まだ減算していません"}
            </p>
          </div>
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

        {editing ? (
          <form className="mt-3 space-y-2" onSubmit={onSaveEdit}>
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
        ) : null}
      </div>

      {error ? (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
