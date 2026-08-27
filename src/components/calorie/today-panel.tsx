import { ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import { addCalorieLog, deleteCalorieLog, getCalorieState } from "@/lib/calorie/api";
import {
  dailyEnergy,
  formatJaDate,
  formatQuantity,
  kcalForQuantity,
  shiftIsoDate,
  weekdayJa,
} from "@/lib/calorie/formula";
import type { CalorieState } from "@/lib/calorie/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

export function TodayPanel({
  state,
  onChange,
  onOpenPlan,
}: {
  state: CalorieState;
  onChange: (next: CalorieState) => void;
  onOpenPlan: () => void;
}) {
  const [foodId, setFoodId] = useState("");
  const [foodQty, setFoodQty] = useState("");
  const [customName, setCustomName] = useState("");
  const [customKcal, setCustomKcal] = useState("");
  const [customQty, setCustomQty] = useState("1");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const target = dailyEnergy(state.dog.idealWeightKg, state.dog.lifeStage);
  const total = Math.round(state.logs.reduce((sum, log) => sum + log.kcal, 0));
  const remaining = target > 0 ? target - total : null;
  const ratio = target > 0 ? total / target : 0;
  const over = target > 0 && total > target;
  const ringPct = Math.min(100, Math.max(0, ratio * 100));
  const ringColor = over ? "var(--color-danger)" : "var(--color-primary)";

  const selected = useMemo(
    () => state.foods.find((item) => String(item.id) === foodId) ?? null,
    [state.foods, foodId],
  );
  const registeredKcal = selected
    ? kcalForQuantity(selected.kcal, selected.amount, Number(foodQty))
    : 0;
  const customTotal = kcalForQuantity(Number(customKcal), 1, Number(customQty));

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

  function addLog(label: string, kcal: number, kind: "other" | "food" | "treat", foodId: number | null) {
    void run(() =>
      addCalorieLog({
        data: {
          date: state.date,
          label,
          kcal,
          kind,
          foodId,
        },
      }),
    );
  }

  function onRegistered(event: FormEvent) {
    event.preventDefault();
    if (!selected) {
      setError("フードを選んでください");
      return;
    }
    if (!(registeredKcal > 0)) {
      setError("数量を入力してください");
      return;
    }
    const qty = Number(foodQty);
    setFoodQty("");
    addLog(`${selected.name} ${formatQuantity(qty, selected.unit)}`, registeredKcal, selected.kind, selected.id);
  }

  function onCustom(event: FormEvent) {
    event.preventDefault();
    const name = customName.trim();
    if (!name) {
      setError("名称を入力してください");
      return;
    }
    if (!(customTotal > 0)) {
      setError("カロリーと数量を入力してください");
      return;
    }
    const qty = Number(customQty);
    setCustomName("");
    setCustomKcal("");
    setCustomQty("1");
    addLog(`${name} ×${Number.isInteger(qty) ? qty : qty.toFixed(1)}`, customTotal, "other", null);
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
        <p className="font-display text-lg font-semibold text-fg">今日に足す</p>
        <p className="mt-1 text-sm text-muted">登録したフードを選ぶか、未登録のものを入力します。</p>

        <form className="mt-5 space-y-3" onSubmit={onRegistered}>
          <p className="text-xs font-medium tracking-widest text-subtle">登録したフード</p>
          <div className="space-y-1.5">
            <Label htmlFor="log-food">フード</Label>
            <Select
              id="log-food"
              value={foodId}
              onChange={(event) => {
                const next = event.target.value;
                setFoodId(next);
                const food = state.foods.find((item) => String(item.id) === next);
                setFoodQty(food ? String(food.amount) : "");
              }}
            >
              <option value="">未選択</option>
              {state.foods.map((food) => (
                <option key={food.id} value={String(food.id)}>
                  {food.name}（{food.kcal}kcal / {formatQuantity(food.amount, food.unit)}）
                </option>
              ))}
            </Select>
          </div>
          <div className="grid grid-cols-[1fr_auto] items-end gap-2">
            <div className="space-y-1.5">
              <Label htmlFor="log-food-qty">数量{selected ? `（${selected.unit}）` : ""}</Label>
              <Input
                id="log-food-qty"
                type="number"
                inputMode="decimal"
                min={0.1}
                step="any"
                placeholder={selected ? selected.unit : "数量"}
                value={foodQty}
                onChange={(event) => setFoodQty(event.target.value)}
                disabled={!selected}
              />
            </div>
            <Button type="submit" disabled={pending || !selected} className="shrink-0">
              足す
            </Button>
          </div>
          {selected && registeredKcal > 0 ? (
            <p className="text-sm text-muted">加算 {registeredKcal} kcal</p>
          ) : state.foods.length === 0 ? (
            <p className="text-sm text-muted">
              フードが未登録です。
              <button
                type="button"
                className="ml-1 font-medium text-primary underline-offset-4 hover:underline"
                onClick={onOpenPlan}
              >
                登録する
              </button>
            </p>
          ) : null}
        </form>

        <form className="mt-6 space-y-3 border-t border-border pt-5" onSubmit={onCustom}>
          <p className="text-xs font-medium tracking-widest text-subtle">未登録のフード</p>
          <div className="space-y-1.5">
            <Label htmlFor="log-custom-name">名称</Label>
            <Input
              id="log-custom-name"
              value={customName}
              maxLength={40}
              placeholder="例 チーズ"
              onChange={(event) => setCustomName(event.target.value)}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="log-custom-kcal">カロリー（1あたり）</Label>
              <Input
                id="log-custom-kcal"
                type="number"
                inputMode="decimal"
                min={0.1}
                step="any"
                placeholder="kcal"
                value={customKcal}
                onChange={(event) => setCustomKcal(event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="log-custom-qty">数量</Label>
              <Input
                id="log-custom-qty"
                type="number"
                inputMode="decimal"
                min={0.1}
                step="any"
                placeholder="数量"
                value={customQty}
                onChange={(event) => setCustomQty(event.target.value)}
              />
            </div>
          </div>
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-muted">{customTotal > 0 ? `加算 ${customTotal} kcal` : "1あたり × 数量"}</p>
            <Button type="submit" disabled={pending}>
              足す
            </Button>
          </div>
        </form>
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
