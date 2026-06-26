import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { Clock, Briefcase, User, LogOut, MapPin } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Logo } from "@/components/Logo";
import { cn } from "@/lib/utils";

const items = [
  { to: "/field", label: "Clock", icon: Clock, end: true },
  { to: "/field/jobs", label: "Jobs", icon: Briefcase },
  { to: "/field/map", label: "Map", icon: MapPin },
  { to: "/field/profile", label: "Profile", icon: User },
];

export default function FieldAppShell() {
  const { signOut } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="flex items-center justify-between border-b border-border px-4 py-3">
        <Logo to="/field" />
        <button
          onClick={async () => { await signOut(); navigate("/"); }}
          className="text-muted-foreground hover:text-foreground"
          aria-label="Sign out"
        >
          <LogOut className="h-5 w-5" />
        </button>
      </header>
      <main className="flex-1 overflow-y-auto px-4 py-6 pb-24">
        <Outlet />
      </main>
      <nav className="fixed bottom-0 left-0 right-0 grid grid-cols-4 border-t border-border bg-card">
        {items.map((it) => (
          <NavLink
            key={it.to}
            to={it.to}
            end={it.end}
            className={({ isActive }) =>
              cn(
                "flex flex-col items-center gap-1 py-3 text-xs",
                isActive ? "text-primary" : "text-muted-foreground",
              )
            }
          >
            <it.icon className="h-5 w-5" />
            {it.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
