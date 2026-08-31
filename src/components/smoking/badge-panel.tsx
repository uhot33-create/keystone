import { NICE_PER_VERY, VERY_PER_WONDERFUL } from "@/lib/smoking/badges";
import type { SmokingState } from "@/lib/smoking/types";

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

      <section className="flex flex-col gap-3">
        <p className="text-xs font-medium tracking-widest text-subtle">貯める</p>
        <BadgeCard title="とっても素敵" count={b.wonderfulCount} hint="ベリーナイス 6個で 1つ" progress={b.veryNiceCount} total={VERY_PER_WONDERFUL} />
        <BadgeCard title="ベリーナイス" count={b.veryNiceCount} hint="ナイス 30日で 1つ" progress={b.niceCount} total={NICE_PER_VERY} />
        <BadgeCard title="ナイス" count={b.niceCount} hint="1日の限度を超えなければ 1つ" />
      </section>

      <section className="flex flex-col gap-3">
        <p className="text-xs font-medium tracking-widest text-subtle">日数</p>
        <BadgeCard title="スタート" earned={b.startEarned} hint="初めてナイスが付いた日" />
        <BadgeCard title="一週間" earned={b.weekEarned} hint="限度内が7日連続" progress={Math.min(b.streak, 7)} total={7} />
        <BadgeCard title="ひと月" earned={b.monthEarned} hint="限度内が30日連続" progress={Math.min(b.streak, 30)} total={30} />
        <BadgeCard title="百日" earned={b.hundredEarned} hint="累計ナイス 100" progress={Math.min(b.lifetimeNice, 100)} total={100} />
      </section>

      <section className="flex flex-col gap-3">
        <p className="text-xs font-medium tracking-widest text-subtle">本数</p>
        <BadgeCard title="少なめ" count={b.lightCount} hint="上限の半分以下で1日を終えた" />
        <BadgeCard title="ゼロの日" count={b.zeroCount} hint="1本も吸わずに1日を終えた" />
        <BadgeCard title="静かな週" count={b.quietWeekCount} hint="ゼロの日が7日続くと 1つ" progress={b.zeroStreak % 7} total={7} />
      </section>

      <section className="flex flex-col gap-3">
        <p className="text-xs font-medium tracking-widest text-subtle">特別</p>
        <BadgeCard title="立て直し" count={b.recoverCount} hint="限度を超えた翌日に、限度内で終えた" />
        <BadgeCard title="上限ダウン" count={b.limitDownCount} hint="1日の上限本数を下げた" />
      </section>
    </div>
  );
}

function BadgeCard({
  title,
  hint,
  count,
  earned,
  progress,
  total,
}: {
  title: string;
  hint: string;
  count?: number;
  earned?: boolean;
  progress?: number;
  total?: number;
}) {
  const label = earned != null ? (earned ? "獲得" : "まだ") : String(count ?? 0);
  const ratio = progress == null || total == null ? null : Math.min(100, (progress / total) * 100);
  return (
    <div className="rounded-xl border border-border bg-surface p-5 shadow-card">
      <div className="flex items-end justify-between gap-3">
        <p className="font-display text-lg font-semibold text-fg">{title}</p>
        <p className={`font-display text-xl font-semibold ${earned === false ? "text-subtle" : "text-fg"}`}>{label}</p>
      </div>
      <p className="mt-1 text-sm text-muted">{hint}</p>
      {ratio == null ? null : (
        <div className="mt-3">
          <div className="h-2 overflow-hidden rounded-full bg-surface-2">
            <div className="h-full rounded-full bg-primary" style={{ width: `${ratio}%` }} />
          </div>
          <p className="mt-1 text-xs text-subtle">
            次まで {progress}/{total}
          </p>
        </div>
      )}
    </div>
  );
}
