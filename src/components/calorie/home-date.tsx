/**
 * 暮らし帳のカードメニューの下に出す日付行とグラフ。
 * スワイプで前日・翌日。「今日」で今日へ。グラフアイコンで推移を開く。
 * 犬を替えるとグラフは閉じる。もう一度ボタンを押したとき、その犬のグラフを取る。
 * 日付の中身は getCalorieDay、初回のグラフは getCalorieChart、過去ページは getCalorieTrend。
 * おくすり案内から /calorie へ飛ぶときだけ sessionStorage の calorie-open-view に meds を書く。
 * 1画面の件数は CHART_WINDOW、ページの送り幅は shiftChartEnd、それより前へ行かない床は historyFloor。
 */
import { useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { flushSync } from "react-dom";
import { DateBar } from "@/components/calorie/date-bar";
import { MenuDayNotes } from "@/components/calorie/menu-day-notes";
import { TrendChart } from "@/components/calorie/trend-chart";
import { BusyOverlay } from "@/components/ui/busy-overlay";
import { getCalorieChart, getCalorieDay, getCalorieTrend } from "@/lib/calorie/api";
import { isCalorieLocked, shiftIsoDate, todayJst } from "@/lib/calorie/formula";
import { chartWindowStart } from "@/lib/calorie/summary";
import type { CalorieState, DayTrend, TrendGrain } from "@/lib/calorie/types";

/** グラフ1画面の件数。日7・週12・月12・年5。today-panel の CHART_WINDOW と summary.ts の WINDOW と同じにしてください。 */
const CHART_WINDOW: Record<TrendGrain, number> = { day: 7, week: 12, month: 12, year: 5 };

/**
 * viewEnd 以前の点だけ残し、末尾から CHART_WINDOW 件に切る。
 * 入力は集計済みの DayTrend。件数を変えるなら上の定数。
 */
function windowedTrend(points: DayTrend[], grain: TrendGrain, viewEnd: string): DayTrend[] {
  return points.filter((point) => point.start <= viewEnd).slice(-CHART_WINDOW[grain]);
}

/**
 * これより古い期間へは送らない床。今日から約5年（5×366日）。
 * 年数を変えるならこの -5。today-panel の historyFloor も同じ式です。
 */
function historyFloor(today: string): string {
  return shiftIsoDate(today, -5 * 366);
}

/**
 * いま持っている点と、追加で取った点を start で上書きマージして日付順にする。
 * 同じ start は extra が勝つ。並びを変えるならここの sort。
 */
function mergeTrends(current: DayTrend[], extra: DayTrend[]): DayTrend[] {
  const byStart = new Map<string, DayTrend>();
  for (const point of current) byStart.set(point.start, point);
  for (const point of extra) byStart.set(point.start, point);
  return [...byStart.values()].sort((a, b) => a.start.localeCompare(b.start));
}

/**
 * グラフを1ページ送ったあとの終端日。日は14日、週は84日、月は12ヶ月、年は5年。
 * 今日より未来には進めない。送り幅を変えるならこの関数。表示件数は CHART_WINDOW。
 */
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

/**
 * 暮らし帳の日付行と、犬の日だけ出す記録・グラフ。
 * dogDay が false（人のメニュー）のときはグラフも MenuDayNotes も出さない。
 * 日付の取り直しは selectDate、グラフの初回は openChart、ページ送りは shiftChart。
 */
export function HomeCalorieDate({
  state,
  onChange,
  dogDay = true,
}: {
  state: CalorieState;
  onChange: (next: CalorieState) => void;
  /** 人のメニューのときは、今日の記録とグラフを出さない。 */
  dogDay?: boolean;
}) {
  const [chartOpen, setChartOpen] = useState(false);
  const [chartDogId, setChartDogId] = useState(state.dog.id);
  const [grain, setGrain] = useState<TrendGrain>("day");
  const [chartEnd, setChartEnd] = useState(todayJst);
  const [notesPending, setNotesPending] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const dayRequest = useRef(0);

  // 犬が変わったら、前の犬のグラフを開いたままにしない。終端も今日に戻す。
  if (chartDogId !== state.dog.id) {
    setChartDogId(state.dog.id);
    setChartOpen(false);
    setChartEnd(todayJst());
  }
  // 人のメニューに移ったらグラフは閉じる。
  if (!dogDay && chartOpen) setChartOpen(false);

  /**
   * その日の記録・薬・体重だけ getCalorieDay で取り直す。犬やフード一覧は今の state のまま。
   * 連打しても最後の要求だけ反映する。待つあいだ logs と体重を空にして、前の日の数字を残さない。
   */
  async function selectDate(date: string) {
    if (date === state.date) return;
    const request = dayRequest.current + 1;
    dayRequest.current = request;
    setNotesPending(true);
    setError(null);
    onChange({ ...state, date, logs: [], todayWeightKg: null });
    try {
      const next = await getCalorieDay({ data: { date, dogId: state.dog.id } });
      if (dayRequest.current !== request) return;
      onChange({
        ...state,
        date: next.date,
        logs: next.logs,
        medicines: next.medicines,
        medicineAddedOn: next.medicineAddedOn,
        todayWeightKg: next.todayWeightKg,
      });
    } catch (err) {
      if (dayRequest.current !== request) return;
      setError(err instanceof Error ? err.message : "読み込みに失敗しました");
    } finally {
      if (dayRequest.current === request) setNotesPending(false);
    }
  }

  /**
   * グラフを開く。日・週・月・年のどれかがあれば取り直さない。無ければ getCalorieChart を一度だけ取る。
   * 失敗したら開いたフラグを戻す。既にあるときの再取得を足すなら、loaded の判定。
   */
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

  /**
   * 1ページ送る。過去へ進むとき、窓の開始日より古い点が無いときだけ getCalorieTrend で足す。
   * 未来方向は通信しない。日次の追加分だけ trend にも書き、週・月・年は trends だけ更新する。
   */
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
        showChart={dogDay}
      />
      {dogDay ? (
      <MenuDayNotes
        state={state}
        pending={notesPending}
        onOpenMeds={() => {
          try {
            // 暮らし帳に onView が無いので、今日画面が一度だけ読むキーでおくすりを開く。
            sessionStorage.setItem("calorie-open-view", "meds");
          } catch {
            /* 保存できなくても画面は開く */
          }
          void navigate({ to: "/calorie" });
        }}
      />
      ) : null}
      {dogDay && chartOpen ? (
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
