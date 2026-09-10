import { dayNum } from "@/lib/calorie/formula";
import type { DayTrend } from "@/lib/calorie/types";

function niceMax(value: number, step: number): number {
  if (!(value > 0)) return step;
  return Math.ceil(value / step) * step;
}

export function TrendChart({
  days,
  activeDate,
  targetKcal,
  onSelect,
}: {
  days: DayTrend[];
  activeDate: string;
  targetKcal: number;
  onSelect: (date: string) => void;
}) {
  const width = 320;
  const height = 176;
  const pad = { top: 16, right: 36, bottom: 28, left: 36 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;

  const maxKcal = niceMax(Math.max(targetKcal, ...days.map((day) => day.kcal), 1), 100);
  const weights = days.map((day) => day.weightKg).filter((value): value is number => value != null && value > 0);
  const minW = weights.length ? Math.min(...weights) : 0;
  const maxW = weights.length ? Math.max(...weights) : 1;
  const span = Math.max(0.4, maxW - minW);
  const weightMin = Math.max(0, minW - span * 0.2);
  const weightMax = maxW + span * 0.2;

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
  const latestWeight = [...days].reverse().find((day) => day.weightKg != null)?.weightKg ?? null;

  return (
    <div className="rounded-xl border border-border bg-surface p-4 shadow-card">
      <div className="flex items-end justify-between gap-2">
        <p className="font-display text-lg font-semibold text-fg">推移（14日）</p>
        <p className="text-xs text-muted">
          {latest ? `${Math.round(latest.kcal)} kcal` : "—"}
          {latestWeight != null ? ` / ${latestWeight.toFixed(1)} kg` : ""}
        </p>
      </div>
      <div className="mt-2 flex items-center gap-4 text-[11px] text-muted">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-0.5 w-4 rounded-full bg-primary" />
          摂取カロリー
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-fg" />
          体重
        </span>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="mt-2 w-full" role="img" aria-label="摂取カロリーと体重の推移">
        {targetKcal > 0 ? (
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
            key={`w-${days[item.index]!.date}`}
            cx={x(item.index)}
            cy={yWeight(item.kg)}
            r={days[item.index]!.date === activeDate ? 4 : 3}
            fill="var(--color-fg)"
          />
        ))}
        {days.map((day, index) => (
          <g key={day.date}>
            <circle
              cx={x(index)}
              cy={yKcal(day.kcal)}
              r={day.date === activeDate ? 3.5 : 2.2}
              fill="var(--color-primary)"
            />
            <text
              x={x(index)}
              y={height - 8}
              textAnchor="middle"
              className="fill-current"
              fill={day.date === activeDate ? "var(--color-fg)" : "var(--color-subtle)"}
              fontSize="9"
            >
              {dayNum(day.date)}
            </text>
            <rect
              x={x(index) - innerW / days.length / 2}
              y={pad.top}
              width={innerW / days.length}
              height={innerH}
              fill="transparent"
              className="cursor-pointer"
              onClick={() => onSelect(day.date)}
            >
              <title>{`${day.date} ${Math.round(day.kcal)}kcal${day.weightKg != null ? ` ${day.weightKg}kg` : ""}`}</title>
            </rect>
          </g>
        ))}
        <text x={4} y={pad.top + 4} fill="var(--color-subtle)" fontSize="9">
          {maxKcal}
        </text>
        <text x={width - 4} y={pad.top + 4} textAnchor="end" fill="var(--color-subtle)" fontSize="9">
          {weightMax.toFixed(1)}
        </text>
        <text x={4} y={pad.top + innerH} fill="var(--color-subtle)" fontSize="9">
          kcal
        </text>
        <text x={width - 4} y={pad.top + innerH} textAnchor="end" fill="var(--color-subtle)" fontSize="9">
          kg
        </text>
      </svg>
      <p className="mt-1 text-center text-xs text-subtle">点をタップするとその日の記録を開けます。破線は目標カロリーです。</p>
    </div>
  );
}
