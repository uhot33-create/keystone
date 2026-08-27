import { Trash2 } from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { addDogFood, deleteDogFood, saveDogProfile } from "@/lib/calorie/api";
import {
  FOOD_UNITS,
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
import type { CalorieState, FoodKind } from "@/lib/calorie/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

function kgText(value: number): string {
  if (!(value > 0)) return "";
  return String(Math.round(value * 10) / 10);
}

export function PlanPanel({
  state,
  onChange,
}: {
  state: CalorieState;
  onChange: (next: CalorieState) => void;
}) {
  const dog = state.dog;
  const [name, setName] = useState(dog.name);
  const [current, setCurrent] = useState(kgText(dog.currentWeightKg));
  const [ideal, setIdeal] = useState(kgText(dog.idealWeightKg));
  const [stage, setStage] = useState(dog.lifeStage);
  const [treatRatio, setTreatRatio] = useState(String(dog.treatRatio));
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [foodName, setFoodName] = useState("");
  const [foodKind, setFoodKind] = useState<FoodKind>("food");
  const [foodKcal, setFoodKcal] = useState("");
  const [foodAmount, setFoodAmount] = useState("100");
  const [foodUnit, setFoodUnit] = useState("g");

  useEffect(() => {
    setName(dog.name);
    setCurrent(kgText(dog.currentWeightKg));
    setIdeal(kgText(dog.idealWeightKg));
    setStage(dog.lifeStage);
    setTreatRatio(String(dog.treatRatio));
  }, [dog]);

  const currentKg = Number(current) || 0;
  const idealKg = Number(ideal) || 0;
  const ratio = Number(treatRatio) || 0.1;
  const target = dailyEnergy(idealKg, stage);
  const rer = Math.round(restingEnergy(idealKg));
  const { mealKcal, treatKcal } = splitMealsAndTreats(target, ratio);
  const suggestion = suggestedStage(currentKg, idealKg);

  const meals = useMemo(
    () => state.foods.filter((item) => item.kind === "food"),
    [state.foods],
  );
  const treats = useMemo(
    () => state.foods.filter((item) => item.kind === "treat"),
    [state.foods],
  );

  async function onSaveDog(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setMessage(null);
    try {
      const next = await saveDogProfile({
        data: {
          date: state.date,
          name: name.trim() || "うちの子",
          currentWeightKg: currentKg,
          idealWeightKg: idealKg,
          lifeStage: stage,
          treatRatio: ratio,
        },
      });
      onChange(next);
      setMessage("体重と目標を保存しました");
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存できませんでした");
    } finally {
      setPending(false);
    }
  }

  async function onAddFood(event: FormEvent) {
    event.preventDefault();
    const kcal = Number(foodKcal);
    const amount = Number(foodAmount);
    if (!foodName.trim() || !(kcal > 0) || !(amount > 0)) {
      setError("餌・おやつの名前とカロリーを入力してください");
      return;
    }
    setPending(true);
    setError(null);
    try {
      const next = await addDogFood({
        data: {
          date: state.date,
          name: foodName.trim(),
          kind: foodKind,
          kcal,
          amount,
          unit: foodUnit as (typeof FOOD_UNITS)[number],
        },
      });
      onChange(next);
      setFoodName("");
      setFoodKcal("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "登録できませんでした");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <form
        className="rounded-xl border border-border bg-surface p-5 shadow-card"
        onSubmit={onSaveDog}
      >
        <p className="font-display text-lg font-semibold text-fg">理想体重と必要カロリー</p>
        <p className="mt-1 text-sm text-muted">
          理想体重から1日に必要なカロリーを計算します。係数は安静時エネルギー × ライフステージです。
        </p>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="dog-name">愛犬の名前</Label>
            <Input
              id="dog-name"
              value={name}
              maxLength={20}
              onChange={(event) => setName(event.target.value)}
              placeholder="うちの子"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="current-kg">現在の体重（kg）</Label>
            <Input
              id="current-kg"
              type="number"
              inputMode="decimal"
              min={0.1}
              step={0.1}
              value={current}
              onChange={(event) => setCurrent(event.target.value)}
              placeholder="例 10.2"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ideal-kg">理想体重（kg）</Label>
            <Input
              id="ideal-kg"
              type="number"
              inputMode="decimal"
              min={0.1}
              step={0.1}
              value={ideal}
              onChange={(event) => setIdeal(event.target.value)}
              placeholder="例 8.5"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="life-stage">ライフステージ</Label>
            <Select
              id="life-stage"
              value={stage}
              onChange={(event) => setStage(event.target.value)}
            >
              {LIFE_STAGES.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="treat-ratio">おやつ割合</Label>
            <Select
              id="treat-ratio"
              value={treatRatio}
              onChange={(event) => setTreatRatio(event.target.value)}
            >
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
            <button
              type="button"
              className="ml-2 font-medium text-primary underline-offset-4 hover:underline"
              onClick={() => setStage(suggestion)}
            >
              合わせる
            </button>
          </div>
        ) : null}

        <div className="mt-5 rounded-md bg-surface-2 px-4 py-4">
          <p className="text-xs font-medium tracking-widest text-subtle">1日の目安</p>
          <p className="mt-1 font-display text-3xl font-semibold tabular-nums text-fg">
            {target > 0 ? `${target} kcal` : "—"}
          </p>
          <p className="mt-2 text-sm text-muted">
            安静時 {rer || "—"} kcal × {factorFor(stage).toFixed(1)}
            {idealKg > 0 ? `（理想 ${idealKg}kg）` : ""}
          </p>
          {target > 0 ? (
            <p className="mt-2 text-sm text-fg">
              餌 {mealKcal} kcal ／ おやつ {treatKcal} kcal
            </p>
          ) : null}
        </div>

        <Button type="submit" className="mt-4 w-full" disabled={pending}>
          体重と目標を保存
        </Button>
      </form>

      <form
        className="rounded-xl border border-border bg-surface p-5 shadow-card"
        onSubmit={onAddFood}
      >
        <p className="font-display text-lg font-semibold text-fg">餌・おやつを登録</p>
        <p className="mt-1 text-sm text-muted">
          表示カロリーと分量を登録すると、必要量を自動で計算します。
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="food-name">名前</Label>
            <Input
              id="food-name"
              value={foodName}
              onChange={(event) => setFoodName(event.target.value)}
              placeholder="例 ドライフード、ささみ"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="food-kind">種類</Label>
            <Select
              id="food-kind"
              value={foodKind}
              onChange={(event) => {
                const next = event.target.value === "treat" ? "treat" : "food";
                setFoodKind(next);
                setFoodAmount(next === "treat" ? "1" : "100");
                setFoodUnit(next === "treat" ? "個" : "g");
              }}
            >
              <option value="food">餌</option>
              <option value="treat">おやつ</option>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="food-kcal">カロリー（kcal）</Label>
            <Input
              id="food-kcal"
              type="number"
              inputMode="decimal"
              min={1}
              step={0.1}
              value={foodKcal}
              onChange={(event) => setFoodKcal(event.target.value)}
              placeholder="例 350"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="food-amount">分量</Label>
            <Input
              id="food-amount"
              type="number"
              inputMode="decimal"
              min={0.1}
              step={0.1}
              value={foodAmount}
              onChange={(event) => setFoodAmount(event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="food-unit">単位</Label>
            <Select
              id="food-unit"
              value={foodUnit}
              onChange={(event) => setFoodUnit(event.target.value)}
            >
              {FOOD_UNITS.map((unit) => (
                <option key={unit} value={unit}>
                  {unit}
                </option>
              ))}
            </Select>
          </div>
        </div>
        <Button type="submit" variant="outline" className="mt-4 w-full" disabled={pending}>
          この内容で登録
        </Button>
      </form>

      <div className="rounded-xl border border-border bg-surface p-5 shadow-card">
        <p className="font-display text-lg font-semibold text-fg">与える量の目安</p>
        {target <= 0 ? (
          <p className="mt-3 text-sm text-muted">理想体重を保存すると、必要量が表示されます。</p>
        ) : meals.length === 0 && treats.length === 0 ? (
          <p className="mt-3 text-sm text-muted">餌かおやつを登録すると、何g・何個まで与えられるか計算します。</p>
        ) : (
          <div className="mt-4 space-y-5">
            {meals.length > 0 ? (
              <div>
                <p className="text-xs font-medium tracking-widest text-subtle">
                  餌で {mealKcal} kcal をまかなう場合
                </p>
                <ul className="mt-2 divide-y divide-border">
                  {meals.map((food) => {
                    const qty = quantityForBudget(food.kcal, food.amount, mealKcal);
                    return (
                      <FoodLine
                        key={food.id}
                        name={food.name}
                        detail={`${food.kcal}kcal / ${food.amount}${food.unit}`}
                        quantity={formatQuantity(qty, food.unit)}
                        disabled={pending}
                        onDelete={() =>
                          void deleteDogFood({ data: { date: state.date, id: food.id } })
                            .then(onChange)
                            .catch((err: unknown) =>
                              setError(err instanceof Error ? err.message : "削除できませんでした"),
                            )
                        }
                      />
                    );
                  })}
                </ul>
              </div>
            ) : null}
            {treats.length > 0 ? (
              <div>
                <p className="text-xs font-medium tracking-widest text-subtle">
                  おやつで {treatKcal} kcal まで
                </p>
                <ul className="mt-2 divide-y divide-border">
                  {treats.map((food) => {
                    const qty = quantityForBudget(food.kcal, food.amount, treatKcal);
                    return (
                      <FoodLine
                        key={food.id}
                        name={food.name}
                        detail={`${food.kcal}kcal / ${food.amount}${food.unit}`}
                        quantity={formatQuantity(qty, food.unit)}
                        disabled={pending}
                        onDelete={() =>
                          void deleteDogFood({ data: { date: state.date, id: food.id } })
                            .then(onChange)
                            .catch((err: unknown) =>
                              setError(err instanceof Error ? err.message : "削除できませんでした"),
                            )
                        }
                      />
                    );
                  })}
                </ul>
              </div>
            ) : null}
            <p className="text-xs leading-relaxed text-subtle">
              おやつ同士は合計が目安内になるよう組み合わせてください。数値は目安です。体質や病気がある場合は獣医師の指示を優先してください。
            </p>
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

function FoodLine({
  name,
  detail,
  quantity,
  disabled,
  onDelete,
}: {
  name: string;
  detail: string;
  quantity: string;
  disabled: boolean;
  onDelete: () => void;
}) {
  return (
    <li className="flex items-center gap-3 py-2.5">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-fg">{name}</p>
        <p className="text-xs text-subtle">{detail}</p>
      </div>
      <p className="font-display text-lg font-semibold tabular-nums text-fg">{quantity}</p>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-10 min-h-10 text-muted"
        aria-label={`${name}を削除`}
        disabled={disabled}
        onClick={onDelete}
      >
        <Trash2 />
      </Button>
    </li>
  );
}
