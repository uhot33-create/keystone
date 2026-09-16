import { getCalorieState } from "@/lib/calorie/api";
import type { CalorieState } from "@/lib/calorie/types";

const STORAGE_KEY = "calorie-dog-id";

export function storedDogId(): number | undefined {
  if (typeof window === "undefined") return undefined;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : undefined;
}

export function rememberDogId(id: number) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, String(id));
}

export function DogSwitcher({
  state,
  onChange,
  onBusy,
  onError,
}: {
  state: CalorieState;
  onChange: (next: CalorieState) => void;
  onBusy?: (label: string | null) => void;
  onError?: (message: string | null) => void;
}) {
  if (state.dogs.length < 2) return null;

  async function selectDog(dogId: number) {
    if (dogId === state.dog.id) return;
    onBusy?.("読み込み中…");
    onError?.(null);
    try {
      rememberDogId(dogId);
      onChange(await getCalorieState({ data: { date: state.date, dogId } }));
    } catch (err) {
      onError?.(err instanceof Error ? err.message : "読み込みに失敗しました");
    } finally {
      onBusy?.(null);
    }
  }

  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {state.dogs.map((dog) => {
        const active = dog.id === state.dog.id;
        return (
          <button
            key={dog.id}
            type="button"
            onClick={() => void selectDog(dog.id)}
            className={`shrink-0 rounded-full border px-3 py-1.5 text-sm ${
              active ? "border-primary bg-primary/10 font-medium text-primary" : "border-border bg-surface text-muted"
            }`}
          >
            {dog.name}
          </button>
        );
      })}
    </div>
  );
}
