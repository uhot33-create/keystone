export const VISIT_KINDS = ["定期健診", "予防接種", "病気", "けが", "歯科", "その他"] as const;
export type VisitKind = (typeof VISIT_KINDS)[number];

export const VISIT_STATUSES = ["planned", "done"] as const;
export type VisitStatus = (typeof VISIT_STATUSES)[number];

export const NEXT_VISIT_STATUSES = ["need", "booked"] as const;
export type NextVisitStatus = (typeof NEXT_VISIT_STATUSES)[number];

export const NEXT_VISIT_STATUS_LABEL: Record<NextVisitStatus, string> = {
  need: "要予約",
  booked: "予約済",
};

export type VetVisit = {
  id: string;
  visitOn: string;
  visitTime: string | null;
  clinicName: string | null;
  kind: VisitKind;
  title: string;
  diagnosis: string | null;
  treatment: string | null;
  nextVisitOn: string | null;
  nextVisitTime: string | null;
  nextVisitStatus: NextVisitStatus | null;
  costYen: number | null;
  note: string | null;
  status: VisitStatus;
};

export function isVisitKind(value: string): value is VisitKind {
  return (VISIT_KINDS as readonly string[]).includes(value);
}

export function isVisitStatus(value: string): value is VisitStatus {
  return (VISIT_STATUSES as readonly string[]).includes(value);
}

export function isNextVisitStatus(value: string): value is NextVisitStatus {
  return (NEXT_VISIT_STATUSES as readonly string[]).includes(value);
}
