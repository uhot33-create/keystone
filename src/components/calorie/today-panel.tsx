import { Link } from "@tanstack/react-router";
import { ChartLine, Footprints, Plus, Scale, Stethoscope, Trash2, Utensils } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { flushSync } from "react-dom";
import { addCalorieLog, deleteCalorieLog, deleteCalorieStaple, getCalorieChart, getCalorieDay, getCalorieTrend, saveCalorieStaple, saveWeightLog } from "@/lib/calorie/api";
import { chartWindowStart } from "@/lib/calorie/summary";
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

function historyFloor(today: string): string {
  return shiftIsoDate(today, -5 * 366);
}

function mergeTrends(current: DayTrend[], extra: DayTrend[]): DayTrend[] {
  const byStart = new Map<string, DayTrend>();
  for (const point of current) byStart.set(point.start, point);
  for (const point of extra) byStart.set(point.start, point);
  return [...byStart.values()].sort((a, b) => a.start.localeCompare(b.start));
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

function DateBar({
  date,
  chartOpen,
  locked,
  onShift,
  onToday,
  onChart,
  onBack,
}: {
  date: string;
  chartOpen: boolean;
  locked: boolean;
  onShift: (days: -1 | 1) => void;
  onToday: () => void;
  onChart: () => void;
  onBack?: () => void;
}) {
  const startX = useRef(0);
  return (
    <div>
      <div
        className="flex touch-pan-y items-center gap-1"
        onPointerDown={(event) => {
          startX.current = event.clientX;
        }}
        onPointerUp={(event) => {
          const dx = event.clientX - startX.current;
          if (Math.abs(dx) < 48) return;
          onShift(dx < 0 ? 1 : -1);
        }}
      >
        {onBack ? (
          <button type="button" onClick={onBack} className="w-10 shrink-0 text-left text-xs font-medium text-primary">
            戻る
          </button>
        ) : null}
        <div className="flex min-w-0 flex-1 items-center justify-center gap-0.5">
          <p className="truncate font-display text-base font-semibold text-fg">{formatJaDayWeek(date)}</p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 min-h-8 px-2"
            disabled={date === todayJst()}
            onClick={onToday}
          >
            今日
          </Button>
          {chartOpen ? null : (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8"
              aria-label="グラフを表示"
              onClick={onChart}
            >
              <ChartLine className="size-4" strokeWidth={1.75} />
            </Button>
          )}
        </div>
        {onBack ? <span className="w-10 shrink-0" aria-hidden /> : null}
      </div>
      {locked ? <p className="text-center text-xs text-muted">2週間以上前の記録は閲覧のみです</p> : null}
    </div>
  );
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
  const [chartOpen, setChartOpen] = useState(false);
  const [grain, setGrain] = useState<TrendGrain>("day");
  const [chartEnd, setChartEnd] = useState(todayJst);
  const [stapleOpen, setStapleOpen] = useState(false);
  const [stapleId, setStapleId] = useState<number | null>(null);
  const [stapleFoodId, setStapleFoodId] = useState("");
  const [stapleQty, setStapleQty] = useState("");
  const [view, setView] = useState<"home" | "add" | "weight">("home");
  const [barTip, setBarTip] = useState<"kcal" | "weight" | null>(null);
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
      const next = await action();
      if (!chartOpen) {
        onChange(next);
        return;
      }
      try {
        const chart = await getCalorieChart({ data: { dogId: next.dog.id } });
        onChange({ ...next, trend: chart.trend, trends: chart.trends });
      } catch {
        onChange(next);
        setChartOpen(false);
        setError("グラフを更新できませんでした");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存できませんでした");
    } finally {
      setPending(false);
      setBusy(null);
    }
  }

  useEffect(() => {
    setChartOpen(false);
  }, [state.dog.id]);

  async function openChart() {
    const loaded = state.trends?.day.length || state.trends?.week.length || state.trends?.month.length || state.trends?.year.length;
    if (!loaded) {
      flushSync(() => {
        setPending(true);
        setBusy("読み込み中…");
        setError(null);
      });
    }
    setChartOpen(true);
    if (loaded) return;
    try {
      const chart = await getCalorieChart({ data: { dogId: state.dog.id } });
      onChange({ ...state, trend: chart.trend, trends: chart.trends });
    } catch (err) {
      setChartOpen(false);
      setError(err instanceof Error ? err.message : "グラフを読み込めませんでした");
    } finally {
      setPending(false);
      setBusy(null);
    }
  }

  async function shiftChart(direction: -1 | 1) {
    const today = todayJst();
    const next = shiftChartEnd(grain, chartEnd, direction, today);
    const start = chartWindowStart(grain, next);
    const points = state.trends?.[grain] ?? [];
    const oldest = points.reduce((min, point) => (point.start < min ? point.start : min), points[0]?.start ?? "9999-12-31");
    const willFetch = direction < 0 && !(points.length > 0 && oldest <= start);
    if (willFetch) {
      flushSync(() => {
        setPending(true);
        setBusy("読み込み中…");
        setError(null);
      });
    }
    setChartEnd(next);
    if (!willFetch) return;
    try {
      const more = await getCalorieTrend({ data: { dogId: state.dog.id, grain, end: next } });
      const merged = mergeTrends(points, more);
      onChange({
        ...state,
        trends: { ...state.trends, [grain]: merged },
        trend: grain === "day" ? merged : state.trend,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "読み込みに失敗しました");
    } finally {
      setPending(false);
      setBusy(null);
    }
  }

  async function selectDate(date: string) {
    if (date === state.date) return;
    flushSync(() => {
      setPending(true);
      setBusy("読み込み中…");
      setError(null);
    });
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
    <div className={`flex flex-col ${view === "home" ? "gap-5" : "gap-2"}`}>
      <BusyOverlay show={Boolean(busy)} label={busy ?? "処理中…"} />
      {view !== "home" ? (
        <DateBar
          date={state.date}
          chartOpen={chartOpen}
          locked={locked}
          onShift={(days) => void selectDate(shiftIsoDate(state.date, days))}
          onToday={() => {
            setChartEnd(todayJst());
            void selectDate(todayJst());
          }}
          onChart={() => void openChart()}
          onBack={() => setView("home")}
        />
      ) : null}

      {view === "home" ? (
        <>
          <div className="flex items-stretch justify-center gap-2">
            <div className="relative size-52 shrink-0">
              <div className="absolute inset-0 overflow-hidden rounded-full border border-border bg-surface-2 shadow-card">
                <img src={saburo.src} alt={saburo.label} className="h-full w-full object-cover" />
              </div>
              {(
                [
                  { key: "food", label: "餌", angle: 315, Icon: Utensils, view: "add" as const },
                  { key: "weight", label: "体重", angle: 45, Icon: Scale, view: "weight" as const },
                  { key: "walk", label: "お散歩ログ", angle: 225, Icon: Footprints, to: "/walk/logs" as const },
                  { key: "vet", label: "通院履歴", angle: 135, Icon: Stethoscope, to: "/vet" as const },
                ] as const
              ).map((item) => {
                const upper = item.angle === 315 || item.angle === 45;
                const face = (
                  <>
                    {upper ? <span className="text-[10px] leading-none text-muted">{item.label}</span> : null}
                    <span className="grid size-10 place-items-center rounded-full border border-border bg-surface text-fg shadow-card">
                      <item.Icon className="size-4" strokeWidth={1.75} />
                    </span>
                    {upper ? null : <span className="text-[10px] leading-none text-muted">{item.label}</span>}
                  </>
                );
                const className = "absolute flex flex-col items-center gap-0.5 outline-none focus-visible:ring-2 focus-visible:ring-ring/35";
                const style = {
                  left: "50%",
                  top: "50%",
                  transform: `translate(-50%, -50%) rotate(${item.angle}deg) translateY(-6.5rem) rotate(-${item.angle}deg)`,
                };
                return "to" in item ? (
                  <Link key={item.key} to={item.to} aria-label={item.label} className={className} style={style}>
                    {face}
                  </Link>
                ) : (
                  <button key={item.key} type="button" aria-label={item.label} className={className} style={style} onClick={() => setView(item.view)}>
                    {face}
                  </button>
                );
              })}
            </div>
            <div className="flex h-full shrink-0 flex-col items-center">
            <div className="flex min-h-0 flex-1 items-stretch justify-center gap-3 pr-6">
            <div className="flex h-full flex-col items-center">
              <p className="text-[11px] leading-none text-muted">ごはん</p>
              <p className="mt-1 flex h-4 items-end text-xs font-semibold tabular-nums leading-none text-fg">
                {target > 0 ? formatKcal(target) : "—"}
              </p>
              <button
                type="button"
                className={`relative mt-1 w-8 min-h-16 flex-1 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring/35 ${barTip === "kcal" ? "ring-2 ring-ring/40" : ""}`}
                aria-pressed={barTip === "kcal"}
                aria-label={`ごはん ${formatKcal(mealEaten)} kcal、おやつ ${formatKcal(treatEaten)} kcal、目標 ${target > 0 ? formatKcal(target) : "未設定"} kcal`}
                onClick={() => setBarTip((current) => (current === "kcal" ? null : "kcal"))}
              >
                <span className="absolute inset-0 overflow-hidden rounded-full bg-surface-2">
                  <span className="absolute inset-x-0 bottom-0 bg-primary" style={{ height: `${mealShare}%` }} />
                  <span className="absolute inset-x-0 bg-accent" style={{ bottom: `${mealShare}%`, height: `${treatShare}%` }} />
                </span>
              </button>
              <p className={`mt-1 text-center text-[11px] leading-none ${over ? "text-danger" : "text-muted"}`}>
                {target > 0 ? (over ? `超 ${formatKcal(total - target)}` : `残 ${formatKcal(remaining ?? 0)}`) : "未設定"}
              </p>
            </div>
            <div className="flex h-full flex-col items-center">
              <p className="text-[11px] leading-none text-muted">体重</p>
              <p className={`mt-1 flex h-4 items-end text-xs font-semibold tabular-nums leading-none ${weightOver ? "text-danger" : "text-fg"}`}>
                {latestWeight != null ? (
                  <>
                    {latestWeight.toFixed(2)}
                    <span className="ml-0.5 text-[10px] font-medium">kg</span>
                  </>
                ) : (
                  "—"
                )}
              </p>
              <button
                type="button"
                className={`relative mt-1 w-8 min-h-16 flex-1 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring/35 ${barTip === "weight" ? "ring-2 ring-ring/40" : ""}`}
                aria-pressed={barTip === "weight"}
                aria-label={
                  latestWeight != null
                    ? `最新 ${latestWeight.toFixed(2)} kg、理想 ${idealWeight > 0 ? idealWeight.toFixed(2) : "未設定"} kg`
                    : "体重は未記録"
                }
                onClick={() => setBarTip((current) => (current === "weight" ? null : "weight"))}
              >
                <span className="absolute inset-0 overflow-hidden rounded-full bg-surface-2">
                  <span className="absolute inset-x-0 bottom-0 bg-fg/55" style={{ height: `${weightWithin}%` }} />
                  {weightAbove > 0 ? (
                    <span className="absolute inset-x-0 bg-danger" style={{ bottom: `${idealLine}%`, height: `${weightAbove}%` }} />
                  ) : null}
                </span>
                {idealWeight > 0 ? (
                  <>
                    <span className="absolute -left-0.5 right-0 z-10 h-0.5 bg-fg" style={{ bottom: `${idealLine}%` }} />
                    <span
                      className="pointer-events-none absolute left-full z-10 ml-0.5 -translate-y-1/2 text-[10px] leading-none tabular-nums text-subtle"
                      style={{ bottom: `${idealLine}%` }}
                    >
                      {idealWeight.toFixed(2)}
                    </span>
                  </>
                ) : null}
              </button>
            </div>
            </div>
            <p className="mt-1 w-full max-w-36 min-h-4 text-center text-[11px] leading-snug text-muted">
              {barTip === "kcal"
                ? `ごはん ${formatKcal(mealEaten)}　おやつ ${formatKcal(treatEaten)}`
                : barTip === "weight"
                  ? latestWeight == null
                    ? "体重は未記録"
                    : `最新 ${latestWeight.toFixed(2)} kg${idealWeight > 0 ? `　差 ${(latestWeight - idealWeight).toFixed(2)} kg` : ""}`
                  : "棒をタップすると内訳"}
            </p>
            </div>
          </div>

          <DateBar
            date={state.date}
            chartOpen={chartOpen}
            locked={locked}
            onShift={(days) => void selectDate(shiftIsoDate(state.date, days))}
            onToday={() => {
              setChartEnd(todayJst());
              void selectDate(todayJst());
            }}
            onChart={() => void openChart()}
          />
        </>
      ) : (
        <>

      {view === "weight" ? (
      <form className="rounded-lg border border-border bg-surface px-3 py-2 shadow-card" onSubmit={onSaveWeight}>
        <p className="text-sm font-medium text-fg">体重（20時計測）</p>
        <div className="mt-2 flex items-center gap-2">
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
      <div className="flex flex-col gap-3">
      <form className="rounded-lg border border-border bg-surface p-3 shadow-card" onSubmit={onAdd}>
        <p className="font-display text-base font-semibold text-fg">カロリーを足す</p>

        <div className="mt-2 flex items-center justify-between gap-2">
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
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {state.staples.map((item) => {
            const food = state.foods.find((entry) => entry.id === item.foodId);
            if (!food) return null;
            return (
              <button
                key={item.id}
                type="button"
                disabled={pending || locked}
                className="rounded-full border border-border bg-surface-2 px-2.5 py-1 text-xs font-medium text-fg disabled:opacity-50"
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
          <div className="mt-2 space-y-2">
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
                size="sm"
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
                  size="sm"
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
                    <li key={item.id} className="flex items-center gap-2 py-1">
                      <p className="min-w-0 flex-1 truncate text-xs text-fg">{label}</p>
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
                        className="size-8 text-muted"
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

        <div className="mt-2 grid grid-cols-2 rounded-md bg-surface-2 p-0.5">
          <button
            type="button"
            className={`h-8 rounded-sm text-xs font-medium ${kind === "food" ? "bg-surface text-fg shadow-card" : "text-muted"}`}
            onClick={() => switchKind("food")}
            disabled={locked}
          >
            ごはん
          </button>
          <button
            type="button"
            className={`h-8 rounded-sm text-xs font-medium ${kind === "treat" ? "bg-surface text-fg shadow-card" : "text-muted"}`}
            onClick={() => switchKind("treat")}
            disabled={locked}
          >
            おやつ
          </button>
        </div>

        {foods.length > 0 ? (
          <div className="mt-2 flex gap-1.5 overflow-x-auto">
            {foods.map((food) => {
              const active = food.id === foodId;
              return (
                <button
                  key={food.id}
                  type="button"
                  onClick={() => pickFood(food)}
                  disabled={locked}
                  className={[
                    "shrink-0 rounded-full border px-2.5 py-1 text-xs font-medium",
                    active ? "border-primary bg-primary text-primary-fg" : "border-border bg-surface text-fg",
                  ].join(" ")}
                >
                  {chipText(food)}
                </button>
              );
            })}
          </div>
        ) : (
          <p className="mt-2 text-xs text-muted">
            登録した{kindLabel(kind)}がありません。
            <button type="button" className="ml-1 font-medium text-primary" onClick={onOpenFoods}>
              フードへ
            </button>
          </p>
        )}

        <div className="mt-2 grid grid-cols-[1fr_5.5rem_4.5rem] gap-1.5">
          <Input
            value={name}
            maxLength={40}
            placeholder={kindLabel(kind)}
            aria-label="名前"
            onChange={(event) => setName(event.target.value)}
            disabled={locked}
          />
          <Input
            type="text"
            inputMode="decimal"
            placeholder={`数量(${unit})`}
            aria-label="数量"
            value={qty}
            onChange={(event) => onQty(event.target.value)}
            onFocus={(event) => event.currentTarget.select()}
            disabled={locked}
          />
          <Input
            type="number"
            inputMode="decimal"
            min={0}
            step="any"
            placeholder="kcal"
            aria-label="カロリー"
            value={kcalTouched ? kcalText : computed > 0 ? String(computed) : kcalText}
            onChange={(event) => {
              setKcalTouched(true);
              setKcalText(event.target.value);
            }}
            disabled={locked}
          />
        </div>

        <div className="mt-2 grid grid-cols-4 gap-1.5">
          {QTY_STEPS.map((step) => (
            <button
              key={step}
              type="button"
              className="h-9 rounded-md bg-surface-2 text-sm font-medium text-fg"
              onClick={() => bumpQty(step)}
              disabled={locked}
            >
              +{step}
            </button>
          ))}
          <Button type="submit" size="sm" className="h-9 min-h-9" disabled={pending || locked}>
            <Plus />
            足す
          </Button>
        </div>
      </form>

      <section className="rounded-lg border border-border bg-surface px-3 py-2">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-xs font-medium text-subtle">今日の記録</p>
          {state.logs.length > 0 ? <p className="text-xs tabular-nums text-muted">{state.logs.length}件</p> : null}
        </div>
        {state.logs.length === 0 ? (
          <p className="mt-1 text-xs text-muted">まだ記録がありません</p>
        ) : (
          <ul className="mt-1">
            {state.logs.map((log) => (
              <li key={log.id} className="flex items-center gap-2 border-t border-border py-1 text-xs first:border-t-0">
                <span className="w-10 shrink-0 text-muted">{kindLabel(log.kind)}</span>
                <span className="min-w-0 flex-1 truncate text-fg">{log.label}</span>
                {log.amount != null && log.unit ? (
                  <span className="shrink-0 tabular-nums text-subtle">{formatQuantity(log.amount, log.unit)}</span>
                ) : null}
                <span className="w-12 shrink-0 text-right tabular-nums text-fg">{formatKcal(log.kcal)}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-7 text-muted"
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
      </section>
      </div>
      ) : null}
        </>
      )}

      {view !== "add" ? (
        <section className="rounded-lg border border-border bg-surface px-3 py-2">
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-xs font-medium text-subtle">
              {state.date === todayJst() ? "今日の記録" : formatJaDayWeek(state.date)}
            </p>
            {state.logs.length > 0 ? (
              <p className="text-xs tabular-nums text-muted">{formatKcal(total)} kcal</p>
            ) : null}
          </div>
          {state.logs.length === 0 ? (
            <p className="mt-1 text-xs text-muted">まだ記録がありません</p>
          ) : (
            <ul className="mt-1">
              {state.logs.map((log) => (
                <li key={log.id} className="flex items-baseline gap-2 border-t border-border py-1 text-xs first:border-t-0">
                  <span className="w-10 shrink-0 text-muted">{kindLabel(log.kind)}</span>
                  <span className="min-w-0 flex-1 truncate text-fg">{log.label}</span>
                  {log.amount != null && log.unit ? (
                    <span className="shrink-0 tabular-nums text-subtle">{formatQuantity(log.amount, log.unit)}</span>
                  ) : null}
                  <span className="w-12 shrink-0 text-right tabular-nums text-fg">{formatKcal(log.kcal)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {chartOpen ? (
      <TrendChart
        grain={grain}
        days={windowedTrend(state.trends?.[grain] ?? state.trend ?? [], grain, chartEnd)}
        activeDate={state.date}
        todayDate={todayJst()}
        canOlder={(windowedTrend(state.trends?.[grain] ?? [], grain, chartEnd)[0]?.start ?? todayJst()) > historyFloor(todayJst())}
        canNewer={chartEnd < todayJst()}
        onGrain={setGrain}
        onSelect={(date) => void selectDate(date)}
        onToday={() => {
          setChartEnd(todayJst());
          void selectDate(todayJst());
        }}
        onShift={(direction) => void shiftChart(direction)}
      />
      ) : null}

      {error ? (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
