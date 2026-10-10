/**
 * 多頭飼いのとき、今日画面の上に出る犬の切り替えボタンです。
 * 2頭以上いるときだけ表示します。1頭のときは何も出しません。
 * 選んだ犬の id はブラウザの localStorage（キー calorie-dog-id）に残し、
 * 次に /calorie を開いたときの初期表示に使います。
 * キー名を変えると、保存済みの選択は忘れられて先頭の犬に戻ります。
 * 犬の追加・削除そのものはプロフィール画面（profile-panel）側です。
 */
import { getCalorieState } from "@/lib/calorie/api";
import type { CalorieState } from "@/lib/calorie/types";

/** localStorage のキーです。変えると前回選んだ犬を忘れます。 */
const STORAGE_KEY = "calorie-dog-id";

/** 保存済みの犬 id。サーバー側や未保存のときは undefined（先頭の犬になります）。 */
export function storedDogId(): number | undefined {
  if (typeof window === "undefined") return undefined;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : undefined;
}

/** 選んだ犬を覚えます。次に画面を開いた loader が storedDogId で読みます。 */
export function rememberDogId(id: number) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, String(id));
}

/**
 * 犬の名前ボタンです。押すとその犬の getCalorieState を取り直し、画面全体を差し替えます。
 * 2頭未満では何も描きません。ボタンの見た目（丸ピル）を変えても選ばれる犬は変わりません。
 */
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
