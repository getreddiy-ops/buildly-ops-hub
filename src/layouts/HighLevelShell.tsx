import { NavLink, Outlet } from "react-router-dom";
import {
  Bot,
  BriefcaseBusiness,
  Home,
  RefreshCw,
  Sparkles,
  Users,
  WalletCards,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { HighLevelProvider, useHighLevel } from "@/contexts/HighLevelContext";
import { cn } from "@/lib/utils";
import { AvaHandoffDialog } from "@/pages/highlevel/AvaHandoffDialog";

const links = [
  { to: "/highlevel/home", label: "Home", icon: Home },
  { to: "/highlevel/leads", label: "Leads", icon: Users },
  { to: "/highlevel/jobs", label: "Jobs", icon: BriefcaseBusiness },
  { to: "/highlevel/money", label: "Money", icon: WalletCards },
  { to: "/highlevel/ai", label: "AI", icon: Bot },
] as const;

function ShellContent() {
  const { connection, loading, error, reload } = useHighLevel();

  if (loading) {
    return (
      <div className="dark grid min-h-[100dvh] place-items-center overflow-hidden bg-background text-foreground">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="grid h-14 w-14 place-items-center rounded-2xl border border-primary/30 bg-primary/10 shadow-elevated">
            <Sparkles className="h-6 w-6 animate-pulse text-primary" />
          </div>
          <div>
            <p className="font-semibold">Opening your FastTract workspace</p>
            <p className="mt-1 text-sm text-muted-foreground">Verifying this HighLevel sub-account…</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !connection) {
    return (
      <div className="dark grid min-h-[100dvh] place-items-center overflow-hidden bg-background p-5 text-foreground">
        <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 text-center shadow-elevated sm:p-8">
          <Logo to="/" className="justify-center" />
          <div className="mx-auto mt-7 grid h-14 w-14 place-items-center rounded-2xl bg-destructive/10 text-destructive">
            <RefreshCw className="h-6 w-6" />
          </div>
          <h1 className="mt-5 text-2xl font-semibold">FastTract could not verify this workspace</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Open FastTract from the left menu of the HighLevel sub-account you want to use, then retry the secure connection.
          </p>
          {error && (
            <p className="mt-4 rounded-lg border border-border bg-background/60 p-3 text-left text-xs text-muted-foreground">
              {error}
            </p>
          )}
          <Button className="mt-5" onClick={() => void reload()}>
            <RefreshCw className="h-4 w-4" /> Retry connection
          </Button>
        </div>
      </div>
    );
  }

  const userLabel = connection.user?.name || connection.user?.email || "HighLevel user";

  return (
    <div className="dark min-h-[100dvh] overflow-x-hidden bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto flex h-16 max-w-[1480px] items-center gap-5 px-4 sm:px-6">
          <Logo to="/highlevel/home" className="shrink-0" />

          <nav className="hidden min-w-0 flex-1 items-center justify-center gap-1 md:flex" aria-label="FastTract workspace">
            {links.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => cn(
                  "flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-secondary/70 hover:text-foreground",
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto flex min-w-0 items-center gap-3">
            <div className="hidden min-w-0 text-right sm:block">
              <div className="max-w-48 truncate text-xs font-medium">{userLabel}</div>
              <div className="flex items-center justify-end gap-1.5 text-[11px] text-muted-foreground">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                FastTract connected
              </div>
            </div>
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
              {userLabel.charAt(0).toUpperCase()}
            </div>
          </div>
        </div>
      </header>

      <main key={connection.locationId} className="mx-auto min-h-[calc(100dvh-4rem)] w-full max-w-[1480px] pb-24 md:pb-8">
        <Outlet key={connection.locationId} />
      </main>

      <AvaHandoffDialog />

      <nav
        className="fixed inset-x-0 bottom-0 z-50 grid h-[72px] grid-cols-5 border-t border-border bg-background/95 px-1 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
        aria-label="FastTract mobile workspace"
      >
        {links.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => cn(
              "flex min-w-0 flex-col items-center justify-center gap-1 rounded-lg px-1 text-[11px] font-medium transition-colors",
              isActive ? "text-primary" : "text-muted-foreground",
            )}
          >
            <item.icon className="h-5 w-5" />
            <span className="truncate">{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

export default function HighLevelShell() {
  return (
    <HighLevelProvider>
      <ShellContent />
    </HighLevelProvider>
  );
}
