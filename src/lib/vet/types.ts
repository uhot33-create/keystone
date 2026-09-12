export const VISIT_KINDS = ["定期健診", "予防接種", "病気", "けが", "歯科", "その他"] as const;
export type VisitKind = (typeof VISIT_KINDS)[number];

export type VetVisit = {
  id: string;
  visitOn: string;
  clinicName: string | null;
  kind: VisitKind;
  title: string;
  diagnosis: string | null;
  treatment: string | null;
  nextVisitOn: string | null;
  costYen: number | null;
  note: string | null;
};

export function isVisitKind(value: string): value is VisitKind {
  return (VISIT_KINDS as readonly string[]).includes(value);
}
