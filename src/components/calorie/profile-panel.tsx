/**
 * 「プロフィール」タブです。名前・現在体重・理想体重を dogs に保存します。
 * 理想体重を変えると、プランの1日の目安（dailyEnergy）とグラフの点線も作り直されます。
 * ライフステージとおやつ割合はこの画面では変えず、いまの値のまま保存します。
 * 多頭飼いは最大10頭（addDog）。最後の1頭は deleteDog が拒否します。
 * 体重の表示桁は kgText（小数2桁）。入力の上限120kgは api.ts の saveDogInput です。
 * 追加時の仮名は「うちの子2」のように頭数+1です。名前が空だと「うちの子」で保存します。
 */
import { useEffect, useState, type FormEvent } from "react";
import { addDog, deleteDog, saveDogPortrait, saveDogProfile, savePersonPortrait } from "@/lib/calorie/api";
import { DOG_PORTRAITS, PERSON_PORTRAITS } from "@/lib/calorie/portraits";
import type { CalorieState } from "@/lib/calorie/types";
import { Button } from "@/components/ui/button";
import { BusyOverlay } from "@/components/ui/busy-overlay";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** 体重を小数2桁の文字列にします。0以下は空欄（未入力）です。桁を変えると入力欄の見た目が変わります。 */
function kgText(value: number): string {
  if (!(value > 0)) return "";
  return (Math.round(value * 100) / 100).toFixed(2);
}

/**
 * 名前・体重の保存と、子の追加・削除です。追加の上限10頭と「最後の1頭は消せない」はサーバー側のチェックです。
 * ここだけ文言を変えても、11頭目は addDog がエラーにします。
 */
export function ProfilePanel({
  state,
  onChange,
  onOpenPlan,
  onOpenFoods,
}: {
  state: CalorieState;
  onChange: (next: CalorieState) => void;
  onOpenPlan?: () => void;
  onOpenFoods?: () => void;
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
            dogId: dog.id,
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
      <BusyOverlay show={pending} label="保存中…" />
      {onOpenPlan && onOpenFoods ? (
        <div className="flex gap-2">
          <Button type="button" variant="outline" className="flex-1" onClick={onOpenPlan}>
            プラン
          </Button>
          <Button type="button" variant="outline" className="flex-1" onClick={onOpenFoods}>
            フード
          </Button>
        </div>
      ) : null}
      <div className="rounded-xl border border-border bg-surface p-5 shadow-card">
        <div className="space-y-4">
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
              min={0.01}
              step={0.01}
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
              min={0.01}
              step={0.01}
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
      <div className="rounded-xl border border-border bg-surface p-5 shadow-card">
        <p className="font-display text-lg font-semibold text-fg">絵</p>
        <p className="mt-1 text-sm text-muted">メニューの犬と人を、テンプレートから選びます。</p>
        <p className="mt-4 text-sm font-medium text-fg">犬の絵</p>
        <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
          {DOG_PORTRAITS.map((item) => {
            const active = dog.portraitId === item.id;
            return (
              <button
                key={item.id}
                type="button"
                disabled={pending}
                aria-pressed={active}
                className={`w-16 shrink-0 text-center ${active ? "text-primary" : "text-muted"}`}
                onClick={() => {
                  if (active) return;
                  setPending(true);
                  setError(null);
                  setMessage(null);
                  void saveDogPortrait({ data: { date: state.date, dogId: dog.id, portraitId: item.id } })
                    .then((next) => {
                      onChange(next);
                      setMessage("犬の絵を保存しました");
                    })
                    .catch((err: unknown) => setError(err instanceof Error ? err.message : "保存できませんでした"))
                    .finally(() => setPending(false));
                }}
              >
                <img
                  src={item.src}
                  alt={item.label}
                  className={`h-16 w-16 rounded-md object-cover ${active ? "ring-2 ring-primary" : "ring-1 ring-border"}`}
                />
                <span className="mt-1 block text-[10px] leading-tight">{item.label}</span>
              </button>
            );
          })}
        </div>
        <p className="mt-4 text-sm font-medium text-fg">人の絵</p>
        <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
          {PERSON_PORTRAITS.map((item) => {
            const active = state.personPortrait === item.id;
            return (
              <button
                key={item.id}
                type="button"
                disabled={pending}
                aria-pressed={active}
                className={`w-16 shrink-0 text-center ${active ? "text-primary" : "text-muted"}`}
                onClick={() => {
                  if (active) return;
                  setPending(true);
                  setError(null);
                  setMessage(null);
                  void savePersonPortrait({ data: { date: state.date, dogId: dog.id, portraitId: item.id } })
                    .then((next) => {
                      onChange(next);
                      setMessage("人の絵を保存しました");
                    })
                    .catch((err: unknown) => setError(err instanceof Error ? err.message : "保存できませんでした"))
                    .finally(() => setPending(false));
                }}
              >
                <img
                  src={item.src}
                  alt={item.label}
                  className={`h-16 w-16 rounded-md object-cover ${active ? "ring-2 ring-primary" : "ring-1 ring-border"}`}
                />
                <span className="mt-1 block text-[10px] leading-tight">{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>
      <div className="rounded-xl border border-border bg-surface p-5 shadow-card">
        <p className="font-display text-lg font-semibold text-fg">多頭飼い</p>
        <p className="mt-1 text-sm text-muted">子ごとに記録・フード・体重を分けて残せます。</p>
        <Button
          type="button"
          variant="outline"
          className="mt-4 w-full"
          disabled={pending || state.dogs.length >= 10}
          onClick={() => {
            const nextName = `うちの子${state.dogs.length + 1}`;
            setPending(true);
            setError(null);
            setMessage(null);
            void addDog({ data: { date: state.date, name: nextName } })
              .then((next) => {
                onChange(next);
                setMessage(`${next.dog.name} を追加しました。名前を保存してください。`);
              })
              .catch((err: unknown) => setError(err instanceof Error ? err.message : "追加できませんでした"))
              .finally(() => setPending(false));
          }}
        >
          子を追加
        </Button>
        {state.dogs.length > 1 ? (
          <Button
            type="button"
            variant="ghost"
            className="mt-2 w-full text-danger"
            disabled={pending}
            onClick={() => {
              if (!window.confirm(`${dog.name} の記録・フードも削除します。よろしいですか？`)) return;
              setPending(true);
              setError(null);
              setMessage(null);
              void deleteDog({ data: { date: state.date, dogId: dog.id } })
                .then((next) => {
                  onChange(next);
                  setMessage("削除しました");
                })
                .catch((err: unknown) => setError(err instanceof Error ? err.message : "削除できませんでした"))
                .finally(() => setPending(false));
            }}
          >
            この子を削除
          </Button>
        ) : (
          <p className="mt-3 text-xs text-subtle">最後の1頭は削除できません。</p>
        )}
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
