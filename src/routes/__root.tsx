/**
 * 全ページの土台。html・フォント・認証・配色・プレビュー橋をここで包む。
 * タイトルは APP_NAME。フォント URL と theme-color はこの head。色の実体は styles.css。
 * 配色の初期化は THEME_BOOT_SCRIPT。ログイン状態は fetchSessionUser。
 */
import { createServerFn } from "@tanstack/react-start";
import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import { useEffect, useLayoutEffect } from "react";
import { AuthProvider } from "@/lib/auth/provider";
import { PreviewHostBridge } from "@/components/preview-host-bridge";
import { NavBusy } from "@/components/nav-busy";
import { ThemeProvider } from "@/components/theme-provider";
import { APP_NAME, APP_TAGLINE } from "@/lib/app-meta";
import { getUserSettings } from "@/lib/desk/settings";
import type { DeskVisibility } from "@/lib/desk/visibility";
import { holdRouteContext, peekRouteContext } from "@/lib/route-context";
import { THEME_BOOT_SCRIPT } from "@/lib/theme";
import appCss from "../styles.css?url";

/** セッションの id と email だけ返す。未ログインは null。判定の中身は verify.server.ts。 */
const fetchSessionUser = createServerFn({ method: "GET" }).handler(async () => {
  const { getSessionUser } = await import("@/lib/auth/verify.server");
  const u = await getSessionUser();
  return u ? { id: u.id, email: u.email } : null;
});

/** ルート経路。セッションと机の設定を読み、head のメタ情報を置く。 */
export const Route = createRootRoute({
  /** 子へ渡すセッションと机。ブラウザにキャッシュがあればそれを使い、無ければ取り直す。 */
  beforeLoad: async () => {
    if (typeof window !== "undefined") {
      const cached = peekRouteContext();
      if (cached) return cached;
    }
    try {
      const sessionUser = await fetchSessionUser();
      const ctx = {
        sessionUser,
        desk: sessionUser
          ? await getUserSettings().catch(() => null as DeskVisibility | null)
          : (null as DeskVisibility | null),
      };
      if (typeof window !== "undefined") holdRouteContext(ctx);
      return ctx;
    } catch {
      return { sessionUser: null, desk: null as DeskVisibility | null };
    }
  },
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: APP_NAME },
      { name: "description", content: APP_TAGLINE },
      { name: "theme-color", content: "#F3EFE8" },
      { name: "color-scheme", content: "light" },
      { name: "apple-mobile-web-app-title", content: APP_NAME },
      { name: "apple-mobile-web-app-capable", content: "yes" },
    ],
    links: [
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/__grok/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+JP:wght@400;500;600&family=Shippori+Mincho:wght@500;600;700&display=swap",
      },
    ],
  }),
  component: RootDocument,
});

/** html 全体。配色は ThemeProvider、認証は AuthProvider。子ページは Outlet。 */
function RootDocument() {
  const { sessionUser, desk } = Route.useRouteContext();
  /** このページで確定したセッションと机の設定を、次の遷移用に残す。中身は route-context.ts。 */
  useLayoutEffect(() => {
    holdRouteContext({ sessionUser, desk });
  }, [sessionUser, desk]);

  /** タッチ端末だけ、長押しメニューとドラッグ開始を止める。マウス操作では何もしない。 */
  useEffect(() => {
    if (!window.matchMedia("(pointer: coarse)").matches) return;
    const block = (event: Event) => event.preventDefault();
    document.addEventListener("contextmenu", block);
    document.addEventListener("dragstart", block);
    return () => {
      document.removeEventListener("contextmenu", block);
      document.removeEventListener("dragstart", block);
    };
  }, []);

  return (
    <html lang="ja" suppressHydrationWarning>
      <head>
        <HeadContent />
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
      </head>
      <body className="antialiased">
        <PreviewHostBridge />
        <ThemeProvider>
          <AuthProvider>
            <NavBusy />
            <Outlet />
          </AuthProvider>
        </ThemeProvider>
        <Scripts />
      </body>
    </html>
  );
}
