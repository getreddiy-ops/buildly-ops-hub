import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { Activity, Command, Database, LogOut, Radio, Terminal, Users2, Zap } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Midnight Indigo, locked. Scoped to this shell only via inline CSS variables,
// so the rest of the app keeps its warm sunset palette.
const midnightTheme: React.CSSProperties = {
  // shadcn tokens (HSL triplets, matching how tailwind config consumes them)
  ["--background" as any]: "240 40% 6%",
  ["--foreground" as any]: "230 40% 92%",
  ["--card" as any]: "240 40% 10%",
  ["--card-foreground" as any]: "230 40% 92%",
  ["--popover" as any]: "240 40% 10%",
  ["--popover-foreground" as any]: "230 40% 92%",
  ["--primary" as any]: "243 75% 59%",
  ["--primary-foreground" as any]: "230 40% 98%",
  ["--secondary" as any]: "240 30% 16%",
  ["--secondary-foreground" as any]: "230 40% 92%",
  ["--muted" as any]: "240 25% 14%",
  ["--muted-foreground" as any]: "230 20% 65%",
  ["--accent" as any]: "243 75% 25%",
  ["--accent-foreground" as any]: "230 40% 96%",
  ["--destructive" as any]: "0 75% 55%",
  ["--destructive-foreground" as any]: "0 0% 100%",
  ["--border" as any]: "240 30% 18%",
  ["--input" as any]: "240 30% 18%",
  ["--ring" as any]: "243 75% 59%",
  ["--radius" as any]: "0.5rem",
  colorScheme: "dark",
  background:
    "radial-gradient(1200px 600px at 10% -10%, hsl(243 75% 20% / 0.6), transparent 60%)," +
    "radial-gradient(1000px 500px at 100% 0%, hsl(260 80% 25% / 0.45), transparent 60%)," +
    "hsl(240 40% 4%)",
  minHeight: "100vh",
  color: "hsl(230 40% 92%)",
};

const nav = [
  { to: "/super", label: "Ops Overview", icon: Activity, end: true },
  { to: "/super/controls", label: "Controls", icon: Command },
  { to: "/super/orgs", label: "Organizations", icon: Users2 },
  { to: "/super/data", label: "Data Console", icon: Database },
  { to: "/super/live", label: "Live Signals", icon: Radio },
];

export default function SuperShell() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  return (
    <div style={midnightTheme}>
      <div className="mx-auto flex min-h-screen max-w-[1600px] gap-6 px-6 py-6">
        <aside className="hidden w-64 shrink-0 flex-col rounded-2xl border border-border/60 bg-card/60 p-4 backdrop-blur md:flex">
          <div className="mb-6 flex items-center gap-2 px-2">
            <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary/20 text-primary ring-1 ring-primary/40">
              <Terminal className="h-4 w-4" />
            </div>
            <div className="leading-tight">
              <div className="text-sm font-semibold tracking-wide">FastTract</div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-primary/80">Ops Console</div>
            </div>
          </div>
          <nav className="flex-1 space-y-1">
            {nav.map((i) => (
              <NavLink
                key={i.to}
                to={i.to}
                end={i.end}
                className={({ isActive }) =>
                  cn(
                    "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition",
                    isActive
                      ? "bg-primary/15 text-foreground ring-1 ring-primary/40"
                      : "text-foreground/70 hover:bg-secondary hover:text-foreground",
                  )
                }
              >
                <i.icon className="h-4 w-4" />
                {i.label}
              </NavLink>
            ))}
          </nav>
          <div className="mt-4 rounded-lg border border-border/60 bg-background/40 p-3 text-xs">
            <div className="mb-2 flex items-center gap-1.5 text-primary">
              <Zap className="h-3 w-3" />
              <span className="font-medium uppercase tracking-wider">Root access</span>
            </div>
            <div className="truncate text-foreground/60">{user?.email}</div>
            <Button
              variant="ghost"
              size="sm"
              className="mt-2 w-full justify-start text-foreground/70 hover:text-foreground"
              onClick={async () => {
                await signOut();
                navigate("/");
              }}
            >
              <LogOut className="mr-2 h-4 w-4" /> Sign out
            </Button>
          </div>
        </aside>
        <main className="min-w-0 flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
