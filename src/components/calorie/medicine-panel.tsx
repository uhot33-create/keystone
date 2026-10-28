/**
 * わんカロリーのおくすり画面。
 * 薬ごとに毎日の予定時刻を登録し、「投与した」でその日は済みになる。
 * その下の手入れは毎日ではない。ブラッシングや歯磨きなど、最後にやった日だけ残す。未完了の案内は出さない。
 * 機能追加日は app_settings.medicine_added_on。その日以前は「—」、以降は「済」か「未」。
 * TodayPanel の「お世話」と、暮らし帳の未投与案内（overdueMedicines）から開く。
 * 薬は save / give / undo / deleteDogMedicine、手入れは save / mark / undo / deleteDogCare。
 * 遅れの条件を変えるなら overdueMedicines。チップの候補は CARE_SUGGESTIONS。
 */
import { useState } from "react";
import { createPortal } from "react-dom";
import { deleteDogCare, deleteDogMedicine, giveDogMedicine, markDogCare, saveDogCare, saveDogMedicine, undoDogCare, undoDogMedicine } from "@/lib/calorie/api";
import type { CalorieState, DogMedicine } from "@/lib/calorie/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * いまを日本時間の日付（YYYY-MM-DD）と時刻（HH:mm）にする。投与遅れの比較にだけ使う。
 * タイムゾーンを変えるなら timeZone。秒は見ない。
 */
function jstNow(now: Date): { date: string; clock: string } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  /**
   * Intl の部品から年・月・日・時・分を取る。無い部品は 00。秒は見ない。
   * 投与遅れの比較だけ。画面の「—」は medicine_added_on 側。
   * タイムゾーンを変えるなら上の timeZone。
   */
  const pick = (type: string) => parts.find((part) => part.type === type)?.value ?? "00";
  return { date: `${pick("year")}-${pick("month")}-${pick("day")}`, clock: `${pick("hour")}:${pick("minute")}` };
}

/**
 * 機能追加日以前なら true。日付は app_settings.medicine_added_on と比較する。
 * おくすり画面で、その日以前は済／未を出さず「—」にする判定。
 * 境界の日を変えるならこの <=。日付の値そのものは medicineAddedOn（api.ts）。
 */
export function beforeMedicineFeature(date: string, addedOn: string | null): boolean {
  return Boolean(addedOn && date <= addedOn);
}

/** まだ登録していないとき、チップで足せる手入れ名。文言を足すと「○○を追加」が増える。 */
const CARE_SUGGESTIONS = ["ブラッシング", "歯磨き"];

/**
 * 最後にやった日を yyyy/M/d にする。空や日付でない値は「まだ」。
 * 表示だけ。保存形式は YYYY-MM-DD のまま。
 */
function formatDone(value: string | null): string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return "まだ";
  const [year, month, day] = value.split("-");
  return `${year}/${Number(month)}/${Number(day)}`;
}

/**
 * 予定時刻を過ぎて、その日まだ投与していない薬。機能追加前・時刻なし・未来日は含めない。
 * 暮らし帳と今日タブの「おくすりがまだです」がこの一覧を使う。due_time が空の薬は対象外。
 * medicine_added_on 当日以前は beforeMedicineFeature で落とす。時刻の比較は jstNow。
 */
export function overdueMedicines(
  medicines: DogMedicine[],
  date: string,
  addedOn: string | null,
  now = new Date(),
): DogMedicine[] {
  const jst = jstNow(now);
  return medicines.filter((item) => {
    if (beforeMedicineFeature(date, addedOn)) return false;
    if (item.givenAt || !item.dueTime) return false;
    if (date > jst.date) return false;
    if (date < jst.date) return true;
    return item.dueTime <= jst.clock;
  });
}

/**
 * おくすりと手入れの一覧と、下に固定する管理シート。保存は全部 onRun 経由。
 * 薬はその日の済／未（追加日以前は「—」）。手入れは最後にやった日だけで、未完了の案内は出さない。
 */
