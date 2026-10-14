/**
 * アプリ内リンクや「検索」ボタンを押したとき、移動が長引いたら読み込み中を出す。
 * すぐ描画できる移動では出さない。20秒たっても残っていたら消す。
 */
import { useRouter } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { BusyOverlay } from "@/components/ui/busy-overlay";

/** ページ移動が 200ms を超えたときだけ BusyOverlay を出す。 */
export function NavBusy() {
  const router = useRouter();
  const [show, setShow] = useState(false);
  const timer = useRef<number | null>(null);

  function clearTimer() {
    if (timer.current == null) return;
    window.clearTimeout(timer.current);
    timer.current = null;
  }

  useEffect(() => {
    return router.subscribe("onRendered", () => {
      clearTimer();
      setShow(false);
    });
  }, [router]);

  useEffect(() => {
    if (!show) return;
    const id = window.setTimeout(() => setShow(false), 20000);
    return () => window.clearTimeout(id);
  }, [show]);

  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      const link = target.closest("a");
      const button = target.closest("button");
      const search = button instanceof HTMLButtonElement && (button.textContent ?? "").includes("検索");
      const move = link instanceof HTMLAnchorElement && isAppNavigation(link);
      if (!search && !move) return;
      const before = location.href;
      clearTimer();
      timer.current = window.setTimeout(() => {
        timer.current = null;
        if (location.href === before && !router.state.isLoading) return;
        setShow(true);
      }, 200);
    }

    document.addEventListener("click", onClick, true);
    return () => {
      document.removeEventListener("click", onClick);
      clearTimer();
    };
  }, [router]);

  return <BusyOverlay show={show} label="読み込み中…" />;
}

function isAppNavigation(link: HTMLAnchorElement) {
  if (link.target === "_blank" || link.hasAttribute("download")) return false;
  let url: URL;
  try {
    url = new URL(link.href, location.href);
  } catch {
    return false;
  }
  if (url.origin !== location.origin) return false;
  return url.pathname !== location.pathname || url.search !== location.search;
}