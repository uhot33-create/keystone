import { useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { deleteVetVisit, saveVetVisit } from "@/lib/vet/api";
import { VISIT_KINDS, type VetVisit, type VisitKind } from "@/lib/vet/types";
import { todayJst } from "@/lib/walk/age";
import { Button } from "@/components/ui/button";
import { BusyOverlay } from "@/components/ui/busy-overlay";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export function VisitForm({ visit }: { visit?: VetVisit }) {
  const navigate = useNavigate();
  const [visitOn, setVisitOn] = useState(visit?.visitOn ?? todayJst());
  const [clinicName, setClinicName] = useState(visit?.clinicName ?? "");
  const [kind, setKind] = useState<VisitKind>(visit?.kind ?? "定期健診");
  const [title, setTitle] = useState(visit?.title ?? "");
  const [diagnosis, setDiagnosis] = useState(visit?.diagnosis ?? "");
  const [treatment, setTreatment] = useState(visit?.treatment ?? "");
  const [nextVisitOn, setNextVisitOn] = useState(visit?.nextVisitOn ?? "");
  const [costYen, setCostYen] = useState(visit?.costYen != null ? String(visit.costYen) : "");
  const [note, setNote] = useState(visit?.note ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const cost = costYen.trim() === "" ? null : Number(costYen);
    if (costYen.trim() !== "" && (!Number.isInteger(cost) || (cost ?? 0) < 0)) {
      setError("費用は0以上の整数で入力してください");
      return;
    }
    setPending(true);
    setError(null);
    try {
      await saveVetVisit({
        data: {
          id: visit?.id,
          visitOn,
          clinicName: clinicName.trim() || null,
          kind,
          title: title.trim(),
          diagnosis: diagnosis.trim() || null,
          treatment: treatment.trim() || null,
          nextVisitOn: nextVisitOn || null,
          costYen: cost,
          note: note.trim() || null,
        },
      });
      await navigate({ to: "/vet" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存できませんでした");
    } finally {
      setPending(false);
    }
  }

  async function onDelete() {
    if (!visit || !window.confirm("この通院記録を削除しますか？")) return;
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
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="visit-on">通院日</Label>
          <Input id="visit-on" type="date" value={visitOn} required onChange={(e) => setVisitOn(e.target.value)} />
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
          <Label htmlFor="visit-next">次回予約</Label>
          <Input id="visit-next" type="date" value={nextVisitOn} onChange={(e) => setNextVisitOn(e.target.value)} />
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
