import { ChevronLeft, ChevronRight, Plus, Trash2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { addCalorieLog, deleteCalorieLog, getCalorieState } from "@/lib/calorie/api";
import {
  dailyEnergy,
  formatJaDate,
  shiftIsoDate,
  weekdayJa,
} from "@/lib/calorie/formula";
import type { CalorieState, DogFood } from "@/lib/calorie/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const QUICK_ADD = [10, 50, 100] as const;

export function TodayPanel({
  state,
  onChange,
  onOpenPlan,
}: {
  state: CalorieState;
  onChange: (next: CalorieState) => void;
  onOpenPlan: () => void;
}) {
  const [kcal, setKcal] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const target = dailyEnergy(state.dog.idealWeightKg, state.dog.lifeStage);
  const total = Math.round(state.logs.reduce((sum, log) => sum + log.kcal, 0));
  const remaining = target > 0 ? target - total : null;
  const ratio = target > 0 ? total / target : 0;
  const over = target > 0 && total > target;
  const ringPct = Math.min(100, Math.max(0, ratio * 100));
  const ringColor = over ? "var(--color-danger)" : "var(--color-primary)";

  async function run(action: () => Promise<CalorieState>) {
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

  function addQuick(amount: number, label: string, kind: "other" | "food" | "treat", foodId: number | null) {
    void run(() =>
      addCalorieLog({
        data: {
          date: state.date,
          label,
          kcal: amount,
          kind,
          foodId,
        },
      }),
    );
  }

  function onCustom(event: FormEvent) {
    event.preventDefault();
    const amount = Number(kcal);
    if (!(amount > 0)) {
      setError("カロリーを入力してください");
      return;
    }
    setKcal("");
    addQuick(amount, "手入力", "other", null);
  }

  function addFood(food: DogFood) {
    addQuick(food.kcal, food.name, food.kind, food.id);
  }

  const maxWeek = Math.max(target, ...state.week.map((day) => day.total), 1);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-2">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="前日"
          onClick={() =>
            void run(() => getCalorieState({ data: { date: shiftIsoDate(state.date, -1) } }))
          }
        >
          <ChevronLeft />
        </Button>
        <div className="text-center">
          <p className="font-display text-lg font-semibold text-fg">{formatJaDate(state.date)}</p>
          <p className="text-xs text-subtle">{weekdayJa(state.date)}曜日</p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="翌日"
          onClick={() =>
            void run(() => getCalorieState({ data: { date: shiftIsoDate(state.date, 1) } }))
          }
        >
          <ChevronRight />
        </Button>
      </div>

      <div className="rounded-xl border border-border bg-surface px-5 py-6 shadow-card">
        <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div
            className="grid size-36 place-items-center rounded-full"
            style={{
              background: `conic-gradient(${ringColor} ${ringPct}%, var(--color-surface-2) 0)`,
            }}
            aria-hidden="true"
          >
            <div className="grid size-28 place-items-center rounded-full bg-surface text-center">
              <p className="font-display text-3xl font-semibold tabular-nums leading-none text-fg">{total}</p>
              <p className="mt-1 text-xs tracking-widest text-subtle">kcal</p>
            </div>
          </div>
          <div className="w-full flex-1 text-center sm:text-left">
            {target > 0 ? (
              <>
                <p className="text-sm text-muted">
                  目標 {target} kcal（{state.dog.name}）
                </p>
                <p className={`mt-1 font-display text-xl font-semibold ${over ? "text-danger" : "text-fg"}`}>
                  {over ? `${total - target} kcal オーバー` : `あと ${remaining} kcal`}
                </p>
              </>
            ) : (
              <>
                <p className="text-sm text-muted">目標カロリーは未設定です</p>
                <button
                  type="button"
                  className="mt-2 text-sm font-medium text-primary underline-offset-4 hover:underline"
                  onClick={onOpenPlan}
                >
                  理想体重から計算する
                </button>
              </>
            )}
          </div>
        </div>

        <div className="mt-6 grid grid-cols-7 gap-1.5">
          {state.week.map((day) => {
            const height = Math.max(8, Math.round((day.total / maxWeek) * 40));
            const active = day.date === state.date;
            return (
              <button
                key={day.date}
                type="button"
                className="flex min-h-11 flex-col items-center gap-1 rounded-sm py-1 text-subtle hover:text-fg"
                onClick={() => void run(() => getCalorieState({ data: { date: day.date } }))}
              >
                <span className="text-xs">{weekdayJa(day.date)}</span>
                <span
                  className={`w-3 rounded-full ${active ? "bg-primary" : "bg-surface-2"}`}
                  style={{ height }}
                />
              </button>
            );
          })}
        </div>
      </div>

      <div className="rounded-xl border border-border bg-surface p-5 shadow-card">
        <p className="font-display text-lg font-semibold text-fg">かんたん加算</p>
        <p className="mt-1 text-sm text-muted">タップするだけで今日のカロリーに足せます。</p>

        <div className="mt-4 grid grid-cols-3 gap-2">
          {QUICK_ADD.map((amount) => (
            <Button
              key={amount}
              type="button"
              variant="outline"
              disabled={pending}
              aria-label={`${amount}kcalを足す`}
              onClick={() => addQuick(amount, `+${amount}`, "other", null)}
            >
              <Plus />
              {amount}
            </Button>
          ))}
        </div>

        <form className="mt-4 flex gap-2" onSubmit={onCustom}>
          <div className="min-w-0 flex-1 space-y-1.5">
            <Label htmlFor="custom-kcal" className="sr-only">
              カロリー
            </Label>
            <Input
              id="custom-kcal"
              inputMode="decimal"
              type="number"
              min={1}
              step={1}
              placeholder="kcal を入力"
              value={kcal}
              onChange={(event) => setKcal(event.target.value)}
            />
          </div>
          <Button type="submit" disabled={pending} className="shrink-0">
            足す
          </Button>
        </form>

        {state.foods.length > 0 ? (
          <div className="mt-5">
            <p className="text-xs font-medium tracking-widest text-subtle">登録した餌・おやつ</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {state.foods.map((food) => (
                <button
                  key={food.id}
                  type="button"
                  disabled={pending}
                  onClick={() => addFood(food)}
                  className="inline-flex min-h-11 items-center gap-2 rounded-md border border-border bg-surface-2 px-3 text-sm text-fg transition-colors hover:bg-border/40 disabled:opacity-50"
                >
                  <span>{food.name}</span>
                  <span className="tabular-nums text-muted">{food.kcal}kcal</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <p className="mt-4 text-sm text-muted">
            餌やおやつを登録すると、ワンタップで加算できます。
            <button
              type="button"
              className="ml-1 font-medium text-primary underline-offset-4 hover:underline"
              onClick={onOpenPlan}
            >
              登録する
            </button>
          </p>
        )}
      </div>

      <div className="rounded-xl border border-border bg-surface p-5 shadow-card">
        <p className="font-display text-lg font-semibold text-fg">今日の足し算</p>
        {state.logs.length === 0 ? (
          <p className="mt-3 text-sm text-muted">まだ記録がありません。</p>
        ) : (
          <ul className="mt-3 divide-y divide-border">
            {state.logs.map((log) => (
              <li key={log.id} className="flex items-center gap-3 py-2.5">
                <span className="min-w-0 flex-1 truncate text-sm text-fg">{log.label}</span>
                <span className="tabular-nums text-sm text-fg">+{log.kcal}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-10 min-h-10 text-muted"
                  aria-label={`${log.label}を削除`}
                  disabled={pending}
                  onClick={() =>
                    void run(() => deleteCalorieLog({ data: { date: state.date, id: log.id } }))
                  }
                >
                  <Trash2 />
                </Button>
              </li>
            ))}
            <li className="flex items-center justify-between pt-3">
              <span className="text-sm font-medium text-muted">合計</span>
              <span className="font-display text-lg font-semibold tabular-nums text-fg">{total} kcal</span>
            </li>
          </ul>
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
