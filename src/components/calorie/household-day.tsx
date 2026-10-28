/**
 * 多頭の体重と定番ごはんを、一頭一行で入れる。
 * 体重は変えた欄だけまとめて保存する。定番は押した犬のその日に足す。
 * 2週間より前は isCalorieLocked で止める。
 * 暮らし帳の「まとめて」。読み込みは getHouseholdDay、体重は saveHouseholdWeights、定番は addCalorieLog。
 * いま開いている犬と同じ日なら holdCalorieState の体重と logs も合わせる。空欄禁止と上限 120kg は onSaveWeights。
 */
import { useEffect, useState } from "react";
import { addCalorieLog, getHouseholdDay, saveHouseholdWeights } from "@/lib/calorie/api";
import { formatJaDayWeek, formatQuantity, isCalorieLocked, kcalForQuantity, truncKcal } from "@/lib/calorie/formula";
import { holdCalorieState, peekCalorieState } from "@/lib/calorie/held";
import type { HouseholdDogDay } from "@/lib/calorie/types";
import { Button } from "@/components/ui/button";
import { BusyOverlay } from "@/components/ui/busy-overlay";
import { Input } from "@/components/ui/input";
import { PageHeading } from "@/components/page-heading";

/** 体重欄の初期文字列。未記録や 0 以下は空。ある値は常に小数2桁。桁を変えるなら toFixed。 */
function weightText(value: number | null): string {
  return value != null && value > 0 ? value.toFixed(2) : "";
}

/**
 * まとめて画面。date が変わると getHouseholdDay を取り直す。
 * 体重の一括保存は onSaveWeights、定番チップは onStaple。ロック中はどちらも止める。
 */
