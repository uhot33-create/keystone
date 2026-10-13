/**
 * 暮らし帳のカードメニューの下に出す日付行とグラフ。
 * スワイプで前日・翌日。「今日」で今日へ。グラフアイコンで推移を開く。
 */
import { useState } from "react";
import { flushSync } from "react-dom";
import { DateBar } from "@/components/calorie/date-bar";
import { TrendChart } from "@/components/calorie/trend-chart";
import { BusyOverlay } from "@/components/ui/busy-overlay";
import { getCalorieChart, getCalorieDay, getCalorieTrend } from "@/lib/calorie/api";
import { isCalorieLocked, shiftIsoDate, todayJst } from "@/lib/calorie/formula";
import { chartWindowStart } from "@/lib/calorie/summary";
import type { CalorieState, DayTrend, TrendGrain } from "@/lib/calorie/types";

const CHART_WINDOW: Record<TrendGrain, number> = { day: 7, week: 12, month: 12, year: 5 };

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

export function HomeCalorieDate({
  state,
  onChange,
}: {
  state: CalorieState;
  onChange: (next: CalorieState) => void;
}) {
  const [chartOpen, setChartOpen] = useState(false);
  const [grain, setGrain] = useState<TrendGrain>("day");
  const [chartEnd, setChartEnd] = useState(todayJst);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function selectDate(date: string) {
    if (date === state.date) return;
    flushSync(() => {
      setBusy("読み込み中…");
      setError(null);
    });
    try {
      const next = await getCalorieDay({ data: { date, dogId: state.dog.id } });
      onChange({
        ...state,
        date: next.date,
        logs: next.logs,
        medicines: next.medicines,
        medicineAddedOn: next.medicineAddedOn,
        todayWeightKg: next.todayWeightKg,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "読み込みに失敗しました");
    } finally {
      setBusy(null);
    }
  }

  async function openChart() {
    const loaded = state.trends?.day.length || state.trends?.week.length || state.trends?.month.length || state.trends?.year.length;
    if (!loaded) {
      flushSync(() => {
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
      setBusy(null);
    }
  }

  async function shiftChart(direction: -1 | 1) {
    const today = todayJst();
    const nextEnd = shiftChartEnd(grain, chartEnd, direction, today);
    const start = chartWindowStart(grain, nextEnd);
    const points = state.trends?.[grain] ?? [];
    const oldest = points.reduce((min, point) => (point.start < min ? point.start : min), points[0]?.start ?? "9999-12-31");
    const willFetch = direction < 0 && !(points.length > 0 && oldest <= start);
    if (willFetch) {
      flushSync(() => {
        setBusy("読み込み中…");
        setError(null);
      });
    }
    setChartEnd(nextEnd);
    if (!willFetch) return;
    try {
      const more = await getCalorieTrend({ data: { dogId: state.dog.id, grain, end: nextEnd } });
      const merged = mergeTrends(points, more);
      onChange({
        ...state,
        trends: { ...state.trends, [grain]: merged },
        trend: grain === "day" ? merged : state.trend,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "読み込みに失敗しました");
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <BusyOverlay show={Boolean(busy)} label={busy ?? "読み込み中…"} />
      <DateBar
        date={state.date}
        chartOpen={chartOpen}
        locked={isCalorieLocked(state.date)}
        onShift={(days) => void selectDate(shiftIsoDate(state.date, days))}
        onToday={() => {
          setChartEnd(todayJst());
          void selectDate(todayJst());
        }}
        onChart={() => void openChart()}
      />
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
    </>
  );
}
