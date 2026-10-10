/**
 * 画面全体を覆う「処理中」表示。
 * 初期の文言は label の既定値。色は bg-bg や border（styles.css）。
 * ページ移動中は nav-busy.tsx から呼ばれる。
 */
/** show が true のときだけ、中央にスピナーと文言を出す。 */
export function BusyOverlay({
  show,
  label = "処理中…",
}: {
  show: boolean;
  label?: string;
}) {
  if (!show) return null;
  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-bg/55" role="status" aria-live="polite">
      <div className="flex items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3 shadow-card">
        <span className="size-5 animate-spin rounded-full border-2 border-border border-t-primary" aria-hidden="true" />
        <p className="text-sm text-fg">{label}</p>
      </div>
    </div>
  );
}
