import { createFileRoute, Outlet, Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/stores/auth";
import { Logo } from "@/components/ui-kit/Logo";
import { Button } from "@/components/ui-kit/Button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — MockMate" },
      { name: "description", content: "Your interview workspace: overview, interviews, resumes, practice and analytics." },
    ],
  }),
  component: DashboardLayout,
});

const TABS: { to: string; label: string; exact?: boolean }[] = [
  { to: "/dashboard", label: "Overview", exact: true },
  { to: "/dashboard/interviews", label: "Interviews" },
  { to: "/dashboard/resumes", label: "Resumes" },
  { to: "/dashboard/practice", label: "Practice" },
  { to: "/dashboard/analytics", label: "Analytics" },
];

function DashboardLayout() {
  const { user, status, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (status === "unauthenticated") navigate({ to: "/login" });
  }, [status, navigate]);

  if (status === "loading" || status === "idle") {
    return (
      <div className="grid min-h-screen place-items-center text-muted-foreground text-sm">
        <div className="flex items-center gap-3"><span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" /> Loading workspace…</div>
      </div>
    );
  }
  if (!user) return null;

  return (
    <div className="relative min-h-screen">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-gradient-primary opacity-[0.08] blur-3xl" />

      <header className="sticky top-0 z-30 border-b border-border bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-6 px-6 py-3.5">
          <div className="flex items-center gap-8">
            <Link to="/dashboard"><Logo /></Link>
            <nav className="hidden items-center gap-1 md:flex">
              {TABS.map((t) => {
                const active = t.exact ? location.pathname === t.to : location.pathname.startsWith(t.to);
                return (
                  <Link
                    key={t.to}
                    to={t.to as any}
                    className={cn(
                      "relative rounded-md px-3 py-1.5 text-sm transition-colors",
                      active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {t.label}
                    {active && <span className="absolute inset-x-2 -bottom-[15px] h-px bg-gradient-primary" />}
                  </Link>
                );
              })}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/interview/new"><Button size="sm">New interview</Button></Link>
            <UserMenu name={user.name} email={user.email} onLogout={() => { logout(); navigate({ to: "/" }); }} />
          </div>
        </div>
        {/* mobile tabs */}
        <div className="md:hidden border-t border-border overflow-x-auto">
          <div className="flex min-w-max gap-1 px-4 py-2">
            {TABS.map((t) => {
              const active = t.exact ? location.pathname === t.to : location.pathname.startsWith(t.to);
              return (
                <Link key={t.to} to={t.to as any} className={cn("rounded-md px-3 py-1.5 text-xs", active ? "bg-elevated text-foreground" : "text-muted-foreground")}>{t.label}</Link>
              );
            })}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1400px] px-6 py-8">
        <Outlet />
      </main>
    </div>
  );
}

function UserMenu({ name, email, onLogout }: { name: string; email: string; onLogout: () => void }) {
  const initials = name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
  return (
    <div className="group relative">
      <button className="flex items-center gap-2.5 rounded-lg border border-border bg-elevated/60 px-2 py-1 pr-3 text-left transition-colors hover:bg-elevated">
        <span className="grid h-7 w-7 place-items-center rounded-md bg-gradient-primary text-[11px] font-semibold text-primary-foreground">{initials}</span>
        <span className="hidden flex-col leading-tight md:flex">
          <span className="text-xs font-medium text-foreground">{name}</span>
          <span className="text-[10px] text-muted-foreground">{email}</span>
        </span>
      </button>
      <div className="invisible absolute right-0 top-[calc(100%+8px)] w-56 origin-top-right scale-95 rounded-xl border border-border bg-popover p-2 opacity-0 shadow-elegant transition-all group-hover:visible group-hover:scale-100 group-hover:opacity-100">
        <div className="px-2.5 py-2 text-xs">
          <div className="font-medium text-foreground">{name}</div>
          <div className="text-muted-foreground">{email}</div>
        </div>
        <div className="my-1 h-px bg-border" />
        <button onClick={onLogout} className="block w-full rounded-md px-2.5 py-2 text-left text-xs text-foreground hover:bg-elevated">Sign out</button>
      </div>
    </div>
  );
}