export function MedicinePanel({
  state,
  pending,
  onRun,
}: {
  state: CalorieState;
  pending: boolean;
  onRun: (action: () => Promise<CalorieState>, label?: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [dueTime, setDueTime] = useState("");
  const [note, setNote] = useState("");
  const [careName, setCareName] = useState("");
  const [careEditing, setCareEditing] = useState<number | null>(null);
  const medicines = state.medicines ?? [];
  const cares = state.cares ?? [];
  const today = jstNow(new Date()).date;
  // 未来日は手入れの「やった」を押せない。薬の済／未は選んでいる日のまま出す。
  const future = state.date > today;
  const beforeFeature = beforeMedicineFeature(state.date, state.medicineAddedOn);
  // 未投与の件数。機能追加前の見出しは「—」になり、この件数は使わない。
  const waiting = medicines.filter((item) => !item.givenAt).length;

  /**
 * 薬フォームと手入れフォームを、開閉と登録成功のときに空へ戻す。編集 id も捨てる。
 * おくすり画面の下の管理シート。保存先のテーブルは変えない。
 * 空にする項目を足すなら、上の useState とこの関数をセットで直す。
 */
  function resetForm() {
    setEditing(null);
    setName("");
    setDueTime("");
    setNote("");
    setCareEditing(null);
    setCareName("");
  }

  /**
   * 手入れの名前を saveDogCare で登録または更新する。空文字は無視。
   * id があればその行の更新。候補チップは id なしでこの関数を使う。
   */
  function saveCare(label: string, id?: number) {
    const trimmed = label.trim();
    if (!trimmed) return;
    void onRun(async () => {
      const next = await saveDogCare({
        data: { date: state.date, dogId: state.dog.id, id, name: trimmed },
      });
      setCareEditing(null);
      setCareName("");
      return next;
    });
  }

  return (
    <>
    <section className="rounded-lg border border-border bg-surface p-3 shadow-card">
      <div className="flex items-baseline justify-between gap-2">
        <p className="font-display text-base font-semibold text-fg">おくすり</p>
        <p className="text-xs text-muted">
          {beforeFeature ? "—" : waiting > 0 ? `未 ${waiting}` : medicines.length > 0 ? "済" : ""}
        </p>
      </div>
      {medicines.length === 0 ? (
        <p className="mt-2 text-xs text-muted">薬と時間を登録すると、時間を過ぎた未投与だけ案内します。</p>
      ) : (
        <ul className="mt-2 divide-y divide-border">
          {medicines.map((item) => (
            <li key={item.id} className="flex items-center gap-2 py-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-fg">
                  {item.dueTime ? <span className="mr-1.5 tabular-nums text-muted">{item.dueTime}</span> : null}
                  {item.name}
                </p>
                {item.note ? <p className="truncate text-[11px] text-muted">{item.note}</p> : null}
              </div>
              {beforeFeature ? (
                // 機能追加日以前はその日の済／未を付けない。時刻を過ぎても案内しない。
                <span className="shrink-0 text-xs tabular-nums text-muted">—</span>
              ) : item.givenAt ? (
                <>
                  <span className="shrink-0 text-xs font-medium text-fg">済</span>
                  <button
                    type="button"
                    className="shrink-0 text-xs font-medium text-primary"
                    disabled={pending}
                    onClick={() =>
                      void onRun(
                        () => undoDogMedicine({ data: { date: state.date, dogId: state.dog.id, id: item.id } }),
                        "取消中…",
                      )
                    }
                  >
                    取消
                  </button>
                </>
              ) : (
                <>
                  <span className="shrink-0 text-xs font-medium text-danger">未</span>
                  <Button
                  type="button"
                  size="sm"
                  disabled={pending}
                  onClick={() =>
                    void onRun(
                      () => giveDogMedicine({ data: { date: state.date, dogId: state.dog.id, id: item.id } }),
                      "記録中…",
                    )
                  }
                >
                  投与した
                </Button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
    <section className="mt-3 rounded-lg border border-border bg-surface p-3 shadow-card">
      <p className="font-display text-base font-semibold text-fg">手入れ</p>
      <p className="mt-1 text-xs text-muted">毎日でなくても、最後にやった日を残せます。</p>
      {cares.length === 0 ? null : (
        <ul className="mt-2 divide-y divide-border">
          {cares.map((item) => {
            const onThisDay = item.lastDoneOn === state.date;
            const later = Boolean(item.lastDoneOn && item.lastDoneOn > state.date);
            return (
              <li key={item.id} className="flex items-center gap-2 py-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-fg">{item.name}</p>
                  <p className="text-[11px] text-muted">最後 {formatDone(item.lastDoneOn)}</p>
                </div>
                {onThisDay ? (
                  // この日が最終日なら取消できる。undoDogCare は lastDoneOn を空に戻し、それ以前の日は残さない。
                  <>
                    <span className="shrink-0 text-xs font-medium text-fg">この日</span>
                    <button
                      type="button"
                      className="shrink-0 text-xs font-medium text-primary"
                      disabled={pending}
                      onClick={() =>
                        void onRun(
                          () => undoDogCare({ data: { date: state.date, dogId: state.dog.id, id: item.id } }),
                          "取消中…",
                        )
                      }
                    >
                      取消
                    </button>
                  </>
                ) : later ? null : (
                  // 最終日がこの日より後ならボタンを出さない（後の記録を潰さない）。未来日も「やった」を止める。
                  <Button
                    type="button"
                    size="sm"
                    disabled={pending || future}
                    onClick={() =>
                      void onRun(
                        () => markDogCare({ data: { date: state.date, dogId: state.dog.id, id: item.id } }),
                        "記録中…",
                      )
                    }
                  >
                    やった
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <div className="mt-2 flex flex-wrap gap-2">
        {CARE_SUGGESTIONS.filter((label) => !cares.some((item) => item.name === label)).map((label) => (
          <button
            key={label}
            type="button"
            className="rounded-full border border-border px-3 py-1 text-xs text-fg"
            disabled={pending}
            onClick={() => saveCare(label)}
          >
            {label}を追加
          </button>
        ))}
      </div>
    </section>
    {typeof document === "undefined"
      ? null
      : createPortal(
          // 画面下に固定する管理シート。薬は名前・時刻・用量、手入れは名前だけ。SSR では document が無いので出さない。
          <div className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-surface">
            {open ? (
              <div className="mx-auto max-h-[50vh] max-w-3xl space-y-2 overflow-y-auto px-5 pt-3">
                <Input
                  value={name}
                  maxLength={30}
                  placeholder="薬の名前"
                  aria-label="薬の名前"
                  onChange={(event) => setName(event.target.value)}
                />
                <Input
                  type="time"
                  value={dueTime}
                  aria-label="予定時刻"
                  onChange={(event) => setDueTime(event.target.value)}
                />
                <Input
                  value={note}
                  maxLength={40}
                  placeholder="用量など（任意）"
                  aria-label="用量"
                  onChange={(event) => setNote(event.target.value)}
                />
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    className="flex-1"
                    disabled={pending || !name.trim() || !dueTime}
                    onClick={() =>
                      void onRun(async () => {
                        const next = await saveDogMedicine({
                          data: {
                            date: state.date,
                            dogId: state.dog.id,
                            id: editing ?? undefined,
                            name: name.trim(),
                            dueTime,
                            note: note.trim(),
                          },
                        });
                        resetForm();
                        return next;
                      })
                    }
                  >
                    {editing ? "更新" : "登録"}
                  </Button>
                  {editing ? (
                    <Button type="button" variant="outline" size="sm" disabled={pending} onClick={resetForm}>
                      取消
                    </Button>
                  ) : null}
                </div>
                {medicines.length > 0 ? (
                  <ul className="divide-y divide-border">
                    {medicines.map((item) => (
                      <li key={item.id} className="flex items-center gap-2 py-1">
                        <p className="min-w-0 flex-1 truncate text-xs text-fg">
                          {item.dueTime ? `${item.dueTime} ` : ""}
                          {item.name}
                          {item.note ? ` ${item.note}` : ""}
                        </p>
                        <button
                          type="button"
                          className="shrink-0 text-xs font-medium text-primary"
                          disabled={pending}
                          onClick={() => {
                            setEditing(item.id);
                            setName(item.name);
                            setDueTime(item.dueTime ?? "");
                            setNote(item.note);
                          }}
                        >
                          編集
                        </button>
                        <button
                          type="button"
                          className="shrink-0 text-xs text-muted"
                          disabled={pending}
                          onClick={() =>
                            void onRun(
                              () => deleteDogMedicine({ data: { date: state.date, dogId: state.dog.id, id: item.id } }),
                              "削除中…",
                            )
                          }
                        >
                          削除
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
                <p className="pt-2 text-xs font-medium text-subtle">手入れ</p>
                <Input
                  value={careName}
                  maxLength={30}
                  placeholder="名前（爪切りなど）"
                  aria-label="手入れの名前"
                  onChange={(event) => setCareName(event.target.value)}
                />
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    className="flex-1"
                    disabled={pending || !careName.trim()}
                    onClick={() => saveCare(careName, careEditing ?? undefined)}
                  >
                    {careEditing ? "更新" : "登録"}
                  </Button>
                  {careEditing ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={pending}
                      onClick={() => {
                        setCareEditing(null);
                        setCareName("");
                      }}
                    >
                      取消
                    </Button>
                  ) : null}
                </div>
                {cares.length > 0 ? (
                  <ul className="divide-y divide-border">
                    {cares.map((item) => (
                      <li key={item.id} className="flex items-center gap-2 py-1">
                        <p className="min-w-0 flex-1 truncate text-xs text-fg">
                          {item.name}
                          <span className="ml-1 text-muted">最後 {formatDone(item.lastDoneOn)}</span>
                        </p>
                        <button
                          type="button"
                          className="shrink-0 text-xs font-medium text-primary"
                          disabled={pending}
                          onClick={() => {
                            setCareEditing(item.id);
                            setCareName(item.name);
                          }}
                        >
                          編集
                        </button>
                        <button
                          type="button"
                          className="shrink-0 text-xs text-muted"
                          disabled={pending}
                          onClick={() =>
                            void onRun(
                              () => deleteDogCare({ data: { date: state.date, dogId: state.dog.id, id: item.id } }),
                              "削除中…",
                            )
                          }
                        >
                          削除
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : null}
            <div className="mx-auto max-w-3xl px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              <Button
                type="button"
                variant={open ? "outline" : "default"}
                className="w-full"
                onClick={() => {
                  setOpen((value) => !value);
                  resetForm();
                }}
              >
                {open ? "閉じる" : "管理"}
              </Button>
            </div>
          </div>,
          document.body,
        )}
    <div className="h-20" aria-hidden />
    </>
  );
}