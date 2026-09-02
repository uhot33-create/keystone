import { NICE_PER_VERY, VERY_PER_WONDERFUL } from "@/lib/smoking/badges";
import type { SmokingState } from "@/lib/smoking/types";
import { cn } from "@/lib/utils";

export function BadgePanel({ state }: { state: SmokingState }) {
  const b = state.badges;

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-xl border border-border bg-surface p-5 shadow-card">
        <p className="font-display text-lg font-semibold text-fg">今日</p>
        <p className={`mt-2 font-display text-xl font-semibold ${state.exceeded ? "text-danger" : "text-fg"}`}>
          {state.exceeded ? "限度を超えました" : "限度内です"}
        </p>
        <p className="mt-2 text-sm text-muted">
          {state.exceeded
            ? "今日のナイスは付きません。0時を過ぎると判定されます。"
            : "このまま0時まで限度を超えなければ、ナイスが1つ付きます。"}
        </p>
      </div>

      <section className="rounded-xl border border-border bg-surface p-5 shadow-card">
        <p className="text-xs font-medium tracking-widest text-subtle">貯める</p>
        <div className="mt-4 grid grid-cols-3 gap-2">
          <Seal
            title="とっても素敵"
            size="lg"
            earned={b.wonderfulCount > 0}
            count={b.wonderfulCount}
            hint="ベリーナイス 6個"
            progress={b.veryNiceCount}
            total={VERY_PER_WONDERFUL}
          />
          <Seal
            title="ベリーナイス"
            size="lg"
            earned={b.veryNiceCount > 0 || b.wonderfulCount > 0}
            count={b.veryNiceCount}
            hint="ナイス 30日"
            progress={b.niceCount}
            total={NICE_PER_VERY}
          />
          <Seal title="ナイス" size="lg" earned={b.niceCount > 0 || b.veryNiceCount > 0 || b.wonderfulCount > 0} count={b.niceCount} hint="限度を超えなければ" />
        </div>
      </section>

      <section className="rounded-xl border border-border bg-surface p-5 shadow-card">
        <p className="text-xs font-medium tracking-widest text-subtle">日数</p>
        <div className="mt-4 grid grid-cols-4 gap-2">
          <Seal title="スタート" earned={b.startEarned} hint="初めてのナイス" />
          <Seal title="一週間" earned={b.weekEarned} hint="7日連続" progress={Math.min(b.streak, 7)} total={7} />
          <Seal title="ひと月" earned={b.monthEarned} hint="30日連続" progress={Math.min(b.streak, 30)} total={30} />
          <Seal title="百日" earned={b.hundredEarned} hint="累計100" progress={Math.min(b.lifetimeNice, 100)} total={100} />
        </div>
      </section>

      <section className="rounded-xl border border-border bg-surface p-5 shadow-card">
        <p className="text-xs font-medium tracking-widest text-subtle">本数</p>
        <div className="mt-4 grid grid-cols-3 gap-2">
          <Seal title="少なめ" earned={b.lightCount > 0} count={b.lightCount} hint="半分以下で終えた" />
          <Seal title="ゼロの日" earned={b.zeroCount > 0} count={b.zeroCount} hint="1本も吸わない" />
          <Seal title="静かな週" earned={b.quietWeekCount > 0} count={b.quietWeekCount} hint="ゼロが7日" progress={b.zeroStreak % 7} total={7} />
        </div>
      </section>

      <section className="rounded-xl border border-border bg-surface p-5 shadow-card">
        <p className="text-xs font-medium tracking-widest text-subtle">特別</p>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <Seal title="立て直し" earned={b.recoverCount > 0} count={b.recoverCount} hint="超えた翌日に限度内" />
          <Seal title="上限ダウン" earned={b.limitDownCount > 0} count={b.limitDownCount} hint="上限本数を下げた" />
        </div>
      </section>
    </div>
  );
}

function Seal({
  title,
  hint,
  count,
  earned,
  progress,
  total,
  size = "sm",
}: {
  title: string;
  hint: string;
  count?: number;
  earned: boolean;
  progress?: number;
  total?: number;
  size?: "sm" | "lg";
}) {
  const ratio = progress == null || total == null ? null : Math.min(100, (progress / total) * 100);
  const large = size === "lg";
  const stamp = large ? "size-[5.75rem] sm:size-28" : "size-[4.25rem]";
  const inner = large ? "size-[4.85rem] sm:size-[6.15rem]" : "size-[3.55rem]";
  const type = large
    ? title.length > 5
      ? "text-[11px] sm:text-sm"
      : "text-sm sm:text-base"
    : title.length > 4
      ? "text-[10px]"
      : "text-xs";

  return (
    <div className="flex flex-col items-center text-center">
      <div
        className={cn(
          "grid place-items-center rounded-full border-[3px]",
          stamp,
          earned ? "border-danger rotate-[-2deg]" : "border-border",
        )}
        style={
          earned
            ? { background: "color-mix(in oklab, var(--color-danger) 12%, var(--color-surface))" }
            : undefined
        }
      >
        <div
          className={cn(
            "grid place-items-center rounded-full border",
            inner,
            earned ? "border-danger" : "border-border",
          )}
        >
          <span
            className={cn(
              "max-h-[90%] font-display font-semibold leading-none tracking-[0.18em]",
              type,
              earned ? "text-danger" : "text-subtle",
            )}
            style={{ writingMode: "vertical-rl" }}
          >
            {title}
          </span>
        </div>
      </div>
      <p className={cn("mt-2 font-display text-sm tabular-nums", earned ? "text-fg" : "text-subtle")}>
        {count != null ? count : earned ? "獲得" : "まだ"}
      </p>
      <p className="mt-0.5 text-[11px] leading-snug text-muted">{hint}</p>
      {ratio == null ? null : (
        <div className="mt-2 w-full max-w-20">
          <div className="h-1 overflow-hidden rounded-full bg-surface-2">
            <div className="h-full rounded-full bg-danger/80" style={{ width: `${ratio}%` }} />
          </div>
          <p className="mt-1 text-[10px] text-subtle">
            {progress}/{total}
          </p>
        </div>
      )}
    </div>
  );
}
