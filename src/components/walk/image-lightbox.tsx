/**
 * 写真を画面いっぱいに出すライトボックス。
 * カード一覧のサムネと、新規・編集フォームのプレビューから開く。
 * Escape か背景クリックで閉じる。開いているあいだは背景のスクロールを止める。
 * 「共有」は画像ファイルを iPhone の共有シートへ渡す。AirDrop で近くの人に渡せる。
 * 写真の最大は max-h-full / max-w-full。背景の濃さは bg-fg/80。
 */
import { useEffect, useRef, useState, type MouseEvent } from "react";
import { createPortal } from "react-dom";

/**
 * 共有シートに渡す拡張子。png / webp / gif 以外は jpg。
 * 画面はライトボックスの共有。中身の形式は fetch した blob.type。
 * 対応を増やすならこの分岐と fileName。
 */
function extOf(type: string): string {
  if (type.includes("png")) return "png";
  if (type.includes("webp")) return "webp";
  if (type.includes("gif")) return "gif";
  return "jpg";
}

/**
 * 共有ファイル名。alt から使えない文字を除き、空なら「写真」。
 * 画面はライトボックス。iPhone の共有シートに出す名前。
 * 禁止文字や長さを変えるなら replace と slice(0, 40)。
 */
function fileName(alt: string, type: string): string {
  const base = alt.replace(/[\\/:*?"<>|]/g, "").trim().slice(0, 40) || "写真";
  return `${base}.${extOf(type)}`;
}

/**
 * 表示中の src を File にする。ログイン Cookie 付き（credentials: include）で /api/walk/image を取る。
 * 失敗すると共有ボタン側が「写真を読み込めませんでした」。blob: のプレビューも同じ経路。
 */
async function imageFile(src: string, alt: string): Promise<File> {
  const response = await fetch(src, { credentials: "include" });
  if (!response.ok) throw new Error("写真を読み込めませんでした");
  const blob = await response.blob();
  const type = blob.type || "image/jpeg";
  return new File([blob], fileName(alt, type), { type });
}

/**
 * body 直下に出す。src は /api/walk/image か、フォームの blob: プレビュー。
 * 画面は一覧の拡大と、新規・編集のプレビュー。閉じるのは Escape・背景・閉じるボタン。
 * 共有の中身は imageFile。先読みは下の effect（iOS はタップ中に待つと共有が失敗する）。
 */
export function ImageLightbox({
  src,
  alt,
  onClose,
}: {
  src: string;
  alt: string;
  onClose: () => void;
}) {
  // 開いたときに先読みした共有用 File。未完了なら共有ボタン押下時に取り直す。
  const ready = useRef<File | null>(null);
  const [sharing, setSharing] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);

  // Escape で閉じ、開いているあいだ背景をスクロールさせない。
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  // iPhone は共有のタップ中に fetch すると、ユーザー操作の有効期限が切れてシートが開かない。
  // 開いた時点で File を先読みし ready に置く。src が変わるとやり直す。失敗したらボタン押下時に取り直す。
  useEffect(() => {
    let cancelled = false;
    ready.current = null;
    void imageFile(src, alt)
      .then((file) => {
        if (!cancelled) ready.current = file;
      })
      .catch(() => {
        if (!cancelled) ready.current = null;
      });
    return () => {
      cancelled = true;
    };
  }, [src, alt]);

  // iPhone の共有シート（AirDrop 含む）へ画像ファイルを渡す。URL 文字列ではなく File。
  // canShare が無い端末はエラー。ユーザーがシートを閉じた AbortError は黙って戻す。
  async function onShare(event: MouseEvent) {
    event.stopPropagation();
    if (sharing) return;
    setSharing(true);
    setShareError(null);
    try {
      const file = ready.current ?? (await imageFile(src, alt));
      const payload = { files: [file], title: alt };
      if (!navigator.share || !navigator.canShare?.(payload)) {
        throw new Error("この端末では共有シートを開けません");
      }
      await navigator.share(payload);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setShareError(err instanceof Error ? err.message : "共有できませんでした");
    } finally {
      setSharing(false);
    }
  }

  if (typeof document === "undefined") return null;
  return createPortal(
    <div
      className="fixed inset-0 z-[80] grid place-items-center bg-fg/80"
      role="dialog"
      aria-modal="true"
      aria-label={alt}
      onClick={onClose}
    >
      <div className="absolute inset-x-0 top-[max(1rem,env(safe-area-inset-top))] z-10 flex items-start justify-between gap-3 px-4">
        <button
          type="button"
          className="rounded-md border border-border bg-surface px-4 py-2 text-sm font-medium text-fg shadow-card disabled:opacity-60"
          disabled={sharing}
          onClick={(event) => void onShare(event)}
        >
          {sharing ? "開いています…" : "共有"}
        </button>
        <button
          type="button"
          className="rounded-md border border-border bg-surface px-4 py-2 text-sm font-medium text-fg shadow-card"
          onClick={(event) => {
            event.stopPropagation();
            onClose();
          }}
        >
          閉じる
        </button>
      </div>
      {shareError ? (
        <p className="absolute inset-x-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-10 rounded-md bg-surface px-3 py-2 text-center text-sm text-danger">
          {shareError}
        </p>
      ) : null}
      <img src={src} alt={alt} className="max-h-full max-w-full object-contain" />
    </div>,
    document.body,
  );
}
