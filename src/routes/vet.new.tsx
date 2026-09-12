import { createFileRoute } from "@tanstack/react-router";
import { VisitForm } from "@/components/vet/visit-form";

export const Route = createFileRoute("/vet/new")({ component: VetNew });

function VetNew() {
  return (
    <div className="stagger-in flex flex-1 flex-col gap-5">
      <div>
        <h1 className="font-display text-3xl font-semibold text-fg">通院を追加</h1>
        <p className="mt-1 text-sm text-muted">日付と目的だけでも残せます。</p>
      </div>
      <VisitForm />
    </div>
  );
}
