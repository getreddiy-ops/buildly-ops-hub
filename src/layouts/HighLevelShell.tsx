import { useEffect, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { FileText, Users, Sparkles } from "lucide-react";
import { Logo } from "@/components/Logo";
import { highLevel } from "@/integrations/highlevel/client";
import { cn } from "@/lib/utils";

type Connection = {
  connected: boolean;
  mode: string;
  locationId: string;
  companyId?: string | null;
  user?: { name?: string | null; email?: string | null; role?: string | null } | null;
};

const links = [
  { to: "/highlevel/leads", label: "Leads", icon: Sparkles },
  { to: "/highlevel/customers", label: "Customers", icon: Users },
  { to: "/highlevel/estimates", label: "Estimates", icon: FileText },
];

export default function HighLevelShell() {
  const [connection, setConnection] = useState<Connection | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    highLevel.context()
      .then((value) => {
        if (!active) return;
        setConnection(value as Connection);
        setError(null);
      })
      .catch((cause) => {
        if (!active) return;
        setError(cause instanceof Error ? cause.message : "Unable to verify HighLevel session");
      });
    return () => { active = false; };
  }, []);

  if (error) {
    return (
      <div className="dark grid min-h-screen place-items-center bg-background p-6 text-foreground">
        <div className="max-w-lg rounded-xl border border-border bg-card p-6 text-center shadow-sm">
          <Logo to="/" />
          <h1 className="mt-6 text-xl font-semibold">Open FastTract from HighLevel</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This workspace is secured by your HighLevel sub-account session. Open the FastTract menu item inside HighLevel and try again.
          </p>
          <p className="mt-4 break-words text-xs text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  if (!connection) {
    return (
      <div className="dark grid min-h-screen place-items-center bg-background text-sm text-muted-foreground">
        Connecting FastTract to this HighLevel workspace…
      </div>
    );
  }

  return (
    <div className="dark min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-5 px-4">
          <Logo to="/highlevel/customers" />
          <nav className="flex items-center gap-1">
            {links.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => cn(
                  "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-secondary text-primary"
                    : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
                )}
              >
                <item.icon className="h-4 w-4" />
                <span className="hidden sm:inline">{item.label}</span>
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto min-w-0 text-right">
            <div className="truncate text-xs font-medium">
              {connection.user?.name || connection.user?.email || "HighLevel user"}
            </div>
            <div className="truncate text-[11px] text-muted-foreground">
              Connected to this HighLevel sub-account
            </div>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl p-4 sm:p-6">
        <Outlet />
      </main>
    </div>
  );
}
