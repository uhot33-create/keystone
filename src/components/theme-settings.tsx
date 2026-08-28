import { Settings2 } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import { useTheme } from "@/components/theme-provider";
import { THEMES, type ThemeId } from "@/lib/theme";
import { Button } from "@/components/ui/button";

export function ThemeSettings() {
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  function pick(next: ThemeId) {
    setTheme(next);
    setOpen(false);
  }

  return (
    <>
      <Button type="button" variant="ghost" size="icon" className="size-10 min-h-10 text-muted" aria-label="配色を変える" onClick={() => setOpen(true)}>
        <Settings2 />
      </Button>
      {open && typeof document !== "undefined"
        ? createPortal(
            <div className="fixed inset-0 z-50 grid place-items-center bg-fg/40 p-4" role="presentation" onClick={() => setOpen(false)}>
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                className="w-full max-w-sm rounded-xl border border-border bg-surface p-5 shadow-card-hover"
                onClick={(event) => event.stopPropagation()}
              >
                <p id={titleId} className="font-display text-lg font-semibold text-fg">
                  配色
                </p>
                <p className="mt-1 text-sm text-muted">季節の色に切り替えます。文字の読みやすさはそのままです。</p>
                <div className="mt-4 grid gap-2">
                  {THEMES.map((item) => {
                    const active = theme === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        className={[
                          "flex min-h-12 items-center gap-3 rounded-md border px-3 text-left",
                          active ? "border-primary bg-surface-2" : "border-border bg-surface hover:bg-surface-2",
                        ].join(" ")}
                        onClick={() => pick(item.id)}
                      >
                        <span className="flex size-8 overflow-hidden rounded-full border border-border">
                          <span className="h-full w-1/2" style={{ background: item.paper }} />
                          <span className="h-full w-1/2" style={{ background: item.swatch }} />
                        </span>
                        <span className="flex-1 font-medium text-fg">{item.label}</span>
                        {active ? <span className="text-xs text-muted">使用中</span> : null}
                      </button>
                    );
                  })}
                </div>
                <Button type="button" variant="outline" className="mt-4 w-full" onClick={() => setOpen(false)}>
                  閉じる
                </Button>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
