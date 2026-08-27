import { useEffect, useState, type FormEvent } from "react";
import { saveDogProfile } from "@/lib/calorie/api";
import type { CalorieState } from "@/lib/calorie/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function kgText(value: number): string {
  if (!(value > 0)) return "";
  return String(Math.round(value * 10) / 10);
}

export function ProfilePanel({
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
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setName(dog.name);
    setCurrent(kgText(dog.currentWeightKg));
    setIdeal(kgText(dog.idealWeightKg));
  }, [dog]);

  async function onSave(event: FormEvent) {
    event.preventDefault();
    const currentKg = Number(current) || 0;
    const idealKg = Number(ideal) || 0;
    setPending(true);
    setError(null);
    setMessage(null);
    try {
      onChange(
        await saveDogProfile({
          data: {
            date: state.date,
            name: name.trim() || "うちの子",
            currentWeightKg: currentKg,
            idealWeightKg: idealKg,
            lifeStage: dog.lifeStage,
            treatRatio: dog.treatRatio,
          },
        }),
      );
      setMessage("プロフィールを保存しました");
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存できませんでした");
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="flex flex-col gap-5" onSubmit={onSave}>
      <div className="rounded-xl border border-border bg-surface p-5 shadow-card">
        <p className="font-display text-lg font-semibold text-fg">プロフィール</p>
        <p className="mt-1 text-sm text-muted">愛犬の名前と体重を残します。</p>
        <div className="mt-4 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="dog-name">名前</Label>
            <Input id="dog-name" value={name} maxLength={20} onChange={(event) => setName(event.target.value)} />
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
              required
            />
          </div>
        </div>
        <Button type="submit" className="mt-4 w-full" disabled={pending}>
          保存
        </Button>
      </div>
      {message ? <p className="text-sm text-accent">{message}</p> : null}
      {error ? (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}
    </form>
  );
}
