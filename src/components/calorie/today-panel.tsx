import { ChevronLeft, ChevronRight, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { addCalorieLog, deleteCalorieLog, getCalorieDay, saveWeightLog } from "@/lib/calorie/api";
import {
  formatJaDayWeek,
  formatKcal,
  formatQuantity,
  kcalForQuantity,
  shiftIsoDate,
  splitMealsAndTreats,
  dailyEnergy,
  todayJst,
  trimNum,
  truncKcal,
  isCalorieLocked,
} from "@/lib/calorie/formula";
import type { CalorieState, DayTrend, DogFood, FoodKind, TrendGrain } from "@/lib/calorie/types";
import { TrendChart } from "@/components/calorie/trend-chart";
import { BusyOverlay } from "@/components/ui/busy-overlay";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const QTY_STEPS = [15, 2, 4] as const;
const STAPLES = [
  { name: "NOWフレッシュ", qty: 15 },
  { name: "ささみジャーキー", qty: 2 },
  { name: "ささみジャーキー", qty: 4 },
] as const;
const CHART_WINDOW: Record<TrendGrain, number> = { day: 14, week: 12, month: 12, year: 5 };

function windowedTrend(points: DayTrend[], grain: TrendGrain, viewEnd: string): DayTrend[] {
  return points.filter((point) => point.start <= viewEnd).slice(-CHART_WINDOW[grain]);
}

function shiftChartEnd(grain: TrendGrain, viewEnd: string, direction: -1 | 1, today: string): string {
  let next = viewEnd;
  if (grain === "day") next = shiftIsoDate(viewEnd, direction * 14);
  else if (grain === "week") next = shiftIsoDate(viewEnd, direction * 84);
  else if (grain === "month") {
    const [year, month] = viewEnd.split("-").map(Number);
    next = new Date(Date.UTC(year, month - 1 + direction * 12, 1)).toISOString().slice(0, 10);
  } else {
    next = `${Number(viewEnd.slice(0, 4)) + direction * 5}-12-31`;
  }
  if (next > today) return today;
  return next;
}

function chipText(food: DogFood): string {
  if (food.unit === "g") return `${food.name} ${trimNum(food.kcal)}/${trimNum(food.amount)}g`;
  return `${food.name} ${trimNum(food.kcal)}`;
}

function kindLabel(kind: string): string {
  return kind === "treat" ? "おやつ" : "ごはん";
}

export function TodayPanel({
  state,
  onChange,
  onOpenPlan,
  onOpenFoods,
}: {
  state: CalorieState;
  onChange: (next: CalorieState) => void;
  onOpenPlan: () => void;
  onOpenFoods: () => void;
}) {
  const [kind, setKind] = useState<FoodKind>("food");
  const [foodId, setFoodId] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [qty, setQty] = useState("");
  const [kcalText, setKcalText] = useState("");
  const [kcalTouched, setKcalTouched] = useState(false);
  const [weightText, setWeightText] = useState(
    state.todayWeightKg != null ? state.todayWeightKg.toFixed(2) : "",
  );
  const [pending, setPending] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [grain, setGrain] = useState<TrendGrain>("day");
  const [chartEnd, setChartEnd] = useState(todayJst);

  useEffect(() => {
    setWeightText(state.todayWeightKg != null ? state.todayWeightKg.toFixed(2) : "");
  }, [state.date, state.todayWeightKg]);

  const target = dailyEnergy(state.dog.idealWeightKg, state.dog.lifeStage);
  const { mealKcal, treatKcal } = splitMealsAndTreats(target, state.dog.treatRatio);
  const mealEaten = truncKcal(
    state.logs.filter((log) => log.kind !== "treat").reduce((sum, log) => sum + log.kcal, 0),
  );
  const treatEaten = truncKcal(
    state.logs.filter((log) => log.kind === "treat").reduce((sum, log) => sum + log.kcal, 0),
  );
  const total = mealEaten + treatEaten;
  const remaining = target > 0 ? target - total : null;
  const over = target > 0 && total > target;
  const ringPct = target > 0 ? Math.min(100, Math.max(0, (total / target) * 100)) : 0;
  const ringColor = over ? "var(--color-danger)" : "var(--color-primary)";
  const treatPct = Math.round(state.dog.treatRatio * 100);

  const foods = useMemo(
    () => state.foods.filter((item) => item.kind === kind),
    [state.foods, kind],
  );
  const selected = foods.find((item) => item.id === foodId) ?? null;
  const unit = selected?.unit ?? (kind === "treat" ? "個" : "g");
  const qtyNum = Number(qty);

  const computed = selected && qtyNum > 0 ? kcalForQuantity(selected.kcal, selected.amount, qtyNum) : 0;
  const shownKcal = kcalTouched ? Number(kcalText) : computed;
  const addKcal = truncKcal(shownKcal > 0 ? shownKcal : 0);

  function pickFood(food: DogFood) {
    setFoodId(food.id);
    setName(food.name);
    setKcalTouched(false);
    setKcalText(qtyNum > 0 ? String(kcalForQuantity(food.kcal, food.amount, qtyNum)) : "");
  }

  function onQty(next: string) {
    setQty(next);
    const n = Number(next);
    if (selected && n > 0 && !kcalTouched) {
      setKcalText(String(kcalForQuantity(selected.kcal, selected.amount, n)));
    }
  }

  function bumpQty(step: number) {
    const next = Math.max(0, (Number(qty) || 0) + step);
    onQty(String(next));
  }

  function switchKind(next: FoodKind) {
    setKind(next);
    setFoodId(null);
    setName("");
    setQty("");
    setKcalText("");
    setKcalTouched(false);
  }

  async function run(action: () => Promise<CalorieState>, label = "保存中…") {
    setPending(true);
    setBusy(label);
    setError(null);
    try {
      onChange(await action());
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存できませんでした");
    } finally {
      setPending(false);
      setBusy(null);
    }
  }

  async function selectDate(date: string) {
    if (date === state.date) return;
    setPending(true);
    setBusy("読み込み中…");
    setError(null);
    try {
      const next = await getCalorieDay({ data: { date } });
      onChange({
        ...state,
        date: next.date,
        logs: next.logs,
        todayWeightKg: next.todayWeightKg,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "読み込みに失敗しました");
    } finally {
      setPending(false);
      setBusy(null);
    }
  }

  function onAdd(event: FormEvent) {
    event.preventDefault();
    if (locked) {
      setError("2週間以上前の記録は変更できません");
      return;
    }
    const kcal = addKcal > 0 ? addKcal : kcalTouched ? Number(kcalText) : selected && qtyNum > 0
      ? kcalForQuantity(selected.kcal, selected.amount, qtyNum)
      : Number(kcalText);
    if (!(kcal > 0)) {
      setError("カロリーか数量を入力してください");
      return;
    }
    const label = name.trim() || kindLabel(kind);
    const amount = qtyNum > 0 ? qtyNum : null;
    void run(() =>
      addCalorieLog({
        data: {
          date: state.date,
          label,
          kcal: truncKcal(kcal),
          kind,
          foodId: selected?.id ?? null,
          amount,
          unit: amount ? unit : null,
        },
      }),
    ).then(() => {
      setQty("");
      setKcalText("");
      setKcalTouched(false);
    });
  }

  function onSaveWeight(event: FormEvent) {
    event.preventDefault();
    if (locked) {
      setError("2週間以上前の記録は変更できません");
      return;
    }
    const weightKg = Math.round(Number(weightText) * 100) / 100;
    if (!(weightKg > 0)) {
      setError("体重を入力してください");
      return;
    }
    void run(() => saveWeightLog({ data: { date: state.date, weightKg } }));
  }

  const locked = isCalorieLocked(state.date);

  return (
    <div className="flex flex-col gap-5">
      <BusyOverlay show={Boolean(busy)} label={busy ?? "処理中…"} />
      <div className="flex flex-col items-center gap-1">
      <div className="flex w-full items-center justify-between gap-2">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="前日"
          onClick={() => void selectDate(shiftIsoDate(state.date, -1))}
        >
          <ChevronLeft />
        </Button>
        <p className="font-display text-lg font-semibold text-fg">{formatJaDayWeek(state.date)}</p>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="翌日"
          onClick={() => void selectDate(shiftIsoDate(state.date, 1))}
        >
          <ChevronRight />
        </Button>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={state.date === todayJst()}
        onClick={() => {
          setChartEnd(todayJst());
          void selectDate(todayJst());
        }}
      >
        今日
      </Button>
      {locked ? (
        <p className="text-xs text-muted">2週間以上前の記録は閲覧のみです</p>
      ) : null}
      </div>

      <div className="flex flex-col items-center">
        <div
          className="grid size-52 place-items-center rounded-full"
          style={{
            background: `conic-gradient(${ringColor} ${ringPct}%, var(--color-border) 0)`,
          }}
          aria-hidden="true"
        >
          <div className="grid size-[9.5rem] place-items-center rounded-full bg-bg text-center">
            <p className="font-display text-5xl font-semibold tabular-nums leading-none text-fg">{formatKcal(total)}</p>
            <p className="mt-2 text-sm text-muted">/ {target || "—"} kcal</p>
            <p className={`mt-1 text-sm ${over ? "text-danger" : "text-muted"}`}>
              {target > 0
                ? over
                  ? `${formatKcal(total - target)} kcal オーバー`
                  : `あと ${formatKcal(remaining ?? 0)} kcal`
                : "目標未設定"}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-border bg-surface px-4 py-4 shadow-card">
          <p className="text-xs text-muted">ごはん</p>
          <p className="mt-1 font-display text-2xl font-semibold tabular-nums text-fg">{formatKcal(mealEaten)} kcal</p>
          <p className="mt-1 text-xs text-subtle">目標 {mealKcal || "—"}</p>
        </div>
        <div className="rounded-xl border border-border bg-surface px-4 py-4 shadow-card">
          <p className="text-xs text-muted">おやつ</p>
          <p className="mt-1 font-display text-2xl font-semibold tabular-nums text-fg">{formatKcal(treatEaten)} kcal</p>
          <p className="mt-1 text-xs text-subtle">上限 {treatPct}%</p>
        </div>
      </div>

      <form className="rounded-xl border border-border bg-surface p-4 shadow-card" onSubmit={onSaveWeight}>
        <p className="font-display text-lg font-semibold text-fg">体重（20時計測）</p>
        <p className="mt-1 text-sm text-muted">毎日20時に測り、1日1回記録します。同じ日は上書きされます。</p>
        <div className="mt-3 flex items-center gap-2">
          <Input
            type="number"
            inputMode="decimal"
            min={0.01}
            max={120}
            step={0.01}
            placeholder="0.00"
            value={weightText}
            onChange={(event) => setWeightText(event.target.value)}
            aria-label="体重キログラム"
            disabled={locked}
          />
          <span className="w-8 shrink-0 text-sm text-muted">kg</span>
          <Button type="submit" className="shrink-0" disabled={pending || locked}>
            {state.todayWeightKg != null ? "修正" : "記録"}
          </Button>
        </div>
        {state.todayWeightKg != null ? (
          <p className="mt-2 text-xs text-subtle">この日 {state.todayWeightKg.toFixed(2)} kg（20時計測）</p>
        ) : (
          <p className="mt-2 text-xs text-subtle">まだ記録がありません</p>
        )}
      </form>

      {STAPLES.length > 0 ? (
        <div className="rounded-xl border border-border bg-surface p-4 shadow-card">
          <p className="font-display text-lg font-semibold text-fg">定番</p>
          <p className="mt-1 text-sm text-muted">ワンタップで足します。フードに同じ名前で登録してください。</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {STAPLES.map((item) => {
              const food = state.foods.find((entry) => entry.name === item.name);
              return (
                <button
                  key={`${item.name}-${item.qty}`}
                  type="button"
                  disabled={pending || locked || !food}
                  className="rounded-full border border-border bg-surface-2 px-3 py-2 text-xs font-medium text-fg disabled:opacity-50"
                  onClick={() => {
                    if (!food) return;
                    const kcal = kcalForQuantity(food.kcal, food.amount, item.qty);
                    if (!(kcal > 0)) return;
                    void run(() =>
                      addCalorieLog({
                        data: {
                          date: state.date,
                          label: food.name,
                          kcal: truncKcal(kcal),
                          kind: food.kind,
                          foodId: food.id,
                          amount: item.qty,
                          unit: food.unit,
                        },
                      }),
                    );
                  }}
                >
                  + {item.name} {item.qty}g
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      <form className="rounded-xl border border-border bg-surface p-4 shadow-card" onSubmit={onAdd}>
        <div className="flex items-center justify-between gap-2">
          <p className="font-display text-lg font-semibold text-fg">カロリーを足す</p>
          <p className="text-xs text-muted">名前は省略できます</p>
        </div>

        <div className="mt-3 grid grid-cols-2 rounded-md bg-surface-2 p-1">
          <button
            type="button"
            className={`h-11 rounded-sm text-sm font-medium ${kind === "food" ? "bg-surface text-fg shadow-card" : "text-muted"}`}
            onClick={() => switchKind("food")}
            disabled={locked}
          >
            ごはん
          </button>
          <button
            type="button"
            className={`h-11 rounded-sm text-sm font-medium ${kind === "treat" ? "bg-surface text-fg shadow-card" : "text-muted"}`}
            onClick={() => switchKind("treat")}
            disabled={locked}
          >
            おやつ
          </button>
        </div>

        {foods.length > 0 ? (
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {foods.map((food) => {
              const active = food.id === foodId;
              return (
                <button
                  key={food.id}
                  type="button"
                  onClick={() => pickFood(food)}
                  disabled={locked}
                  className={[
                    "shrink-0 rounded-full border px-3 py-2 text-xs font-medium",
                    active ? "border-primary bg-primary text-primary-fg" : "border-border bg-surface text-fg",
                  ].join(" ")}
                >
                  {chipText(food)}
                </button>
              );
            })}
          </div>
        ) : (
          <p className="mt-3 text-sm text-muted">
            登録した{kindLabel(kind)}がありません。
            <button type="button" className="ml-1 font-medium text-primary underline-offset-4 hover:underline" onClick={onOpenFoods}>
              フードへ
            </button>
          </p>
        )}

        <div className="mt-3 grid grid-cols-[1fr_7rem] gap-2">
          <Input
            value={name}
            maxLength={40}
            placeholder={kindLabel(kind)}
            onChange={(event) => setName(event.target.value)}
            disabled={locked}
          />
          <Input
            type="number"
            inputMode="decimal"
            min={0}
            step="any"
            placeholder="kcal"
            value={kcalTouched ? kcalText : computed > 0 ? String(computed) : kcalText}
            onChange={(event) => {
              setKcalTouched(true);
              setKcalText(event.target.value);
            }}
            disabled={locked}
          />
        </div>

        <div className="mt-2 flex items-center gap-2">
          <Input
            type="text"
            inputMode="decimal"
            min={0}
            step="any"
            placeholder="数量"
            value={qty}
            onChange={(event) => onQty(event.target.value)}
            onFocus={(event) => event.currentTarget.select()}
            disabled={locked}
          />
          <span className="w-8 shrink-0 text-sm text-muted">{unit}</span>
        </div>

        <div className="mt-2 grid grid-cols-3 gap-2">
          {QTY_STEPS.map((step) => (
            <button
              key={step}
              type="button"
              className="h-11 rounded-md bg-surface-2 text-sm font-medium text-fg"
              onClick={() => bumpQty(step)}
              disabled={locked}
            >
              +{step}
            </button>
          ))}
        </div>

        <Button type="submit" className="mt-3 w-full" disabled={pending || locked}>
          <Plus />
          足す
        </Button>
      </form>

      <div>
        <div className="flex items-end justify-between">
          <p className="font-display text-lg font-semibold text-fg">今日の記録</p>
          <p className="text-xs text-muted">{state.logs.length}件</p>
        </div>
        {state.logs.length === 0 ? (
          <p className="mt-3 text-sm text-muted">まだ記録がありません。</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {state.logs.map((log) => (
              <li
                key={log.id}
                className="flex items-center gap-3 rounded-xl border border-border bg-surface px-3 py-3 shadow-card"
              >
                <span className="rounded-full bg-surface-2 px-2 py-1 text-[11px] font-medium text-muted">
                  {kindLabel(log.kind)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-fg">{log.label}</p>
                  {log.amount && log.unit ? (
                    <p className="text-xs text-subtle">{formatQuantity(log.amount, log.unit)}</p>
                  ) : null}
                </div>
                <span className="tabular-nums text-sm text-fg">{formatKcal(log.kcal)} kcal</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-10 min-h-10 text-muted"
                  aria-label={`${log.label}を削除`}
                  disabled={pending || locked}
                  onClick={() => void run(() => deleteCalorieLog({ data: { date: state.date, id: log.id } }))}
                >
                  <Trash2 />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <TrendChart
        grain={grain}
        days={windowedTrend(state.trends?.[grain] ?? state.trend ?? [], grain, chartEnd)}
        activeDate={state.date}
        todayDate={todayJst()}
        targetKcal={target}
        canOlder={windowedTrend(state.trends?.[grain] ?? [], grain, chartEnd)[0] !== (state.trends?.[grain] ?? [])[0]}
        canNewer={chartEnd < todayJst()}
        onGrain={setGrain}
        onSelect={(date) => void selectDate(date)}
        onToday={() => {
          setChartEnd(todayJst());
          void selectDate(todayJst());
        }}
        onShift={(direction) => setChartEnd((prev) => shiftChartEnd(grain, prev, direction, todayJst()))}
      />

      <p className="text-center text-xs text-subtle">
        目標カロリーは
        <button type="button" className="mx-1 font-medium text-primary underline-offset-4 hover:underline" onClick={onOpenPlan}>
          プラン
        </button>
        で計算しています
      </p>

      {error ? (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
