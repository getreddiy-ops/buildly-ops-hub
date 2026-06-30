import { useState } from "react";
import { NavLink, Outlet, useNavigate, Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Users, FileText, Briefcase, HardHat, Clock,
  CheckSquare, DollarSign, Bot, MessageSquare, Settings, LogOut, CreditCard, Phone, Sparkles,
  Receipt, FileSignature, Palette, Code2, Truck, Package, Menu, Smartphone, ShieldCheck,
} from "lucide-react";


import { useAuth } from "@/contexts/AuthContext";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";
import { PastDueBanner } from "@/components/PastDueBanner";
import { useBranding } from "@/hooks/useBranding";
import { Sheet, SheetContent, SheetTrigger, SheetTitle, SheetHeader } from "@/components/ui/sheet";
import { FloatingAssistant } from "@/components/FloatingAssistant";
import { cn } from "@/lib/utils";


const nav = [
  { to: "/app", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/app/leads", label: "Leads", icon: Users },
  { to: "/app/customers", label: "Customers", icon: Users },
  { to: "/app/estimates", label: "Estimates", icon: FileText },
  { to: "/app/invoices", label: "Invoices", icon: Receipt },
  { to: "/app/contracts", label: "Contracts", icon: FileSignature },

  { to: "/app/jobs", label: "Jobs", icon: Briefcase },
  { to: "/app/crew", label: "Crew", icon: HardHat },
  { to: "/app/vendors", label: "Vendors", icon: Truck },
  { to: "/app/materials", label: "Materials", icon: Package },
  { to: "/app/time", label: "Time Tracking", icon: Clock },
  { to: "/app/approvals", label: "Approvals", icon: CheckSquare },
  { to: "/app/costing", label: "Job Costing", icon: DollarSign },
  { to: "/app/business-profile", label: "AI Business Profile", icon: Sparkles },
  { to: "/app/branding", label: "Branding", icon: Palette },

  { to: "/app/assistant", label: "AI Assistant", icon: Bot },
  { to: "/app/phone-assistant", label: "Phone Assistant", icon: Phone },

  { to: "/app/messages", label: "Messages", icon: MessageSquare },
  { to: "/app/billing", label: "Billing", icon: CreditCard },
  { to: "/app/developer", label: "Developer", icon: Code2 },
  { to: "/app/settings", label: "Settings", icon: Settings },
];

export default function AppShell() {
  const { user, activeOrg, signOut, memberships, setActiveOrgId, isPlatformAdmin } = useAuth();
  const { branding } = useBranding();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close drawer on route change
  const currentPath = location.pathname;

  const NavList = ({ onNavigate }: { onNavigate?: () => void }) => (
    <ul className="space-y-0.5">
      {nav.map((item) => (
        <li key={item.to}>
          <NavLink
            to={item.to}
            end={item.end}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                isActive
                  ? "bg-sidebar-primary text-sidebar-primary-foreground"
                  : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              )
            }
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </NavLink>
        </li>
      ))}
      <li className="pt-2 mt-2 border-t border-sidebar-border">
        <NavLink
          to="/field"
          onClick={onNavigate}
          className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        >
          <Smartphone className="h-4 w-4" />
          Field App (Mobile)
        </NavLink>
      </li>
    </ul>
  );

  const BrandHeader = () =>
    branding?.logo_signed_url ? (
      <Link to="/app" className="flex items-center gap-2">
        <img
          src={branding.logo_signed_url}
          alt={branding.name}
          className="max-h-10 max-w-[180px] object-contain"
        />
      </Link>
    ) : (
      <Logo to="/app" />
    );

  const OrgSwitcher = () =>
    memberships.length > 1 ? (
      <select
        value={activeOrg?.organization_id}
        onChange={(e) => setActiveOrgId(e.target.value)}
        className="w-full rounded-md border border-sidebar-border bg-sidebar-accent px-2 py-1.5 text-sm"
      >
        {memberships.map((m) => (
          <option key={m.organization_id} value={m.organization_id}>
            {m.organization.name}
          </option>
        ))}
      </select>
    ) : null;

  return (
    <div className="flex min-h-screen w-full bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:flex">
        <div className="border-b border-sidebar-border p-4">
          <BrandHeader />
        </div>
        {memberships.length > 1 && (
          <div className="border-b border-sidebar-border p-3">
            <OrgSwitcher />
          </div>
        )}
        <nav className="flex-1 overflow-y-auto p-3">
          <NavList />
        </nav>
        <div className="border-t border-sidebar-border p-3">
          <div className="mb-2 truncate px-2 text-xs text-sidebar-foreground/60">
            {user?.email}
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-sidebar-foreground/80 hover:bg-sidebar-accent"
            onClick={async () => { await signOut(); navigate("/"); }}
          >
            <LogOut className="mr-2 h-4 w-4" /> Sign out
          </Button>
        </div>
      </aside>

      <main className="flex flex-1 flex-col overflow-y-auto">
        {/* Mobile top bar */}
        <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-border bg-background/95 px-4 py-3 backdrop-blur md:hidden">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen} key={currentPath}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Open menu">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 bg-sidebar p-0 text-sidebar-foreground">
              <SheetHeader className="border-b border-sidebar-border p-4">
                <SheetTitle className="text-left">
                  <BrandHeader />
                </SheetTitle>
              </SheetHeader>
              {memberships.length > 1 && (
                <div className="border-b border-sidebar-border p-3">
                  <OrgSwitcher />
                </div>
              )}
              <nav className="flex-1 overflow-y-auto p-3">
                <NavList onNavigate={() => setMobileOpen(false)} />
              </nav>
              <div className="border-t border-sidebar-border p-3">
                <div className="mb-2 truncate px-2 text-xs text-sidebar-foreground/60">
                  {user?.email}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start text-sidebar-foreground/80 hover:bg-sidebar-accent"
                  onClick={async () => { await signOut(); navigate("/"); }}
                >
                  <LogOut className="mr-2 h-4 w-4" /> Sign out
                </Button>
              </div>
            </SheetContent>
          </Sheet>
          <div className="flex-1 truncate">
            <BrandHeader />
          </div>
          <Link
            to="/field"
            className="rounded-md border border-border px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
            aria-label="Open field app"
          >
            Field
          </Link>
        </header>

        <PaymentTestModeBanner />
        <PastDueBanner />
        <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
          <Outlet />
        </div>
      </main>
      <FloatingAssistant />
    </div>
  );
}
