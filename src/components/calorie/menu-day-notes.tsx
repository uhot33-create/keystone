/**
 * メニューの日付行の下に出す、その日の記録とおくすりのお知らせ。
 * 記録は読むだけ。おくすりは時刻を過ぎて未投与のものだけ。
 */
import { useEffect, useState } from "react";
import { overdueMedicines } from "@/components/calorie/medicine-panel";
import { dailyEnergy, formatJaDayWeek, formatKcal, formatQuantity, todayJst, truncKcal } from "@/lib/calorie/formula";
import type { CalorieState } from "@/lib/calorie/types";

function kindLabel(kind: string): string {
  return kind === "treat" ? "おやつ" : "ごはん";
}

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
    const id = window.setInterval(() => setClock(new Date()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const target = dailyEnergy(state.dog.idealWeightKg, state.dog.lifeStage);
  const total = truncKcal(state.logs.reduce((sum, log) => sum + log.kcal, 0));
  const remainText =
    target > 0
      ? total > target
        ? `超 ${formatKcal(truncKcal(total - target))}`
        : `残 ${formatKcal(truncKcal(target - total))}`
      : "残 —";
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
