/**
 * 通院の予定と履歴を入力するフォーム。
 * 画面は /vet/new と /vet/$id/edit。保存や削除のあと /vet に戻る。
 * 上の切替で予定（planned）と履歴（done）を選ぶ。予定中は診断・費用を出さない。
 * 予約済は次回の日付が必須。要予約は日付なしでも保存できる。費用は0以上の整数。
 */
import { useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { deleteVetVisit, saveVetVisit } from "@/lib/vet/api";
import { NEXT_VISIT_STATUSES, NEXT_VISIT_STATUS_LABEL, VISIT_KINDS, type NextVisitStatus, type VetVisit, type VisitKind, type VisitStatus } from "@/lib/vet/types";
import { todayJst } from "@/lib/walk/age";
import { Button } from "@/components/ui/button";
import { BusyOverlay } from "@/components/ui/busy-overlay";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { DoctorMemoCopy } from "@/components/vet/doctor-memo";

/** visit があれば編集、無ければ新規。initialStatus は新規の初期タブ。 */
export function VisitForm({
  visit,
  initialStatus = "done",
}: {
  visit?: VetVisit;
  initialStatus?: VisitStatus;
}) {
  const navigate = useNavigate();
  const today = todayJst();
  const [status, setStatus] = useState<VisitStatus>(visit?.status ?? initialStatus);
  const [visitOn, setVisitOn] = useState(visit?.visitOn ?? today);
  const [visitTime, setVisitTime] = useState(visit?.visitTime ?? "");
  const [clinicName, setClinicName] = useState(visit?.clinicName ?? "");
  const [kind, setKind] = useState<VisitKind>(visit?.kind ?? "定期健診");
  const [title, setTitle] = useState(visit?.title ?? "");
  const [diagnosis, setDiagnosis] = useState(visit?.diagnosis ?? "");
  const [treatment, setTreatment] = useState(visit?.treatment ?? "");
  const [booking, setBooking] = useState<NextVisitStatus | "">(visit?.status === "done" ? (visit.nextVisitStatus ?? "") : "");
  const [planBooking, setPlanBooking] = useState<NextVisitStatus | "">(
    visit?.status === "planned" ? (visit.nextVisitStatus ?? "") : "",
  );
  const [nextVisitOn, setNextVisitOn] = useState(visit?.nextVisitOn ?? "");
  const [nextVisitTime, setNextVisitTime] = useState(visit?.nextVisitTime ?? "");
  const [costYen, setCostYen] = useState(visit?.costYen != null ? String(visit.costYen) : "");
  const [note, setNote] = useState(visit?.note ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const planned = status === "planned";

  async function save(nextStatus: VisitStatus) {
    const cost = costYen.trim() === "" ? null : Number(costYen);
    if (nextStatus === "done" && costYen.trim() !== "" && (!Number.isInteger(cost) || (cost ?? 0) < 0)) {
      setError("費用は0以上の整数で入力してください");
      return;
    }
    if (nextStatus === "done" && booking === "booked" && !nextVisitOn) {
      setError("予約済のときは日付を入力してください");
      return;
    }
    setPending(true);
    setError(null);
    try {
      await saveVetVisit({
        data: {
          id: visit?.id,
          visitOn,
          visitTime: nextStatus === "planned" && visitTime ? visitTime : null,
          clinicName: clinicName.trim() || null,
          kind,
          title: title.trim(),
          diagnosis: diagnosis.trim() || null,
          treatment: treatment.trim() || null,
          nextVisitOn: nextStatus === "done" && booking && nextVisitOn ? nextVisitOn : null,
          nextVisitTime: nextStatus === "done" && booking && nextVisitOn && nextVisitTime ? nextVisitTime : null,
          nextVisitStatus: nextStatus === "planned" ? planBooking || null : nextStatus === "done" && booking ? booking : null,
          costYen: nextStatus === "done" ? cost : null,
          note: note.trim() || null,
          status: nextStatus,
        },
      });
      await navigate({ to: "/vet" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存できませんでした");
    } finally {
      setPending(false);
    }
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    await save(status);
  }

  async function onDelete() {
    if (!visit || !window.confirm(planned ? "この予定を削除しますか？" : "この通院記録を削除しますか？")) return;
    setPending(true);
    setError(null);
    try {
      await deleteVetVisit({ data: { id: visit.id } });
      await navigate({ to: "/vet" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "削除できませんでした");
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={onSubmit}>
      <BusyOverlay show={pending} label="処理中…" />
      <div className="grid grid-cols-2 rounded-md bg-surface-2 p-1">
        <button
          type="button"
          className={`h-11 rounded-sm text-sm font-medium ${planned ? "bg-surface text-fg shadow-card" : "text-muted"}`}
          onClick={() => setStatus("planned")}
        >
          予定
        </button>
        <button
          type="button"
          className={`h-11 rounded-sm text-sm font-medium ${!planned ? "bg-surface text-fg shadow-card" : "text-muted"}`}
          onClick={() => setStatus("done")}
        >
          履歴
        </button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="visit-on">{planned ? "予定日" : "通院日"}</Label>
          <div className="flex gap-2">
            <Input id="visit-on" type="date" value={visitOn} required onChange={(e) => setVisitOn(e.target.value)} />
            {planned ? (
              <Input
                id="visit-time"
                type="time"
                value={visitTime}
                aria-label="予定時刻"
                onChange={(e) => setVisitTime(e.target.value)}
              />
            ) : null}
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="visit-kind">種類</Label>
          <Select id="visit-kind" value={kind} onChange={(e) => setKind(e.target.value as VisitKind)}>
            {VISIT_KINDS.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </Select>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="visit-title">目的・症状</Label>
        <Input
          id="visit-title"
          value={title}
          maxLength={50}
          required
          placeholder="フィラリア予防、咳が出る など"
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="visit-clinic">病院名</Label>
        <Input
          id="visit-clinic"
          value={clinicName}
          maxLength={40}
          placeholder="任意"
          onChange={(e) => setClinicName(e.target.value)}
        />
      </div>
      {planned ? (
        <div className="space-y-1.5">
          <Label>予約ステータス</Label>
          <div className="grid grid-cols-2 rounded-md bg-surface-2 p-1">
            {NEXT_VISIT_STATUSES.map((item) => (
              <button
                key={item}
                type="button"
                className={`h-9 rounded-sm text-sm font-medium ${planBooking === item ? "bg-surface text-fg shadow-card" : "text-muted"}`}
                onClick={() => setPlanBooking(item)}
              >
                {NEXT_VISIT_STATUS_LABEL[item]}
              </button>
            ))}
          </div>
        </div>
      ) : null}
      {!planned ? (
        <>
          <div className="space-y-1.5">
            <Label htmlFor="visit-diagnosis">診断</Label>
            <Input
              id="visit-diagnosis"
              value={diagnosis}
              maxLength={200}
              placeholder="任意"
              onChange={(e) => setDiagnosis(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="visit-treatment">処置・処方</Label>
            <Input
              id="visit-treatment"
              value={treatment}
              maxLength={200}
              placeholder="任意"
              onChange={(e) => setTreatment(e.target.value)}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>次回予約</Label>
              <div className="grid grid-cols-2 rounded-md bg-surface-2 p-1">
                {NEXT_VISIT_STATUSES.map((item) => (
                  <button
                    key={item}
                    type="button"
                    className={`h-9 rounded-sm text-sm font-medium ${booking === item ? "bg-surface text-fg shadow-card" : "text-muted"}`}
                    onClick={() => setBooking(item)}
                  >
                    {NEXT_VISIT_STATUS_LABEL[item]}
                  </button>
                ))}
              </div>
              {booking ? (
                <div className="flex gap-2">
                  <Input
                    id="visit-next"
                    type="date"
                    min={today}
                    aria-label="次回の日付"
                    required={booking === "booked"}
                    value={nextVisitOn}
                    onChange={(e) => setNextVisitOn(e.target.value)}
                  />
                  <Input
                    id="visit-next-time"
                    type="time"
                    aria-label="次回の時刻"
                    value={nextVisitTime}
                    onChange={(e) => setNextVisitTime(e.target.value)}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="shrink-0"
                    onClick={() => {
                      setBooking("");
                      setNextVisitOn("");
                      setNextVisitTime("");
                    }}
                  >
                    クリア
                  </Button>
                </div>
              ) : null}
              <p className="text-xs text-subtle">
                {booking === "booked"
                  ? "日付を入れると、次の予定カードができます。時刻は任意です。"
                  : booking === "need"
                    ? "要予約は日付がなくても保存できます。時刻は日付があるときだけ保存します。"
                    : "要予約か予約済を選ぶと、日付と時刻を入れられます。"}
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="visit-cost">費用（円）</Label>
              <Input
                id="visit-cost"
                type="number"
                inputMode="numeric"
                min={0}
                step={1}
                value={costYen}
                placeholder="任意"
                onChange={(e) => setCostYen(e.target.value)}
              />
            </div>
          </div>
        </>
      ) : null}
      <DoctorMemoCopy />
      <div className="space-y-1.5">
        <Label htmlFor="visit-note">メモ</Label>
        <Textarea
          id="visit-note"
          value={note}
          maxLength={1000}
          rows={4}
          placeholder="任意"
          onChange={(e) => setNote(e.target.value)}
        />
      </div>
      {error ? (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}
      <div className="flex flex-col gap-2">
        <Button type="submit" className="w-full" disabled={pending}>
          保存
        </Button>
        {planned && visit ? (
          <Button type="button" variant="outline" className="w-full" disabled={pending} onClick={() => void save("done")}>
            履歴として保存
          </Button>
        ) : null}
        <Button type="button" variant="outline" className="w-full" disabled={pending} onClick={() => void navigate({ to: "/vet" })}>
          キャンセル
        </Button>
        {visit ? (
          <Button type="button" variant="ghost" className="w-full text-danger" disabled={pending} onClick={() => void onDelete()}>
            削除
          </Button>
        ) : null}
      </div>
    </form>
  );
}
