/**
 * 認証まわりをルートで一度だけ包む枠。今は中身をそのまま通すだけ。
 * セッション取得は lib/auth/client の useSession が単独で動く。
 * 将来クライアント側のプロバイダを足すときは、この中に置く。
 */
import type { ReactNode } from "react";

/** 子要素をそのまま返す。ルート（__root.tsx）で ThemeProvider の内側に置く。 */
/**
 * App-wide client provider mounted once near the root (in `src/routes/__root.tsx`):
 *
 *   <AuthProvider><Outlet /></AuthProvider>
 *
 * Better Auth's React client (`@/lib/auth/client`) needs NO context provider —
 * its `useSession()` works standalone — so this is a passthrough today. It's
 * kept as the single, stable mount point for any future client-side providers
 * (e.g. a toast or theme provider) without churning the root shell.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
