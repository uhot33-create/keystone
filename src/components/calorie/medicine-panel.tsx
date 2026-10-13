/**
 * わんカロリーのおくすり画面。
 * 薬ごとに毎日の予定時刻を登録し、「投与した」でその日は済みになる。
 * ホームの案内は、予定時刻を過ぎて未投与のものだけ。1日1回まで。
 * 機能追加日は app_settings.medicine_added_on。その日以前は「—」、以降は「済」か「未」。
 */
import { useState } from "react";
import { deleteDogMedicine, giveDogMedicine, saveDogMedicine, undoDogMedicine } from "@/lib/calorie/api";
import type { CalorieState, DogMedicine } from "@/lib/calorie/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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
  const pick = (type: string) => parts.find((part) => part.type === type)?.value ?? "00";
  return { date: `${pick("year")}-${pick("month")}-${pick("day")}`, clock: `${pick("hour")}:${pick("minute")}` };
}

/** 機能追加日以前なら true。日付は app_settings の値と比較する。 */
export function beforeMedicineFeature(date: string, addedOn: string | null): boolean {
  return Boolean(addedOn && date <= addedOn);
}

/** 予定時刻を過ぎて、その日まだ投与していない薬。機能追加前・時刻なし・未来日は含めない。 */
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
  const medicines = state.medicines ?? [];
  const beforeFeature = beforeMedicineFeature(state.date, state.medicineAddedOn);
  const waiting = medicines.filter((item) => !item.givenAt).length;

  function resetForm() {
    setEditing(null);
    setName("");
    setDueTime("");
    setNote("");
  }

  return (
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

      <button
        type="button"
        className="mt-2 text-xs font-medium text-primary"
        onClick={() => {
          setOpen((value) => !value);
          resetForm();
        }}
      >
        {open ? "閉じる" : "管理"}
      </button>
      {open ? (
        <div className="mt-2 space-y-2">
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
        </div>
      ) : null}
    </section>
  );
}