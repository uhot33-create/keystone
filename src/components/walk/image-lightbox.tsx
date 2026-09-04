import { useEffect } from "react";
import { createPortal } from "react-dom";

export function ImageLightbox({
  src,
  alt,
  onClose,
}: {
  src: string;
  alt: string;
  onClose: () => void;
}) {
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

  if (typeof document === "undefined") return null;
  return createPortal(
    <div
      className="fixed inset-0 z-[80] grid place-items-center bg-fg/80"
      role="dialog"
      aria-modal="true"
      aria-label={alt}
      onClick={onClose}
    >
      <button
        type="button"
        className="absolute right-4 top-[max(1rem,env(safe-area-inset-top))] z-10 rounded-md border border-border bg-surface px-4 py-2 text-sm font-medium text-fg shadow-card"
        onClick={(event) => {
          event.stopPropagation();
          onClose();
        }}
      >
        閉じる
      </button>
      <img src={src} alt={alt} className="max-h-full max-w-full object-contain" />
    </div>,
    document.body,
  );
}
