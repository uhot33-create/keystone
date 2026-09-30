import { createServerFn } from "@tanstack/react-start";
import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import { useEffect } from "react";
import { AuthProvider } from "@/lib/auth/provider";
import { PreviewHostBridge } from "@/components/preview-host-bridge";
import { ThemeProvider } from "@/components/theme-provider";
import { APP_NAME, APP_TAGLINE } from "@/lib/app-meta";
import { getUserSettings } from "@/lib/desk/settings";
import type { DeskVisibility } from "@/lib/desk/visibility";
import { THEME_BOOT_SCRIPT } from "@/lib/theme";
import appCss from "../styles.css?url";

const fetchSessionUser = createServerFn({ method: "GET" }).handler(async () => {
  const { getSessionUser } = await import("@/lib/auth/verify.server");
  const u = await getSessionUser();
  return u ? { id: u.id, email: u.email } : null;
});

export const Route = createRootRoute({
  beforeLoad: async () => {
    const sessionUser = await fetchSessionUser();
    if (!sessionUser) return { sessionUser, desk: null as DeskVisibility | null };
    try {
      return { sessionUser, desk: await getUserSettings() };
    } catch {
      return { sessionUser, desk: null as DeskVisibility | null };
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

function RootDocument() {
  useEffect(() => {
    if (!window.matchMedia("(pointer: coarse)").matches) return;
    const block = (event: Event) => event.preventDefault();
    document.addEventListener("contextmenu", block);
    return () => document.removeEventListener("contextmenu", block);
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
            <Outlet />
          </AuthProvider>
        </ThemeProvider>
        <Scripts />
      </body>
    </html>
  );
}
