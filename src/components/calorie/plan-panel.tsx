import { useEffect, useMemo, useState, type FormEvent } from "react";
import { saveDogProfile } from "@/lib/calorie/api";
import {
  LIFE_STAGES,
  TREAT_RATIOS,
  dailyEnergy,
  factorFor,
  formatQuantity,
  quantityForBudget,
  restingEnergy,
  splitMealsAndTreats,
  suggestedStage,
} from "@/lib/calorie/formula";
import type { CalorieState } from "@/lib/calorie/types";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

export function PlanPanel({
  state,
  onChange,
}: {
  state: CalorieState;
  onChange: (next: CalorieState) => void;
}) {
  const dog = state.dog;
  const [stage, setStage] = useState(dog.lifeStage);
  const [treatRatio, setTreatRatio] = useState(String(dog.treatRatio));
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setStage(dog.lifeStage);
    setTreatRatio(String(dog.treatRatio));
  }, [dog]);

  const ratio = Number(treatRatio) || 0.1;
  const target = dailyEnergy(dog.idealWeightKg, stage);
  const rer = Math.round(restingEnergy(dog.idealWeightKg));
  const { mealKcal, treatKcal } = splitMealsAndTreats(target, ratio);
  const suggestion = suggestedStage(dog.currentWeightKg, dog.idealWeightKg);
  const meals = useMemo(() => state.foods.filter((item) => item.kind === "food"), [state.foods]);
  const treats = useMemo(() => state.foods.filter((item) => item.kind === "treat"), [state.foods]);

  async function onSave(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setMessage(null);
    try {
      onChange(
        await saveDogProfile({
          data: {
            date: state.date,
            name: dog.name,
            currentWeightKg: dog.currentWeightKg,
            idealWeightKg: dog.idealWeightKg,
            lifeStage: stage,
            treatRatio: ratio,
          },
        }),
      );
      setMessage("プランを保存しました");
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存できませんでした");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <form className="rounded-xl border border-border bg-surface p-5 shadow-card" onSubmit={onSave}>
        <p className="font-display text-lg font-semibold text-fg">必要カロリー</p>
        <p className="mt-1 text-sm text-muted">理想体重から1日の目安を計算します。体重はプロフィールで変更できます。</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="life-stage">ライフステージ</Label>
            <Select id="life-stage" value={stage} onChange={(event) => setStage(event.target.value)}>
              {LIFE_STAGES.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="treat-ratio">おやつ割合</Label>
            <Select id="treat-ratio" value={treatRatio} onChange={(event) => setTreatRatio(event.target.value)}>
              {TREAT_RATIOS.map((item) => (
                <option key={item.value} value={String(item.value)}>
                  {item.label}
                </option>
              ))}
            </Select>
          </div>
        </div>
        {suggestion && suggestion !== stage ? (
          <div className="mt-4 rounded-md bg-surface-2 px-3 py-3 text-sm text-muted">
            現在体重が理想と離れているので、「
            {LIFE_STAGES.find((item) => item.id === suggestion)?.label}」が目安です。
            <button type="button" className="ml-2 font-medium text-primary underline-offset-4 hover:underline" onClick={() => setStage(suggestion)}>
              合わせる
            </button>
          </div>
        ) : null}
        <div className="mt-5 rounded-md bg-surface-2 px-4 py-4">
          <p className="text-xs font-medium tracking-widest text-subtle">1日の目安</p>
          <p className="mt-1 font-display text-3xl font-semibold tabular-nums text-fg">{target > 0 ? `${target} kcal` : "—"}</p>
          <p className="mt-2 text-sm text-muted">
            安静時 {rer || "—"} kcal × {factorFor(stage).toFixed(1)}
            {dog.idealWeightKg > 0 ? `（理想 ${dog.idealWeightKg}kg）` : ""}
          </p>
          {target > 0 ? (
            <p className="mt-2 text-sm text-fg">
              ごはん {mealKcal} kcal ／ おやつ {treatKcal} kcal
            </p>
          ) : null}
        </div>
        <Button type="submit" className="mt-4 w-full" disabled={pending}>
          プランを保存
        </Button>
      </form>

      <div className="rounded-xl border border-border bg-surface p-5 shadow-card">
        <p className="font-display text-lg font-semibold text-fg">与える量の目安</p>
        {target <= 0 ? (
          <p className="mt-3 text-sm text-muted">プロフィールで理想体重を保存すると、必要量が表示されます。</p>
        ) : meals.length === 0 && treats.length === 0 ? (
          <p className="mt-3 text-sm text-muted">フードタブで登録すると、何g・何個まで与えられるか計算します。</p>
        ) : (
          <div className="mt-4 space-y-5">
            {meals.length > 0 ? (
              <div>
                <p className="text-xs font-medium tracking-widest text-subtle">ごはんで {mealKcal} kcal をまかなう場合</p>
                <ul className="mt-2 divide-y divide-border">
                  {meals.map((food) => (
                    <li key={food.id} className="flex items-center gap-3 py-2.5">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm text-fg">{food.name}</p>
                        <p className="text-xs text-subtle">{food.kcal}kcal / {food.amount}{food.unit}</p>
                      </div>
                      <p className="font-display text-lg font-semibold tabular-nums text-fg">
                        {formatQuantity(quantityForBudget(food.kcal, food.amount, mealKcal), food.unit)}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {treats.length > 0 ? (
              <div>
                <p className="text-xs font-medium tracking-widest text-subtle">おやつで {treatKcal} kcal まで</p>
                <ul className="mt-2 divide-y divide-border">
                  {treats.map((food) => (
                    <li key={food.id} className="flex items-center gap-3 py-2.5">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm text-fg">{food.name}</p>
                        <p className="text-xs text-subtle">{food.kcal}kcal / {food.amount}{food.unit}</p>
                      </div>
                      <p className="font-display text-lg font-semibold tabular-nums text-fg">
                        {formatQuantity(quantityForBudget(food.kcal, food.amount, treatKcal), food.unit)}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        )}
      </div>
      {message ? <p className="text-sm text-accent">{message}</p> : null}
      {error ? (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
