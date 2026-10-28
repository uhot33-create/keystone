/**
 * 今日タブの推移グラフ（SVG）です。TodayPanel がグラフを開いたときだけ出します。
 * 線は期間のカロリー合計、点線は目安（guideKcal）、赤点は期末の体重、茶色の棒は散歩です。
 * 色は primary / accent / #c23b32（体重）/ #6b5344（散歩）です。
 * 触りやすいところ: 幅320・高さ184、kcalの刻み（日は100、それ以外500）、
 * 散歩の上限刻み（日1km・年20km・それ以外5km）。
 * グラフの上を左右に滑らすと期間が移る。判定は48px。左右端の矢印は印で、押せない。
 * 動かせない方向の矢印は薄い。日付の文字をタップすると onSelect。
 * ボタンの「日／週／月／年」は types.ts の TREND_GRAINS。見出しは grainTitle です。
 */
import { useRef, useState, type PointerEvent } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { formatKcal } from "@/lib/calorie/formula";
import { TREND_GRAINS, type DayTrend, type TrendGrain } from "@/lib/calorie/types";
import { Button } from "@/components/ui/button";

/**
 * 軸の最大値を step の倍数に切り上げます。step を変えると、縦軸の上限の丸めが変わります。
 * 今日タブの推移グラフ。kcal の線と散歩の棒で別の step を渡す。
 * 日は kcal 100・散歩 1km、それ以外は呼び出し側。0 以下は step そのもの。
 */
function niceMax(value: number, step: number): number {
  if (!(value > 0)) return step;
  return Math.ceil(value / step) * step;
}

/**
 * グラフの見出しです。「推移（7日）」などを変えると、タイトルの文字だけ変わります。
 * 日次は直近7日（WINDOW.day）。週・月・年は粒度の名前だけ。
 * 件数の数字を変えるなら summary.ts の WINDOW と CHART_WINDOW。文言だけならここ。
 */
function grainTitle(grain: TrendGrain): string {
  if (grain === "week") return "推移（週）";
  if (grain === "month") return "推移（月）";
  if (grain === "year") return "推移（年）";
  return "推移（7日）";
}

/**
 * 横軸の文字です。月表示は年が変わるところだけ「年/月」、それ以外は期間の label をそのまま出します。
 * グラフの日付タップは onSelect（その期間の最終日）。日次ラベルの形は describePeriod。
 * 月の年表示を常に出すならここの if。週の間引きは showEvery。
 */
function axisTick(grain: TrendGrain, day: DayTrend, prev: DayTrend | undefined): string {
  if (grain === "month") {
    const month = String(Number(day.start.slice(5, 7)));
    const year = day.start.slice(0, 4);
    if (!prev || prev.start.slice(0, 4) !== year) return `${year.slice(2)}/${month}`;
    return month;
  }
  return day.label;
}

/**
 * 渡された days を1枚のグラフに描きます。横軸の日付をタップすると onSelect（その期間の最終日）です。
 * 点やおさんぽの棒は押しません。押した日付の数値は見出しの右に出します。
 * 期間の移動はグラフの上を左右に滑らす。右が過去、左が未来。canOlder / canNewer が false の方向には動きません。
 * kcal の刻みは日が100・それ以外500、散歩は日1km・年20km・それ以外5km。ここの数字が縦軸の粗さです。
 */
