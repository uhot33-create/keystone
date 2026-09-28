import { ChevronLeft, ChevronRight, Plus, Scale, Trash2, Utensils } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { addCalorieLog, deleteCalorieLog, deleteCalorieStaple, getCalorieDay, saveCalorieStaple, saveWeightLog } from "@/lib/calorie/api";
import {
  formatJaDayWeek,
  formatKcal,
  formatQuantity,
  kcalForQuantity,
  shiftIsoDate,
  dailyEnergy,
  todayJst,
  trimNum,
  truncKcal,
  isCalorieLocked,
} from "@/lib/calorie/formula";
import { calorieSaburoStage } from "@/lib/calorie/saburo";
import type { CalorieState, DayTrend, DogFood, FoodKind, TrendGrain } from "@/lib/calorie/types";
import { TrendChart } from "@/components/calorie/trend-chart";
import { BusyOverlay } from "@/components/ui/busy-overlay";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

const QTY_STEPS = [15, 2, 4] as const;
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
  onOpenFoods,
}: {
  state: CalorieState;
  onChange: (next: CalorieState) => void;
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
  const [stapleOpen, setStapleOpen] = useState(false);
  const [stapleId, setStapleId] = useState<number | null>(null);
  const [stapleFoodId, setStapleFoodId] = useState("");
  const [stapleQty, setStapleQty] = useState("");
  const [view, setView] = useState<"home" | "add" | "weight">("home");
  const skipScroll = useRef(true);

  useEffect(() => {
    if (skipScroll.current) {
      skipScroll.current = false;
      return;
    }
    window.scrollTo(0, 0);
  }, [view]);

  useEffect(() => {
    setWeightText(state.todayWeightKg != null ? state.todayWeightKg.toFixed(2) : "");
  }, [state.date, state.todayWeightKg]);

  const target = dailyEnergy(state.dog.idealWeightKg, state.dog.lifeStage);
  const mealEaten = truncKcal(
    state.logs.filter((log) => log.kind !== "treat").reduce((sum, log) => sum + log.kcal, 0),
  );
  const treatEaten = truncKcal(
    state.logs.filter((log) => log.kind === "treat").reduce((sum, log) => sum + log.kcal, 0),
  );
  const total = mealEaten + treatEaten;
  const remaining = target > 0 ? target - total : null;
  const over = target > 0 && total > target;
  const barScale = target > 0 ? Math.max(target, total) : Math.max(total, 1);
  const mealShare = (mealEaten / barScale) * 100;
  const treatShare = (treatEaten / barScale) * 100;
  const treatRatioPct = total > 0 ? Math.round((treatEaten / total) * 100) : 0;
  const latestWeight = (() => {
    const days = state.trends?.day ?? state.trend ?? [];
    for (let index = days.length - 1; index >= 0; index -= 1) {
      const weight = days[index]?.weightKg;
      if (weight != null && weight > 0) return weight;
    }
    if (state.dog.currentWeightKg > 0) return state.dog.currentWeightKg;
    return state.todayWeightKg != null && state.todayWeightKg > 0 ? state.todayWeightKg : null;
  })();
  const idealWeight = state.dog.idealWeightKg > 0 ? state.dog.idealWeightKg : 0;
  const weightMax = Math.max(latestWeight ?? 0, idealWeight, 0.01);
  const weightBar = latestWeight != null ? (latestWeight / weightMax) * 100 : 0;
  const idealLine = idealWeight > 0 ? (idealWeight / weightMax) * 100 : 0;
  const weightOver = latestWeight != null && idealWeight > 0 && latestWeight > idealWeight;
  const weightWithin = latestWeight == null ? 0 : idealWeight > 0 ? Math.min(weightBar, idealLine) : weightBar;
  const weightAbove = weightOver ? Math.max(weightBar - idealLine, 0) : 0;
  const saburo = calorieSaburoStage(total, target);

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
      const next = await getCalorieDay({ data: { date, dogId: state.dog.id } });
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
          dogId: state.dog.id,
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
    void run(() => saveWeightLog({ data: { date: state.date, dogId: state.dog.id, weightKg } }));
  }

  const locked = isCalorieLocked(state.date);

  return (
    <div className="flex flex-col gap-5">
      <BusyOverlay show={Boolean(busy)} label={busy ?? "処理中…"} />
      {view !== "home" ? (
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
      ) : null}

      {view === "home" ? (
        <>
          <div className="flex items-center gap-3">
            <div className="flex shrink-0 flex-col gap-2">
              {(
                [
                  { id: "add", label: "餌箱", Icon: Utensils },
                  { id: "weight", label: "体重計", Icon: Scale },
                ] as const
              ).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  aria-label={item.label}
                  onClick={() => setView(item.id)}
                  className="grid size-12 place-items-center rounded-xl border border-border bg-surface shadow-card outline-none focus-visible:ring-2 focus-visible:ring-ring/35"
                >
                  <span className="grid size-9 place-items-center rounded-full bg-surface-2 text-fg">
                    <item.Icon className="size-4" strokeWidth={1.75} />
                  </span>
                </button>
              ))}
            </div>
            <div className="size-36 shrink-0 overflow-hidden rounded-full border border-border bg-surface-2 shadow-card sm:size-44">
              <img src={saburo.src} alt={saburo.label} className="h-full w-full object-cover" />
            </div>
            <div className="flex min-w-0 flex-1 items-start justify-center gap-3">
            <div className="flex flex-col items-center">
              <p className="text-sm font-semibold tabular-nums text-accent">{treatRatioPct}%</p>
              <div
                className="relative mt-1 h-28 w-8 overflow-hidden rounded-full bg-surface-2"
                role="img"
                aria-label={`ごはん ${formatKcal(mealEaten)} kcal、おやつ ${formatKcal(treatEaten)} kcal、割合 ${treatRatioPct}%`}
              >
                <div className="absolute inset-x-0 bottom-0 bg-primary" style={{ height: `${mealShare}%` }} />
                <div className="absolute inset-x-0 bg-accent" style={{ bottom: `${mealShare}%`, height: `${treatShare}%` }} />
              </div>
              <p className={`mt-1 text-center text-[11px] leading-tight ${over ? "text-danger" : "text-muted"}`}>
                {target > 0
                  ? over
                    ? `${formatKcal(total - target)} kcal オーバー`
                    : `あと ${formatKcal(remaining ?? 0)} kcal`
                  : "目標未設定"}
              </p>
              <p className="text-center text-[11px] leading-tight text-subtle">目標 {target > 0 ? `${formatKcal(target)} kcal` : "—"}</p>
            </div>
            <div className="flex flex-col items-center">
              <p className={`text-sm font-semibold tabular-nums leading-none ${weightOver ? "text-danger" : "text-fg"}`}>
                {latestWeight != null ? (
                  <>
                    {latestWeight.toFixed(2)}
                    <span className="ml-0.5 text-[10px] font-medium">kg</span>
                  </>
                ) : (
                  "—"
                )}
              </p>
              <div
                className="relative mt-1 h-28 w-10"
                role="img"
                aria-label={
                  latestWeight != null
                    ? `最新 ${latestWeight.toFixed(2)} kg、理想 ${idealWeight > 0 ? idealWeight.toFixed(2) : "未設定"} kg`
                    : "体重は未記録"
                }
              >
                <div className="absolute inset-x-1 bottom-0 top-0 overflow-hidden rounded-full bg-surface-2">
                  <div className="absolute inset-x-0 bottom-0 bg-fg/55" style={{ height: `${weightWithin}%` }} />
                  {weightAbove > 0 ? (
                    <div className="absolute inset-x-0 bg-danger" style={{ bottom: `${idealLine}%`, height: `${weightAbove}%` }} />
                  ) : null}
                </div>
                {idealWeight > 0 ? (
                  <div className="absolute -left-0.5 -right-0.5 z-10 h-0.5 bg-fg" style={{ bottom: `${idealLine}%` }} />
                ) : null}
              </div>
              <p className="mt-1 text-center text-[11px] leading-tight text-subtle">
                理想 {idealWeight > 0 ? `${idealWeight.toFixed(2)} kg` : "—"}
              </p>
            </div>
            </div>
          </div>

          <div className="flex flex-col items-center gap-1">
            <div className="flex w-full items-center justify-between gap-1">
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
          </div>
          {locked ? <p className="text-center text-xs text-muted">2週間以上前の記録は閲覧のみです</p> : null}
        </>
      ) : (
        <>
          <button
            type="button"
            onClick={() => setView("home")}
            className="inline-flex min-h-11 items-center gap-1 self-start text-sm font-medium text-primary"
          >
            <ChevronLeft className="size-4" strokeWidth={1.75} />
            戻る
          </button>

      {view === "weight" ? (
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
      ) : null}

      {view === "add" ? (
      <>
      <form className="rounded-xl border border-border bg-surface p-4 shadow-card" onSubmit={onAdd}>
        <div className="flex items-center justify-between gap-2">
          <p className="font-display text-lg font-semibold text-fg">カロリーを足す</p>
          <p className="text-xs text-muted">名前は省略できます</p>
        </div>

        <div className="mt-3 flex items-center justify-between gap-2">
          <p className="text-xs font-medium text-subtle">定番</p>
          <button
            type="button"
            className="text-xs font-medium text-primary"
            disabled={locked}
            onClick={() => {
              setStapleOpen((open) => !open);
              setStapleId(null);
              setStapleFoodId("");
              setStapleQty("");
            }}
          >
            {stapleOpen ? "閉じる" : "管理"}
          </button>
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          {state.staples.map((item) => {
            const food = state.foods.find((entry) => entry.id === item.foodId);
            if (!food) return null;
            return (
              <button
                key={item.id}
                type="button"
                disabled={pending || locked}
                className="rounded-full border border-border bg-surface-2 px-3 py-2 text-xs font-medium text-fg disabled:opacity-50"
                onClick={() => {
                  const kcal = kcalForQuantity(food.kcal, food.amount, item.qty);
                  if (!(kcal > 0)) return;
                  void run(() =>
                    addCalorieLog({
                      data: {
                        date: state.date,
                        dogId: state.dog.id,
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
                + {food.name} {formatQuantity(item.qty, food.unit)}
              </button>
            );
          })}
          {state.staples.length === 0 ? <p className="text-xs text-muted">まだありません。管理から追加できます。</p> : null}
        </div>
        {stapleOpen ? (
          <div className="mt-3 space-y-3">
            <div className="grid grid-cols-[1fr_5.5rem] gap-2">
              <Select
                aria-label="定番のフード"
                value={stapleFoodId}
                disabled={locked || state.foods.length === 0}
                onChange={(event) => setStapleFoodId(event.target.value)}
              >
                <option value="">フードを選択</option>
                {state.foods.map((food) => (
                  <option key={food.id} value={food.id}>
                    {food.name}
                  </option>
                ))}
              </Select>
              <Input
                type="number"
                inputMode="decimal"
                min={0.1}
                step="any"
                placeholder="数量"
                aria-label="定番の数量"
                value={stapleQty}
                disabled={locked}
                onChange={(event) => setStapleQty(event.target.value)}
                onFocus={(event) => event.currentTarget.select()}
              />
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                className="flex-1"
                disabled={pending || locked || !stapleFoodId || !(Number(stapleQty) > 0)}
                onClick={() =>
                  void run(async () => {
                    const next = await saveCalorieStaple({
                      data: {
                        date: state.date,
                        dogId: state.dog.id,
                        id: stapleId ?? undefined,
                        foodId: Number(stapleFoodId),
                        qty: Number(stapleQty),
                      },
                    });
                    setStapleId(null);
                    setStapleFoodId("");
                    setStapleQty("");
                    return next;
                  })
                }
              >
                {stapleId ? "更新" : "登録"}
              </Button>
              {stapleId ? (
                <Button
                  type="button"
                  variant="outline"
                  disabled={pending}
                  onClick={() => {
                    setStapleId(null);
                    setStapleFoodId("");
                    setStapleQty("");
                  }}
                >
                  取消
                </Button>
              ) : null}
            </div>
            {state.foods.length === 0 ? <p className="text-xs text-muted">先にフードを登録してください。</p> : null}
            {state.staples.length > 0 ? (
              <ul className="divide-y divide-border">
                {state.staples.map((item) => {
                  const food = state.foods.find((entry) => entry.id === item.foodId);
                  const label = food ? `${food.name} ${formatQuantity(item.qty, food.unit)}` : "フードがありません";
                  return (
                    <li key={item.id} className="flex items-center gap-2 py-2">
                      <p className="min-w-0 flex-1 truncate text-sm text-fg">{label}</p>
                      <button
                        type="button"
                        className="shrink-0 text-xs font-medium text-primary"
                        disabled={pending || locked || !food}
                        onClick={() => {
                          setStapleId(item.id);
                          setStapleFoodId(String(item.foodId));
                          setStapleQty(String(item.qty));
                        }}
                      >
                        編集
                      </button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-9 min-h-9 text-muted"
                        aria-label={`${label}を削除`}
                        disabled={pending || locked}
                        onClick={() =>
                          void run(() => deleteCalorieStaple({ data: { date: state.date, dogId: state.dog.id, id: item.id } }))
                        }
                      >
                        <Trash2 />
                      </Button>
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </div>
        ) : null}

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
                  onClick={() => void run(() => deleteCalorieLog({ data: { date: state.date, dogId: state.dog.id, id: log.id } }))}
                >
                  <Trash2 />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
      </>
      ) : null}
        </>
      )}

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

      {error ? (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
