import { createFileRoute, Link, useRouteContext } from "@tanstack/react-router";
import { ChevronRight, Cigarette, Footprints, PawPrint } from "lucide-react";
import { MENUS } from "@/lib/app-meta";
import { useCurrentUser, useCurrentUserState } from "@/lib/auth/use-current-user";
import { AppShell } from "@/components/app-shell";
import { AuthSplash, LoginScreen } from "@/components/login-form";

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
    <div className="stagger-in flex flex-1 flex-col gap-8">
      <div>
        <p className="text-sm text-muted">ようこそ、{greeting}</p>
        <h1 className="mt-3 text-xs font-medium tracking-widest text-subtle">MENU</h1>
      </div>

      <nav aria-label="メインメニュー" className="grid gap-4">
        {MENUS.map((item) => {
          const Icon = ICONS[item.to];
          return (
            <Link
              key={item.to}
              to={item.to}
              className="group flex min-h-24 items-center gap-4 rounded-xl border border-border bg-surface px-5 py-5 shadow-card outline-none transition-[box-shadow,transform] duration-200 ease-[var(--ease-out)] hover:shadow-card-hover focus-visible:ring-2 focus-visible:ring-ring/35 active:scale-[0.99]"
            >
              <span className="grid size-12 shrink-0 place-items-center rounded-md bg-surface-2 text-primary">
                <Icon className="size-5" strokeWidth={1.75} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-sans text-xs font-medium tracking-widest text-subtle">
                  {item.index}
                </span>
                <span className="mt-0.5 block font-display text-xl font-semibold text-fg">
                  {item.title}
                </span>
                <span className="mt-1 block text-sm text-muted">{item.description}</span>
              </span>
              <ChevronRight
                className="size-5 shrink-0 text-subtle transition-transform duration-200 group-hover:translate-x-0.5"
                strokeWidth={1.75}
              />
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