export function TrendChart({
  grain,
  days,
  activeDate,
  todayDate,
  canOlder = true,
  canNewer = true,
  onGrain,
  onSelect,
  onToday,
  onShift,
}: {
  grain: TrendGrain;
  days: DayTrend[];
  activeDate: string;
  todayDate: string;
  canOlder?: boolean;
  canNewer?: boolean;
  onGrain: (grain: TrendGrain) => void;
  onSelect: (date: string) => void;
  onToday: () => void;
  onShift: (direction: -1 | 1) => void;
}) {
  const width = 320;
  const height = 196;
  const pad = { top: 22, right: 40, bottom: 36, left: 40 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;

  const guides = days.map((day) => day.guideKcal ?? 0);
  // 縦軸の粗さ。kcal は日 100・それ以外 500。散歩は日 1km・年 20km・それ以外 5km。
  const maxKcal = niceMax(
    Math.max(...days.map((day) => day.kcal), ...guides, 1),
    grain === "day" ? 100 : 500,
  );
  const weights = days.map((day) => day.weightKg).filter((value): value is number => value != null && value > 0);
  const walks = days.map((day) => day.walkKm ?? 0);
  const maxWalk = niceMax(Math.max(...walks, 0), grain === "day" ? 1 : grain === "year" ? 20 : 5);
  const minW = weights.length ? Math.min(...weights) : 0;
  const maxW = weights.length ? Math.max(...weights) : 1;
  // 体重は実測の幅が 0.4kg 未満でもそれだけは広げ、上下に 2 割の余白を取る。
  const span = Math.max(0.4, maxW - minW);
  const weightMin = Math.max(0, minW - span * 0.2);
  const weightMax = maxW + span * 0.2;
  const isToday = activeDate === todayDate;
  // 週だけ横軸ラベルを 1 つおき。末日は描画側で必ず出す。
  const showEvery = grain === "day" ? 1 : grain === "week" ? 2 : 1;

  /**
 * 点の横位置。1点だけのときは中央。点の数を変えても左端と右端は pad の内側。
 * 線（kcal）・赤点（体重）・茶色の棒（散歩）が同じ x を使う。
 * 余白を変えるなら上の pad。点数は呼び出し側の CHART_WINDOW。
 */
  function x(index: number) {
    if (days.length <= 1) return pad.left + innerW / 2;
    return pad.left + (index / (days.length - 1)) * innerW;
  }
  /**
 * 左軸。0 が下、maxKcal が上。実線が期間のカロリー合計。
 * 刻みを変えるなら上の niceMax の step（日は 100、それ以外 500）。
 * 点線の目安も同じ軸。guideKcal が無い点は線が途切れる。
 */
  function yKcal(value: number) {
    return pad.top + innerH - (value / maxKcal) * innerH;
  }
  /**
 * 右軸。weightMin から weightMax まで。赤の系列は期末の体重（平均ではない）。
 * 体重が無い日は点を打たない。日次はその日、週・月・年は期間内の最終計測。
 * 余白の 2 割と最小幅 0.4kg は上の span。色は #c23b32。
 */
  function yWeight(value: number) {
    return pad.top + innerH - ((value - weightMin) / (weightMax - weightMin || 1)) * innerH;
  }
  /**
 * 散歩の棒。上 12px は数値用に空け、kcal の線と完全には重ねない。room を変えると棒の頭が上下する。
 * 茶色の棒は期間の散歩距離。色は #6b5344。0 は棒もラベルも出さない。
 * 上限の刻みは niceMax（日 1km、年 20km、それ以外 5km）。km 化は attachWalks。
 */
  function yWalk(value: number) {
    const room = 12;
    return pad.top + room + (innerH - room) - (value / (maxWalk || 1)) * (innerH - room);
  }
  /**
 * 10km 未満は小数1桁、以上は四捨五入。0 は空文字で棒もラベルも出さない。
 * グラフ上の散歩距離の数字だけ。保存単位は walk_logs のメートル。
 * 桁を変えるならここの toFixed。棒の有無は yWalk の手前。
 */
  function walkLabel(km: number) {
    if (!(km > 0)) return "";
    return km < 10 ? km.toFixed(1) : String(Math.round(km));
  }

  const kcalLine = days.map((day, index) => `${x(index).toFixed(1)},${yKcal(day.kcal).toFixed(1)}`).join(" ");
  const guideLine = guides.some((value) => value > 0)
    ? guides.map((value, index) => `${x(index).toFixed(1)},${yKcal(value).toFixed(1)}`).join(" ")
    : "";
  const guideIndex = guides.reduce((found, value, index) => (value > 0 ? index : found), -1);
  const guideValue = guideIndex >= 0 ? guides[guideIndex]! : 0;
  const weightPts = days
    .map((day, index) => (day.weightKg != null ? { index, kg: day.weightKg } : null))
    .filter((item): item is { index: number; kg: number } => item != null);
  const weightLine = weightPts.map((item) => `${x(item.index).toFixed(1)},${yWeight(item.kg).toFixed(1)}`).join(" ");
  const slot = days.length > 0 ? innerW / days.length : innerW;
  const barW = Math.max(3, Math.min(12, slot * 0.46));
  const baseline = pad.top + innerH;
  const latest = days[days.length - 1];
  const [picked, setPicked] = useState<string | null>(null);
  const shown = days.find((day) => day.date === picked) ?? days.find((day) => day.date === activeDate) ?? latest;
  const startX = useRef<number | null>(null);
  const swiped = useRef(false);

  /**
 * スライド開始位置。48px 未満は日付タップのままにする。
 * 左右の矢印は印だけでボタンではない。期間が動くのはこのスライド。
 * 閾値を変えるなら onPointerUp の 48 と、日付バー（date-bar）の 48 を揃える。
 */
  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    startX.current = event.clientX;
    swiped.current = false;
  }
  /**
   * 48px 以上の横スライド。右（dx>0）が過去、左が未来。足りない方向は canOlder / canNewer で止める。
   * 動いたあとの click は swiped で捨て、日付タップと誤爆しない。
   */
  function onPointerUp(event: PointerEvent<HTMLDivElement>) {
    if (startX.current == null) return;
    const dx = event.clientX - startX.current;
    startX.current = null;
    if (Math.abs(dx) < 48) return;
    swiped.current = true;
    if (dx > 0 && canOlder) onShift(-1);
    else if (dx < 0 && canNewer) onShift(1);
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-4 shadow-card">
      <div className="flex items-center justify-between gap-2">
        <p className="font-display text-lg font-semibold text-fg">{grainTitle(grain)}</p>
        <Button type="button" variant="ghost" size="sm" className="shrink-0" onClick={onToday} disabled={isToday}>
          今日
        </Button>
      </div>
      <p className="mt-0.5 flex flex-nowrap gap-x-3 whitespace-nowrap text-xs text-muted">
        <span>{shown ? `${formatKcal(shown.kcal)} kcal` : "—"}</span>
        {shown?.weightKg != null ? <span>{shown.weightKg.toFixed(2)} kg</span> : null}
        {shown && (shown.walkKm ?? 0) > 0 ? <span>{walkLabel(shown.walkKm)} km</span> : null}
      </p>
      <div className="mt-3 grid grid-cols-4 rounded-md bg-surface-2 p-1">
        {TREND_GRAINS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`h-9 rounded-sm text-sm font-medium ${grain === item.id ? "bg-surface text-fg shadow-card" : "text-muted"}`}
            onClick={() => onGrain(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-0.5 w-4 rounded-full bg-primary" />
          期間のカロリー合計
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-0.5 w-4 border-t border-dashed border-accent" />
          {guideValue > 0 ? `目安 ${formatKcal(guideValue)}` : "目安"}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-[#c23b32]" />
          期末の体重
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2 rounded-sm bg-[#6b5344]/70" />
          おさんぽの距離
        </span>
      </div>
      <div
        className="relative mt-2 touch-pan-y"
        aria-label="左右にスライドで期間を移動"
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={() => {
          startX.current = null;
        }}
      >
        <ChevronLeft
          aria-hidden
          className={`pointer-events-none absolute left-0 top-1/2 z-10 size-5 -translate-y-1/2 ${canOlder ? "text-fg/70" : "text-muted/30"}`}
          strokeWidth={1.75}
        />
        <ChevronRight
          aria-hidden
          className={`pointer-events-none absolute right-0 top-1/2 z-10 size-5 -translate-y-1/2 ${canNewer ? "text-fg/70" : "text-muted/30"}`}
          strokeWidth={1.75}
        />
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full overflow-visible" role="img" aria-label="摂取カロリーと体重とおさんぽ距離の推移">
        {/* 描画順: 散歩の棒 → 目安の点線 → kcal の線 → 体重の線と点。日付文字だけ onSelect。 */}
        {days.map((day, index) => {
          const km = day.walkKm ?? 0;
          if (!(km > 0)) return null;
          const top = yWalk(km);
          return (
            <g key={`walk-${day.start}`}>
              <rect
                x={x(index) - barW / 2}
                y={top}
                width={barW}
                height={Math.max(1, baseline - top)}
                rx="1"
                fill="#6b5344"
                fillOpacity={day.date === shown?.date ? 0.8 : 0.35}
              />
              <text x={x(index)} y={Math.max(top - 3, 11)} textAnchor="middle" fill="#6b5344" fontSize="8">
                {walkLabel(km)}
              </text>
            </g>
          );
        })}
        {guideLine ? (
          <polyline
            fill="none"
            stroke="var(--color-accent)"
            strokeWidth="1.5"
            strokeDasharray="4 3"
            points={guideLine}
          />
        ) : null}
        {guideIndex >= 0 ? (
          <text
            x={x(guideIndex) < pad.left + 36 ? x(guideIndex) + 4 : Math.min(x(guideIndex) - 2, width - 8)}
            y={Math.min(Math.max(yKcal(guideValue) - 4, 12), baseline - 8)}
            textAnchor={x(guideIndex) < pad.left + 36 ? "start" : "end"}
            fill="var(--color-accent)"
            fontSize="9"
          >
            {formatKcal(guideValue)}
          </text>
        ) : null}
        <polyline fill="none" stroke="var(--color-primary)" strokeWidth="2" points={kcalLine} />
        {weightLine ? (
          <polyline fill="none" stroke="#c23b32" strokeWidth="2.25" points={weightLine} />
        ) : null}
        {weightPts.map((item) => (
          <circle
            key={`w-${days[item.index]!.start}`}
            cx={x(item.index)}
            cy={yWeight(item.kg)}
            r={days[item.index]!.date === activeDate ? 4 : 3}
            fill="#c23b32"
          />
        ))}
        {days.map((day, index) => (
          <g key={day.start}>
            <circle
              cx={x(index)}
              cy={yKcal(day.kcal)}
              r={day.date === activeDate ? 3.5 : 2.2}
              fill="var(--color-primary)"
            />
            {index % showEvery === 0 || index === days.length - 1 ? (
              <g
                className="cursor-pointer"
                onClick={() => {
                  if (swiped.current) return;
                  setPicked(day.date);
                  onSelect(day.date);
                }}
              >
                <rect x={x(index) - 14} y={height - 22} width={28} height={20} fill="transparent" />
                <text
                  x={x(index)}
                  y={height - 10}
                  textAnchor="middle"
                  fill={day.date === shown?.date ? "var(--color-fg)" : "var(--color-subtle)"}
                  fontSize="8"
                >
                  {axisTick(grain, day, days[index - 1])}
                </text>
              </g>
            ) : null}
          </g>
        ))}
        <text x={2} y={11} fill="var(--color-subtle)" fontSize="9">
          {maxKcal}
        </text>
        <text x={width - 2} y={11} textAnchor="end" fill="#c23b32" fontSize="9">
          {weightMax.toFixed(2)}
        </text>
        <text x={4} y={pad.top + innerH} fill="var(--color-subtle)" fontSize="9">
          kcal
        </text>
        <text x={width - 4} y={pad.top + innerH} textAnchor="end" fill="#c23b32" fontSize="9">
          kg
        </text>
      </svg>
      </div>
      <p className="mt-1 text-center text-xs text-subtle">
        左右にスライドで期間を移動。日付をタップすると、その値を上に出してその日へ移ります。
      </p>
    </div>
  );
}
