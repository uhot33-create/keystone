/**
 * 日付の行。左右スワイプは48px以上で前日・翌日。
 * 「今日」で今日へ。「グラフ」でグラフを開く。
 * 暮らし帳のカードメニューと、わんカロリーの今日画面で使う。
 * 呼び出しは HomeCalorieDate（暮らし帳）と TodayPanel（今日タブ）。DB には書かず、移動は onShift / onToday / onChart に渡すだけ。
 * スワイプ幅とグラフボタンの出し分けを変えるならこのファイル。閲覧のみになる日数は formula.ts の isCalorieLocked。
 */
import { useRef } from "react";
import { ChartLine, ChevronLeft, ChevronRight } from "lucide-react";
import { formatJaDayWeek, todayJst } from "@/lib/calorie/formula";
import { Button } from "@/components/ui/button";

/**
 * 日付バー本体。date を曜日つきで出し、前日・翌日・今日・グラフを並べる。
 * chartOpen のあいだ、または showChart が false（人のメニュー）のときはグラフボタンを出さない。locked なら下に閲覧のみと書く。
 * 横にどれだけ動かしたら日付が変わるかは、下の 48。
 */
export function DateBar({
  date,
  chartOpen,
  locked,
  onShift,
  onToday,
  onChart,
  showChart = true,
}: {
  date: string;
  chartOpen: boolean;
  locked: boolean;
  onShift: (days: -1 | 1) => void;
  onToday: () => void;
  onChart: () => void;
  showChart?: boolean;
}) {
  const startX = useRef(0);
  return (
    <div>
      <div
        className="flex touch-pan-y items-center gap-1"
        aria-label="左右にスワイプして日付を変える"
        onPointerDown={(event) => {
          startX.current = event.clientX;
        }}
        onPointerUp={(event) => {
          // 48px 未満はタップ扱いで日付を変えない。左へ滑らすと翌日、右へ滑らすと前日。
          const dx = event.clientX - startX.current;
          if (Math.abs(dx) < 48) return;
          onShift(dx < 0 ? 1 : -1);
        }}
      >
        <button
          type="button"
          className="grid size-7 shrink-0 place-items-center text-muted"
          aria-label="前日"
          onClick={() => onShift(-1)}
        >
          <ChevronLeft className="size-4" strokeWidth={1.75} />
        </button>
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
          {/* グラフ表示中と、人メニュー（showChart=false）のあいだはボタンを隠す。 */}
          {chartOpen || !showChart ? null : (
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
        <button
          type="button"
          className="grid size-7 shrink-0 place-items-center text-muted"
          aria-label="翌日"
          onClick={() => onShift(1)}
        >
          <ChevronRight className="size-4" strokeWidth={1.75} />
        </button>
      </div>
      {/* locked は呼び出し側の isCalorieLocked。止める日数は formula.ts、文言だけここ。 */}
      {locked ? <p className="text-center text-xs text-muted">2週間以上前の記録は閲覧のみです</p> : null}
    </div>
  );
}
