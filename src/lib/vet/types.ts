/**
 * 通院の選択肢と、1件分のデータの形。
 * 画面は一覧・新規・編集。種類のプルダウンは VISIT_KINDS。
 * 予定は planned、履歴は done。次回の状態は need（要予約）と booked（予約済）。
 * 種類を増やすときは VISIT_KINDS に日本語を足す。DB は文字列のまま保存する。
 */
/** 通院の種類。表示ラベルそのものが保存値。 */
export const VISIT_KINDS = ["定期健診", "予防接種", "病気", "けが", "歯科", "その他"] as const;
/** VISIT_KINDS のどれか。 */
export type VisitKind = (typeof VISIT_KINDS)[number];

/** 記録の状態。planned は予定、done は済んだ履歴。 */
export const VISIT_STATUSES = ["planned", "done"] as const;
/** planned か done。 */
export type VisitStatus = (typeof VISIT_STATUSES)[number];

/** 次回・予約の状態。need は要予約、booked は予約済。 */
export const NEXT_VISIT_STATUSES = ["need", "booked"] as const;
/** need か booked。 */
export type NextVisitStatus = (typeof NEXT_VISIT_STATUSES)[number];

/** 予約状態を画面に出す日本語。 */
export const NEXT_VISIT_STATUS_LABEL: Record<NextVisitStatus, string> = {
  need: "要予約",
  booked: "予約済",
};

/** 通院1件。日付は YYYY-MM-DD、時刻は HH:mm か null。 */
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

/** 文字列が VISIT_KINDS に入っているか。 */
export function isVisitKind(value: string): value is VisitKind {
  return (VISIT_KINDS as readonly string[]).includes(value);
}

/** planned か done か。 */
export function isVisitStatus(value: string): value is VisitStatus {
  return (VISIT_STATUSES as readonly string[]).includes(value);
}

/** need か booked か。 */
export function isNextVisitStatus(value: string): value is NextVisitStatus {
  return (NEXT_VISIT_STATUSES as readonly string[]).includes(value);
}
