import { ChevronLeft, ChevronRight, Plus, Trash2 } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import { addCalorieLog, deleteCalorieLog, getCalorieState } from "@/lib/calorie/api";
import {
  dayNum,
  formatJaDayWeek,
  formatQuantity,
  kcalForQuantity,
  shiftIsoDate,
  splitMealsAndTreats,
  dailyEnergy,
  trimNum,
} from "@/lib/calorie/formula";
import type { CalorieState, DogFood, FoodKind } from "@/lib/calorie/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const QTY_STEPS = [10, 25, 50, 100] as const;

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
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const target = dailyEnergy(state.dog.idealWeightKg, state.dog.lifeStage);
  const { mealKcal, treatKcal } = splitMealsAndTreats(target, state.dog.treatRatio);
  const mealEaten = Math.round(
    state.logs.filter((log) => log.kind !== "treat").reduce((sum, log) => sum + log.kcal, 0),
  );
  const treatEaten = Math.round(
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
  const addKcal = Math.round((shownKcal > 0 ? shownKcal : 0) * 10) / 10;

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

  function onAdd(event: FormEvent) {
    event.preventDefault();
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
          kcal: Math.round(kcal),
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

  const maxWeek = Math.max(target, ...state.week.map((day) => day.total), 1);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-2">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="前日"
          onClick={() => void run(() => getCalorieState({ data: { date: shiftIsoDate(state.date, -1) } }))}
        >
          <ChevronLeft />
        </Button>
        <p className="font-display text-lg font-semibold text-fg">{formatJaDayWeek(state.date)}</p>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="翌日"
          onClick={() => void run(() => getCalorieState({ data: { date: shiftIsoDate(state.date, 1) } }))}
        >
          <ChevronRight />
        </Button>
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
            <p className="font-display text-5xl font-semibold tabular-nums leading-none text-fg">{total}</p>
            <p className="mt-2 text-sm text-muted">/ {target || "—"} kcal</p>
            <p className={`mt-1 text-sm ${over ? "text-danger" : "text-muted"}`}>
              {target > 0 ? (over ? `${total - target} kcal オーバー` : `あと ${remaining} kcal`) : "目標未設定"}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-border bg-surface px-4 py-4 shadow-card">
          <p className="text-xs text-muted">ごはん</p>
          <p className="mt-1 font-display text-2xl font-semibold tabular-nums text-fg">{mealEaten} kcal</p>
          <p className="mt-1 text-xs text-subtle">目標 {mealKcal || "—"}</p>
        </div>
        <div className="rounded-xl border border-border bg-surface px-4 py-4 shadow-card">
          <p className="text-xs text-muted">おやつ</p>
          <p className="mt-1 font-display text-2xl font-semibold tabular-nums text-fg">{treatEaten} kcal</p>
          <p className="mt-1 text-xs text-subtle">上限 {treatPct}%</p>
        </div>
      </div>

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
          >
            ごはん
          </button>
          <button
            type="button"
            className={`h-11 rounded-sm text-sm font-medium ${kind === "treat" ? "bg-surface text-fg shadow-card" : "text-muted"}`}
            onClick={() => switchKind("treat")}
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
          />
        </div>

        <div className="mt-2 flex items-center gap-2">
          <Input
            type="number"
            inputMode="decimal"
            min={0}
            step="any"
            placeholder="数量"
            value={qty}
            onChange={(event) => onQty(event.target.value)}
          />
          <span className="w-8 shrink-0 text-sm text-muted">{unit}</span>
        </div>

        <div className="mt-2 grid grid-cols-4 gap-2">
          {QTY_STEPS.map((step) => (
            <button
              key={step}
              type="button"
              className="h-11 rounded-md bg-surface-2 text-sm font-medium text-fg"
              onClick={() => bumpQty(step)}
            >
              +{step}
            </button>
          ))}
        </div>

        <Button type="submit" className="mt-3 w-full" disabled={pending}>
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
                <span className="tabular-nums text-sm text-fg">{Math.round(log.kcal)} kcal</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-10 min-h-10 text-muted"
                  aria-label={`${log.label}を削除`}
                  disabled={pending}
                  onClick={() => void run(() => deleteCalorieLog({ data: { date: state.date, id: log.id } }))}
                >
                  <Trash2 />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-xl border border-border bg-surface p-4 shadow-card">
        <p className="font-display text-lg font-semibold text-fg">直近7日</p>
        <div className="mt-4 flex h-36 items-end justify-between gap-1.5">
          {state.week.map((day) => {
            const height = Math.max(6, Math.round((day.total / maxWeek) * 112));
            const active = day.date === state.date;
            const dayOver = target > 0 && day.total > target;
            return (
              <button
                key={day.date}
                type="button"
                className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-2"
                onClick={() => void run(() => getCalorieState({ data: { date: day.date } }))}
              >
                <span
                  className={[
                    "w-full max-w-8 rounded-md",
                    dayOver ? "bg-danger/80" : "bg-primary",
                    active ? "outline outline-2 outline-offset-2 outline-primary" : "",
                  ].join(" ")}
                  style={{ height }}
                />
                <span className={`text-xs ${active ? "font-medium text-fg" : "text-subtle"}`}>{dayNum(day.date)}</span>
              </button>
            );
          })}
        </div>
        <p className="mt-3 text-center text-xs text-subtle">棒をタップするとその日の記録を開けます</p>
      </div>

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
