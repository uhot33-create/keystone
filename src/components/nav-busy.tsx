import { useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { flushSync } from "react-dom";
import { BusyOverlay } from "@/components/ui/busy-overlay";

export function NavBusy() {
  const router = useRouter();
  const [show, setShow] = useState(false);

  useEffect(() => {
    return router.subscribe("onRendered", () => setShow(false));
  }, [router]);

  useEffect(() => {
    if (!show) return;
    const timer = window.setTimeout(() => setShow(false), 20000);
    return () => window.clearTimeout(timer);
  }, [show]);

  useEffect(() => {
    function reveal() {
      try {
        flushSync(() => setShow(true));
      } catch {
        setShow(true);
      }
    }

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
      reveal();
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          if (location.href === before && !router.state.isLoading) setShow(false);
        });
      });
    }

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
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
