import { createFileRoute, Link, useRouteContext } from "@tanstack/react-router";
import { ChevronRight, Cigarette, Footprints, PawPrint, Stethoscope } from "lucide-react";
import { MENUS } from "@/lib/app-meta";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { useMenuLayout } from "@/lib/menu-layout";
import { AppShell } from "@/components/app-shell";
import { AuthSplash, LoginScreen } from "@/components/login-form";
import { DeskPanel } from "@/components/desk-panel";

export const Route = createFileRoute("/")({ component: Home });

const ICONS = {
  "/calorie": PawPrint,
  "/smoking": Cigarette,
  "/walk": Footprints,
  "/vet": Stethoscope,
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
  const layout = useMenuLayout();

  return (
    <div className="stagger-in flex flex-1 flex-col gap-6">
      <nav
        aria-label="メインメニュー"
        className={
          layout === "icons"
            ? "grid grid-cols-2 gap-3"
            : "overflow-hidden rounded-xl border border-border bg-surface shadow-card"
        }
      >
        {MENUS.map((item) => {
          const Icon = ICONS[item.to];
          if (layout === "icons") {
            return (
              <Link
                key={item.to}
                to={item.to}
                className="flex min-h-32 flex-col items-center justify-center gap-3 rounded-xl border border-border bg-surface px-3 py-5 text-center shadow-card outline-none transition-colors duration-150 ease-[var(--ease-out)] hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-ring/35"
              >
                <span className="grid size-14 place-items-center rounded-full bg-surface-2 text-primary">
                  <Icon className="size-7" strokeWidth={1.75} />
                </span>
                <span className="font-display text-sm font-semibold text-fg">{item.title}</span>
              </Link>
            );
          }
          return (
            <Link
              key={item.to}
              to={item.to}
              className="group flex min-h-14 items-center gap-3 border-b border-border px-4 outline-none last:border-b-0 transition-colors duration-150 ease-[var(--ease-out)] hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-ring/35"
            >
              <Icon className="size-4 shrink-0 text-primary" strokeWidth={1.75} />
              <span className="min-w-0 flex-1 font-display text-base font-semibold text-fg">{item.title}</span>
              <ChevronRight
                className="size-4 shrink-0 text-subtle transition-transform duration-200 group-hover:translate-x-0.5"
                strokeWidth={1.75}
              />
            </Link>
          );
        })}
      </nav>

      <DeskPanel />
    </div>
  );
}
