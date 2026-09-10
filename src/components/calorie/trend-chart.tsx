import { useRef, type PointerEvent } from "react";
import { TREND_GRAINS, type DayTrend, type TrendGrain } from "@/lib/calorie/types";
import { Button } from "@/components/ui/button";

function niceMax(value: number, step: number): number {
  if (!(value > 0)) return step;
  return Math.ceil(value / step) * step;
}

function grainTitle(grain: TrendGrain): string {
  if (grain === "week") return "推移（週）";
  if (grain === "month") return "推移（月）";
  if (grain === "year") return "推移（年）";
  return "推移（14日）";
}

function axisTick(grain: TrendGrain, day: DayTrend, prev: DayTrend | undefined): string {
  if (grain === "month") {
    const month = String(Number(day.start.slice(5, 7)));
    const year = day.start.slice(0, 4);
    if (!prev || prev.start.slice(0, 4) !== year) return `${year.slice(2)}/${month}`;
    return month;
  }
  return day.label;
}

function rangeLabel(grain: TrendGrain, days: DayTrend[]): string {
  const first = days[0];
  const last = days[days.length - 1];
  if (!first || !last) return "";
  if (grain === "year") return `${first.label}–${last.label}`;
  if (first.start.slice(0, 4) === last.end.slice(0, 4)) {
    return `${first.start.slice(0, 4)}年`;
  }
  return `${first.start.slice(0, 4)}年–${last.end.slice(0, 4)}年`;
}

export function TrendChart({
  grain,
  days,
  activeDate,
  todayDate,
  targetKcal,
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
  targetKcal: number;
  canOlder?: boolean;
  canNewer?: boolean;
  onGrain: (grain: TrendGrain) => void;
  onSelect: (date: string) => void;
  onToday: () => void;
  onShift: (direction: -1 | 1) => void;
}) {
  const width = 320;
  const height = 184;
  const pad = { top: 16, right: 36, bottom: 36, left: 36 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;

  const maxKcal = niceMax(Math.max(...days.map((day) => day.kcal), grain === "day" ? targetKcal : 1, 1), grain === "day" ? 100 : 500);
  const weights = days.map((day) => day.weightKg).filter((value): value is number => value != null && value > 0);
  const minW = weights.length ? Math.min(...weights) : 0;
  const maxW = weights.length ? Math.max(...weights) : 1;
  const span = Math.max(0.4, maxW - minW);
  const weightMin = Math.max(0, minW - span * 0.2);
  const weightMax = maxW + span * 0.2;
  const isToday = activeDate === todayDate;
  const showEvery = grain === "day" ? 1 : grain === "week" ? 2 : 1;

  function x(index: number) {
    if (days.length <= 1) return pad.left + innerW / 2;
    return pad.left + (index / (days.length - 1)) * innerW;
  }
  function yKcal(value: number) {
    return pad.top + innerH - (value / maxKcal) * innerH;
  }
  function yWeight(value: number) {
    return pad.top + innerH - ((value - weightMin) / (weightMax - weightMin || 1)) * innerH;
  }

  const kcalLine = days.map((day, index) => `${x(index).toFixed(1)},${yKcal(day.kcal).toFixed(1)}`).join(" ");
  const weightPts = days
    .map((day, index) => (day.weightKg != null ? { index, kg: day.weightKg } : null))
    .filter((item): item is { index: number; kg: number } => item != null);
  const weightLine = weightPts.map((item) => `${x(item.index).toFixed(1)},${yWeight(item.kg).toFixed(1)}`).join(" ");
  const latest = days[days.length - 1];
  const startX = useRef<number | null>(null);
  const swiped = useRef(false);

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    startX.current = event.clientX;
    swiped.current = false;
  }
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
      <div className="flex items-end justify-between gap-2">
        <div>
          <p className="font-display text-lg font-semibold text-fg">{grainTitle(grain)}</p>
          <p className="mt-0.5 text-xs text-muted">{rangeLabel(grain, days)}</p>
        </div>
        <div className="flex items-center gap-2">
          <p className="text-right text-xs text-muted">
            {latest ? `${Math.round(latest.kcal)} kcal` : "—"}
            {latest?.weightKg != null ? ` / ${latest.weightKg.toFixed(2)} kg` : ""}
          </p>
          <Button type="button" variant="ghost" size="sm" onClick={onToday} disabled={isToday}>
            今日
          </Button>
        </div>
      </div>
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
      <div className="mt-2 flex items-center gap-4 text-[11px] text-muted">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-0.5 w-4 rounded-full bg-primary" />
          期間のカロリー合計
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-fg" />
          期末の体重
        </span>
      </div>
      <div
        className="touch-pan-y"
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={() => {
          startX.current = null;
        }}
      >
      <svg viewBox={`0 0 ${width} ${height}`} className="mt-2 w-full" role="img" aria-label="摂取カロリーと体重の推移">
        {grain === "day" && targetKcal > 0 ? (
          <line
            x1={pad.left}
            x2={width - pad.right}
            y1={yKcal(targetKcal)}
            y2={yKcal(targetKcal)}
            stroke="var(--color-border)"
            strokeDasharray="4 3"
          />
        ) : null}
        <polyline fill="none" stroke="var(--color-primary)" strokeWidth="2" points={kcalLine} />
        {weightLine ? (
          <polyline fill="none" stroke="var(--color-fg)" strokeWidth="1.75" strokeDasharray="4 3" points={weightLine} />
        ) : null}
        {weightPts.map((item) => (
          <circle
            key={`w-${days[item.index]!.start}`}
            cx={x(item.index)}
            cy={yWeight(item.kg)}
            r={days[item.index]!.date === activeDate ? 4 : 3}
            fill="var(--color-fg)"
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
              <text
                x={x(index)}
                y={height - 10}
                textAnchor="middle"
                fill={day.date === activeDate ? "var(--color-fg)" : "var(--color-subtle)"}
                fontSize="8"
              >
                {axisTick(grain, day, days[index - 1])}
              </text>
            ) : null}
            <rect
              x={x(index) - innerW / days.length / 2}
              y={pad.top}
              width={innerW / days.length}
              height={innerH}
              fill="transparent"
              className="cursor-pointer"
              onClick={() => {
                if (swiped.current) return;
                onSelect(day.date);
              }}
            >
              <title>{`${day.label} ${Math.round(day.kcal)}kcal${day.weightKg != null ? ` ${day.weightKg.toFixed(2)}kg` : ""}`}</title>
            </rect>
          </g>
        ))}
        <text x={4} y={pad.top + 4} fill="var(--color-subtle)" fontSize="9">
          {maxKcal}
        </text>
        <text x={width - 4} y={pad.top + 4} textAnchor="end" fill="var(--color-subtle)" fontSize="9">
          {weightMax.toFixed(2)}
        </text>
        <text x={4} y={pad.top + innerH} fill="var(--color-subtle)" fontSize="9">
          kcal
        </text>
        <text x={width - 4} y={pad.top + innerH} textAnchor="end" fill="var(--color-subtle)" fontSize="9">
          kg
        </text>
      </svg>
      </div>
      <p className="mt-1 text-center text-xs text-subtle">
        左右にスライドで期間を移動。点をタップするとその期間の最終日へ。
      </p>
    </div>
  );
}
