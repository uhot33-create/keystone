/**
 * メニューの日付行の下に出す、その日の記録とおくすりのお知らせ。
 * 記録は読むだけ。おくすりは時刻を過ぎて未投与のものだけ。
 * 暮らし帳の HomeCalorieDate と、今日タブのホーム（TodayPanel）で使う。
 * 目標は dailyEnergy、合計は logs を足して truncKcal。遅れは medicine-panel の overdueMedicines。
 * 開きっぱなしの再判定は 30 秒の setInterval。案内の文言は「おくすりがまだです」。
 */
import { useEffect, useState } from "react";
import { overdueMedicines } from "@/components/calorie/medicine-panel";
import { dailyEnergy, formatJaDayWeek, formatKcal, formatQuantity, todayJst, truncKcal } from "@/lib/calorie/formula";
import type { CalorieState } from "@/lib/calorie/types";

/** 記録行の種類ラベル。treat 以外はごはん。文言だけここ（保存値 kind は変えない）。 */
function kindLabel(kind: string): string {
  return kind === "treat" ? "おやつ" : "ごはん";
}

/**
 * その日の kcal 合計と残／超、記録一覧、未投与のお知らせ。
 * onOpenMeds は案内ボタンだけ。記録の追加や削除はしない。
 */
export function MenuDayNotes({
  state,
  onOpenMeds,
  pending = false,
}: {
  state: CalorieState;
  onOpenMeds: () => void;
  pending?: boolean;
}) {
  const [clock, setClock] = useState(() => new Date());

  useEffect(() => {
    // 投与時刻を跨いでも開きっぱなしで案内が出るよう、30秒ごとに今を取り直す。
    const id = window.setInterval(() => setClock(new Date()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const target = dailyEnergy(state.dog.idealWeightKg, state.dog.lifeStage);
  const total = truncKcal(state.logs.reduce((sum, log) => sum + log.kcal, 0));
  // 目標超過は「超」、以内は「残」。理想体重が無く目標 0 なら「残 —」。
  const remainText =
    target > 0
      ? total > target
        ? `超 ${formatKcal(truncKcal(total - target))}`
        : `残 ${formatKcal(truncKcal(target - total))}`
      : "残 —";
  // 機能追加前・未来日・時刻前は overdueMedicines が空にする。手入れはここには出さない。
  const late = overdueMedicines(state.medicines ?? [], state.date, state.medicineAddedOn, clock);

  return (
    <>
      <section className="rounded-lg border border-border bg-surface px-3 py-2">
        <div className="flex items-baseline gap-2 whitespace-nowrap">
          <p className="shrink-0 text-xs font-medium text-subtle">
            {state.date === todayJst() ? "今日の記録" : formatJaDayWeek(state.date)}
          </p>
          <p className={`min-w-0 flex-1 truncate text-right text-xs tabular-nums ${total > target && target > 0 ? "text-danger" : "text-muted"}`}>
            {formatKcal(total)} kcal　{remainText}
          </p>
        </div>
        {pending ? (
          <p className="mt-1 text-xs text-muted">読み込み中…</p>
        ) : state.logs.length === 0 ? (
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
      {late.length > 0 ? (
        <button
          type="button"
          className="rounded-md border border-danger/40 bg-surface px-3 py-2 text-left text-sm text-danger"
          onClick={onOpenMeds}
        >
          おくすりがまだです（{late.length}）
        </button>
      ) : null}
    </>
  );
}
