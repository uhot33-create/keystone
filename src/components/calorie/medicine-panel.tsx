/**
 * わんカロリーのおくすり画面。
 * 薬を登録し、表示中の日に「投与した」を押すとその日は済みになる。
 * 未投与はホームの案内からここへ来る。1日1回まで。取消でその日の記録だけ消える。
 */
import { useState } from "react";
import { deleteDogMedicine, giveDogMedicine, saveDogMedicine, undoDogMedicine } from "@/lib/calorie/api";
import type { CalorieState } from "@/lib/calorie/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function givenClock(iso: string): string {
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
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
  const [note, setNote] = useState("");
  const medicines = state.medicines ?? [];
  const waiting = medicines.filter((item) => !item.givenAt).length;

  function resetForm() {
    setEditing(null);
    setName("");
    setNote("");
  }

  return (
    <section className="rounded-lg border border-border bg-surface p-3 shadow-card">
      <div className="flex items-baseline justify-between gap-2">
        <p className="font-display text-base font-semibold text-fg">おくすり</p>
        <p className="text-xs text-muted">{waiting > 0 ? `未投与 ${waiting}` : medicines.length > 0 ? "投与済み" : ""}</p>
      </div>
      {medicines.length === 0 ? (
        <p className="mt-2 text-xs text-muted">薬を登録すると、その日に投与したかが分かります。</p>
      ) : (
        <ul className="mt-2 divide-y divide-border">
          {medicines.map((item) => (
            <li key={item.id} className="flex items-center gap-2 py-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-fg">{item.name}</p>
                {item.note ? <p className="truncate text-[11px] text-muted">{item.note}</p> : null}
              </div>
              {item.givenAt ? (
                <>
                  <span className="shrink-0 text-xs tabular-nums text-muted">済 {givenClock(item.givenAt)}</span>
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
              disabled={pending || !name.trim()}
              onClick={() =>
                void onRun(async () => {
                  const next = await saveDogMedicine({
                    data: {
                      date: state.date,
                      dogId: state.dog.id,
                      id: editing ?? undefined,
                      name: name.trim(),
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
