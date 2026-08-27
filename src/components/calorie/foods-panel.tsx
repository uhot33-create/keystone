import { Trash2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { addDogFood, deleteDogFood } from "@/lib/calorie/api";
import { FOOD_UNITS, formatQuantity } from "@/lib/calorie/formula";
import type { CalorieState, FoodKind } from "@/lib/calorie/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

export function FoodsPanel({
  state,
  onChange,
}: {
  state: CalorieState;
  onChange: (next: CalorieState) => void;
}) {
  const [foodName, setFoodName] = useState("");
  const [foodKind, setFoodKind] = useState<FoodKind>("food");
  const [foodKcal, setFoodKcal] = useState("");
  const [foodAmount, setFoodAmount] = useState("100");
  const [foodUnit, setFoodUnit] = useState("g");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onAdd(event: FormEvent) {
    event.preventDefault();
    const kcal = Number(foodKcal);
    const amount = Number(foodAmount);
    if (!foodName.trim() || !(kcal > 0) || !(amount > 0)) {
      setError("名前とカロリー、分量を入力してください");
      return;
    }
    setPending(true);
    setError(null);
    try {
      onChange(
        await addDogFood({
          data: {
            date: state.date,
            name: foodName.trim(),
            kind: foodKind,
            kcal,
            amount,
            unit: foodUnit as (typeof FOOD_UNITS)[number],
          },
        }),
      );
      setFoodName("");
      setFoodKcal("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "登録できませんでした");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <form className="rounded-xl border border-border bg-surface p-5 shadow-card" onSubmit={onAdd}>
        <p className="font-display text-lg font-semibold text-fg">フードを登録</p>
        <p className="mt-1 text-sm text-muted">カロリーと単位を登録すると、今日の記録で数量から換算できます。</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="food-name">名前</Label>
            <Input id="food-name" value={foodName} onChange={(event) => setFoodName(event.target.value)} />
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
              <option value="food">ごはん</option>
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
            <Select id="food-unit" value={foodUnit} onChange={(event) => setFoodUnit(event.target.value)}>
              {FOOD_UNITS.map((unit) => (
                <option key={unit} value={unit}>
                  {unit}
                </option>
              ))}
            </Select>
          </div>
        </div>
        <Button type="submit" className="mt-4 w-full" disabled={pending}>
          この内容で登録
        </Button>
      </form>

      <div className="rounded-xl border border-border bg-surface p-5 shadow-card">
        <p className="font-display text-lg font-semibold text-fg">登録済み</p>
        {state.foods.length === 0 ? (
          <p className="mt-3 text-sm text-muted">まだありません。</p>
        ) : (
          <ul className="mt-3 divide-y divide-border">
            {state.foods.map((food) => (
              <li key={food.id} className="flex items-center gap-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-fg">{food.name}</p>
                  <p className="text-xs text-subtle">
                    {food.kind === "treat" ? "おやつ" : "ごはん"} · {food.kcal}kcal / {formatQuantity(food.amount, food.unit)}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-10 min-h-10 text-muted"
                  aria-label={`${food.name}を削除`}
                  disabled={pending}
                  onClick={() =>
                    void deleteDogFood({ data: { date: state.date, id: food.id } })
                      .then(onChange)
                      .catch((err: unknown) => setError(err instanceof Error ? err.message : "削除できませんでした"))
                  }
                >
                  <Trash2 />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {error ? (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
