import { createFileRoute, Link, useRouteContext } from "@tanstack/react-router";
import { ChevronRight, Cigarette, Footprints, PawPrint } from "lucide-react";
import { MENUS } from "@/lib/app-meta";
import { useCurrentUser, useCurrentUserState } from "@/lib/auth/use-current-user";
import { AppShell } from "@/components/app-shell";
import { AuthSplash, LoginScreen } from "@/components/login-form";
import { ThemeSettings } from "@/components/theme-settings";

export const Route = createFileRoute("/")({ component: Home });

const ICONS = {
  "/calorie": PawPrint,
  "/smoking": Cigarette,
  "/walk": Footprints,
} as const;

function Home() {
  const { sessionUser } = useRouteContext({ from: "__root__" });
  const { user, isPending } = useCurrentUserState();

  if (user) {
    return (
      <AppShell>
        <MenuScreen />
      </AppShell>
    );
  }
  if (isPending && sessionUser) return <AuthSplash />;
  return <LoginScreen />;
}

function MenuScreen() {
  const user = useCurrentUser();
  const greeting = user?.primaryEmail ?? user?.displayName ?? "ゲスト";

  return (
    <div className="stagger-in flex flex-1 flex-col gap-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted">ようこそ、{greeting}</p>
          <h1 className="mt-2 text-xs font-medium tracking-widest text-subtle">MENU</h1>
        </div>
        <ThemeSettings />
      </div>

      <nav aria-label="メインメニュー" className="overflow-hidden rounded-xl border border-border bg-surface shadow-card">
        {MENUS.map((item) => {
          const Icon = ICONS[item.to];
          return (
            <Link
              key={item.to}
              to={item.to}
              className="group flex min-h-14 items-center gap-3 border-b border-border px-4 outline-none last:border-b-0 transition-colors duration-150 ease-[var(--ease-out)] hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-ring/35"
            >
              <Icon className="size-4 shrink-0 text-primary" strokeWidth={1.75} />
              <span className="min-w-0 flex-1 font-display text-base font-semibold text-fg">
                {item.title}
              </span>
              <ChevronRight
                className="size-4 shrink-0 text-subtle transition-transform duration-200 group-hover:translate-x-0.5"
                strokeWidth={1.75}
              />
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
