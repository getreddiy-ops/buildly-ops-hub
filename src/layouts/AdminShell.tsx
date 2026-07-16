import { useState } from "react";
import { NavLink, Outlet, useNavigate, useLocation } from "react-router-dom";
import { LayoutDashboard, Building2, Users, ShieldAlert, LogOut, Menu, Sparkles } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const nav = [
  { to: "/admin", label: "Overview", icon: LayoutDashboard, end: true },
  { to: "/admin/organizations", label: "Organizations", icon: Building2 },
  { to: "/admin/users", label: "Users", icon: Users },
  { to: "/admin/ai-usage", label: "AI Usage", icon: Sparkles },
  { to: "/admin/audit", label: "Audit Log", icon: ShieldAlert },
];

export default function AdminShell() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);

  const NavList = ({ onClick }: { onClick?: () => void }) => (
    <>
      {nav.map((i) => (
        <NavLink key={i.to} to={i.to} end={i.end} onClick={onClick}
          className={({ isActive }) => cn(
            "flex items-center gap-3 rounded-md px-3 py-2 text-sm",
            isActive ? "bg-sidebar-primary text-sidebar-primary-foreground"
              : "text-sidebar-foreground/80 hover:bg-sidebar-accent",
          )}>
          <i.icon className="h-4 w-4" /> {i.label}
        </NavLink>
      ))}
    </>
  );

  return (
    <div className="flex min-h-screen w-full bg-background">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:flex">
        <div className="border-b border-sidebar-border p-4"><Logo to="/admin" /></div>
        <div className="border-b border-sidebar-border px-4 py-2 text-xs uppercase tracking-wide text-sidebar-foreground/60">
          Platform Admin
        </div>
        <nav className="flex-1 p-3"><NavList /></nav>
        <div className="border-t border-sidebar-border p-3">
          <div className="mb-2 truncate px-2 text-xs text-sidebar-foreground/60">{user?.email}</div>
          <Button variant="ghost" size="sm" className="w-full justify-start"
            onClick={async () => { await signOut(); navigate("/"); }}>
            <LogOut className="mr-2 h-4 w-4" /> Sign out
          </Button>
        </div>
      </aside>
      <main className="flex min-w-0 flex-1 flex-col overflow-y-auto">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-border bg-background/95 px-4 py-3 backdrop-blur md:hidden">
          <Sheet open={open} onOpenChange={setOpen} key={location.pathname}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Open menu">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 bg-sidebar p-0 text-sidebar-foreground">
              <SheetHeader className="border-b border-sidebar-border p-4">
                <SheetTitle className="text-left"><Logo to="/admin" /></SheetTitle>
              </SheetHeader>
              <nav className="flex-1 p-3 space-y-0.5"><NavList onClick={() => setOpen(false)} /></nav>
              <div className="border-t border-sidebar-border p-3">
                <div className="mb-2 truncate px-2 text-xs text-sidebar-foreground/60">{user?.email}</div>
                <Button variant="ghost" size="sm" className="w-full justify-start"
                  onClick={async () => { await signOut(); navigate("/"); }}>
                  <LogOut className="mr-2 h-4 w-4" /> Sign out
                </Button>
              </div>
            </SheetContent>
          </Sheet>
          <div className="flex-1 truncate"><Logo to="/admin" /></div>
        </header>
        <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8"><Outlet /></div>
      </main>
    </div>
  );
}