export function HouseholdDay({ date }: { date: string }) {
  const [dogs, setDogs] = useState<HouseholdDogDay[] | null>(null);
  const [weights, setWeights] = useState<Record<number, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [busyDog, setBusyDog] = useState<number | null>(null);
  const locked = isCalorieLocked(date);

  useEffect(() => {
    // 日付が変わったら取り直す。戻る前の応答は cancelled で捨て、古い日の体重を上書きしない。
    let cancelled = false;
    setDogs(null);
    setError(null);
    getHouseholdDay({ data: { date } })
      .then((next) => {
        if (cancelled) return;
        setDogs(next);
        setWeights(Object.fromEntries(next.map((dog) => [dog.id, weightText(dog.weightKg)])));
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "読み込みに失敗しました");
      });
    return () => {
      cancelled = true;
    };
  }, [date]);

  /**
   * いま保持している CalorieState が同じ日・同じ犬なら、今日の体重だけ差し替える。
   * 別の日や別の犬の保持分は触らない。合わせる条件を変えるなら peek の if。
   */
  function patchHeldWeight(dogId: number, weightKg: number | null) {
    const held = peekCalorieState();
    if (!held || held.date !== date || held.dog.id !== dogId) return;
    holdCalorieState({ ...held, todayWeightKg: weightKg });
  }

  /**
   * 表示と違う欄だけ { dogId, weightKg } にする。空欄はエラー、0 以下と 120kg 超も拒否。
   * 1件も無ければ保存せず「変更はありません」。上限を変えるならここの 120。
   */
  async function onSaveWeights() {
    if (!dogs) return;
    const changes: { dogId: number; weightKg: number }[] = [];
    for (const dog of dogs) {
      const text = (weights[dog.id] ?? "").trim();
      const before = weightText(dog.weightKg);
      if (text === before) continue;
      if (text === "") {
        setError(`${dog.name}の体重が空です。消すことはできません`);
        return;
      }
      const weightKg = Number(text);
      // 空は「消す」ではなくエラー。0 と 120kg 超も保存しない。小数は 2 桁に丸める。
      if (!Number.isFinite(weightKg) || weightKg <= 0 || weightKg > 120) {
        setError(`${dog.name}の体重は0より大きく120kgまでです`);
        return;
      }
      changes.push({ dogId: dog.id, weightKg: Math.round(weightKg * 100) / 100 });
    }
    if (changes.length === 0) {
      setSaved("変更はありません");
      setError(null);
      return;
    }
    setSaving(true);
    setError(null);
    setSaved(null);
    try {
      const next = await saveHouseholdWeights({ data: { date, weights: changes } });
      setDogs(next);
      setWeights(Object.fromEntries(next.map((dog) => [dog.id, weightText(dog.weightKg)])));
      for (const dog of next) patchHeldWeight(dog.id, dog.weightKg);
      setSaved("体重を保存しました");
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存できませんでした");
    } finally {
      setSaving(false);
    }
  }

  /**
   * 定番1件をその犬のその日の記録に足す。kcal は kcalForQuantity、保存値は truncKcal。
   * ロック中と 0kcal は何もしない。同じ日の保持 state があれば logs だけ更新する。
   */
  async function onStaple(dog: HouseholdDogDay, stapleId: number) {
    const staple = dog.staples.find((item) => item.id === stapleId);
    if (!staple || locked) return;
    const kcal = kcalForQuantity(staple.kcal, staple.amount, staple.qty);
    if (!(kcal > 0)) return;
    setBusyDog(dog.id);
    setError(null);
    setSaved(null);
    try {
      const next = await addCalorieLog({
        data: {
          date,
          dogId: dog.id,
          label: staple.name,
          kcal: truncKcal(kcal),
          kind: staple.kind,
          foodId: staple.foodId,
          amount: staple.qty,
          unit: staple.unit,
        },
      });
      const held = peekCalorieState();
      // 今日タブで同じ日・同じ犬を開いているときだけ、足した記録を保持分にも反映する。
      if (held && held.date === date && held.dog.id === dog.id) {
        holdCalorieState({ ...held, logs: next.logs });
      }
      setSaved(`${dog.name}に足しました`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "記録できませんでした");
    } finally {
      setBusyDog(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <BusyOverlay show={dogs === null && !error || saving} label={saving ? "保存中…" : "読み込み中…"} />
      <PageHeading title="まとめて" />
      <p className="text-sm text-muted">{formatJaDayWeek(date)}</p>
      {locked ? <p className="text-sm text-muted">2週間以上前の記録は変更できません</p> : null}
      {error ? (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}
      {saved ? <p className="text-sm text-fg">{saved}</p> : null}
      {dogs && dogs.length === 0 ? <p className="text-sm text-muted">犬が登録されていません</p> : null}
      {dogs && dogs.length > 0 ? (
        <>
          <section className="rounded-lg border border-border bg-surface px-3 py-2 shadow-card">
            <p className="text-sm font-medium text-fg">体重</p>
            <div className="mt-2 flex flex-col gap-2">
              {dogs.map((dog) => (
                <div key={dog.id} className="flex items-center gap-2">
                  <p className="w-24 shrink-0 truncate text-sm text-fg">{dog.name}</p>
                  <Input
                    type="number"
                    inputMode="decimal"
                    min={0.01}
                    max={120}
                    step={0.01}
                    placeholder="0.00"
                    aria-label={`${dog.name}の体重`}
                    value={weights[dog.id] ?? ""}
                    disabled={locked || saving}
                    onFocus={(event) => event.currentTarget.select()}
                    onChange={(event) => setWeights((current) => ({ ...current, [dog.id]: event.target.value }))}
                  />
                  <span className="w-6 shrink-0 text-sm text-muted">kg</span>
                </div>
              ))}
            </div>
            <Button type="button" className="mt-3 w-full" disabled={locked || saving} onClick={() => void onSaveWeights()}>
              体重を保存
            </Button>
          </section>
          <section className="rounded-lg border border-border bg-surface px-3 py-2 shadow-card">
            <p className="text-sm font-medium text-fg">ごはん</p>
            <div className="mt-2 flex flex-col gap-3">
              {dogs.map((dog) => (
                <div key={dog.id}>
                  <p className="truncate text-sm text-fg">{dog.name}</p>
                  {dog.staples.length === 0 ? (
                    <p className="mt-1 text-xs text-muted">定番がありません</p>
                  ) : (
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {dog.staples.map((staple) => (
                        <button
                          key={staple.id}
                          type="button"
                          disabled={locked || busyDog === dog.id}
                          className="rounded-full border border-border bg-surface-2 px-2.5 py-1 text-xs font-medium text-fg disabled:opacity-50"
                          onClick={() => void onStaple(dog, staple.id)}
                        >
                          + {staple.name} {formatQuantity(staple.qty, staple.unit)}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}
