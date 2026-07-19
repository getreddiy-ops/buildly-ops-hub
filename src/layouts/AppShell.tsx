import { useState } from "react";
import { NavLink, Outlet, useNavigate, Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Users, FileText, Briefcase, Clock, Receipt,
  Settings, LogOut, Sparkles, Menu, Smartphone, ShieldCheck,
  ChevronDown, Wrench, Terminal,
} from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";
import { PastDueBanner } from "@/components/PastDueBanner";
import { useBranding } from "@/hooks/useBranding";
import { Sheet, SheetContent, SheetTrigger, SheetTitle, SheetHeader } from "@/components/ui/sheet";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { FloatingAssistant } from "@/components/FloatingAssistant";
import { cn } from "@/lib/utils";

type NavItem = { to: string; label: string; icon: any; end?: boolean };

const primary: NavItem[] = [
  { to: "/app", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/app/leads", label: "Leads", icon: Sparkles },
  { to: "/app/customers", label: "Customers", icon: Users },
  { to: "/app/estimates", label: "Estimates", icon: FileText },
  { to: "/app/assistant", label: "AI Estimator", icon: Sparkles },
  { to: "/app/jobs", label: "Jobs", icon: Briefcase },
  { to: "/app/time", label: "Time", icon: Clock },
  { to: "/app/invoices", label: "Invoices", icon: Receipt },
];

const moreGroups: { label: string; items: NavItem[] }[] = [
  {
    label: "Sales",
    items: [
      { to: "/app/contracts", label: "Contracts", icon: FileText },
    ],
  },
  {
    label: "Operations",
    items: [
      { to: "/app/calendar", label: "Calendar & PTO", icon: Clock },
      { to: "/app/vendors", label: "Vendors", icon: Briefcase },
      { to: "/app/materials", label: "Materials", icon: Wrench },
      { to: "/app/costing", label: "Job Costing", icon: Receipt },
    ],
  },
  {
    label: "Team",
    items: [
      { to: "/app/crew", label: "Crew", icon: Users },
      { to: "/app/approvals", label: "Approvals", icon: FileText },
    ],
  },
  {
    label: "AI Tools",
    items: [
      { to: "/app/phone-assistant", label: "Phone Assistant", icon: Sparkles },
      { to: "/app/business-profile", label: "Business Profile", icon: Sparkles },
    ],
  },
];

const settingsItem: NavItem = { to: "/app/settings", label: "Settings", icon: Settings };
const settingsGroup: NavItem[] = [
  { to: "/app/branding", label: "Branding", icon: Sparkles },
  { to: "/app/billing", label: "Billing", icon: Receipt },
  { to: "/app/developer", label: "Developer", icon: Wrench },
  { to: "/app/settings", label: "Preferences", icon: Settings },
];

export default function AppShell() {
  const { user, activeOrg, signOut, memberships, setActiveOrgId, isPlatformAdmin } = useAuth();
  const { branding } = useBranding();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const currentPath = location.pathname;

  const linkClass = (isActive: boolean) =>
    cn(
      "group relative flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors whitespace-nowrap",
      isActive
        ? "bg-primary text-primary-foreground"
        : "text-foreground/70 hover:text-foreground hover:bg-secondary",
    );

  const BrandHeader = () =>
    branding?.logo_signed_url ? (
      <Link to="/app" className="flex items-center gap-2">
        <img
          src={branding.logo_signed_url}
          alt={branding.name}
          className="max-h-9 max-w-[160px] object-contain"
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
        className="rounded-md border border-border bg-secondary px-2 py-1.5 text-xs text-foreground"
      >
        {memberships.map((m) => (
          <option key={m.organization_id} value={m.organization_id}>
            {m.organization.name}
          </option>
        ))}
      </select>
    ) : null;

  return (
    <div className="dark flex min-h-screen w-full flex-col bg-background text-foreground">
      {/* Ambient grid background */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0 opacity-[0.35]"
        style={{
          backgroundImage:
            "linear-gradient(hsl(var(--border) / 0.35) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--border) / 0.35) 1px, transparent 1px)",
          backgroundSize: "56px 56px",
          maskImage:
            "radial-gradient(ellipse at 20% 0%, hsl(0 0% 0% / 0.95), transparent 70%)",
        }}
      />

      {/* Top nav */}
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
        <div className="mx-auto flex h-16 w-full max-w-[1400px] items-center gap-2 px-4 sm:px-6">
          {/* Mobile trigger */}
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen} key={currentPath}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden" aria-label="Open menu">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="dark w-72 bg-background p-0 text-foreground">
              <SheetHeader className="border-b border-border p-4">
                <SheetTitle className="text-left"><BrandHeader /></SheetTitle>
              </SheetHeader>
              <nav className="flex-1 overflow-y-auto p-3">
                <ul className="space-y-0.5">
                  {[...primary, ...moreGroups.flatMap(g => g.items), ...settingsGroup].map(item => (
                    <li key={item.to}>
                      <NavLink
                        to={item.to}
                        end={item.end}
                        onClick={() => setMobileOpen(false)}
                        className={({ isActive }) => linkClass(isActive)}
                      >
                        <item.icon className="h-4 w-4" />
                        {item.label}
                      </NavLink>
                    </li>
                  ))}
                </ul>
              </nav>
              <div className="border-t border-border p-3">
                <div className="mb-2 truncate px-2 text-xs text-muted-foreground">{user?.email}</div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start"
                  onClick={async () => { await signOut(); navigate("/"); }}
                >
                  <LogOut className="mr-2 h-4 w-4" /> Sign out
                </Button>
              </div>
            </SheetContent>
          </Sheet>

          <BrandHeader />

          {/* Desktop nav */}
          <nav className="ml-4 hidden flex-1 items-center gap-1 md:flex">
            {primary.map(item => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) => linkClass(isActive)}
              >
                {item.end && <item.icon className="h-4 w-4" />}
                {item.label}
              </NavLink>
            ))}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className={cn(linkClass(false), "cursor-pointer")}>
                  More <ChevronDown className="h-3.5 w-3.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                {moreGroups.map((g, i) => (
                  <div key={g.label}>
                    {i > 0 && <DropdownMenuSeparator />}
                    <DropdownMenuLabel className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {g.label}
                    </DropdownMenuLabel>
                    {g.items.map(item => (
                      <DropdownMenuItem key={item.to} asChild>
                        <Link to={item.to} className="flex items-center gap-2">
                          <item.icon className="h-4 w-4" /> {item.label}
                        </Link>
                      </DropdownMenuItem>
                    ))}
                  </div>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/field" className="flex items-center gap-2">
                    <Smartphone className="h-4 w-4" /> Field App
                  </Link>
                </DropdownMenuItem>
                {isPlatformAdmin && (
                  <DropdownMenuItem asChild>
                    <Link to="/admin" className="flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4" /> Platform Admin
                    </Link>
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className={cn(linkClass(currentPath.startsWith("/app/settings") || currentPath.startsWith("/app/billing") || currentPath.startsWith("/app/branding") || currentPath.startsWith("/app/developer")), "cursor-pointer")}>
                  <settingsItem.icon className="h-4 w-4" /> Settings <ChevronDown className="h-3.5 w-3.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                {settingsGroup.map(item => (
                  <DropdownMenuItem key={item.to} asChild>
                    <Link to={item.to} className="flex items-center gap-2">
                      <item.icon className="h-4 w-4" /> {item.label}
                    </Link>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </nav>

          <div className="ml-auto hidden items-center gap-2 md:flex">
            {isPlatformAdmin && (
              <Button asChild variant="outline" size="sm" className="gap-2 border-indigo-500/40 bg-indigo-500/10 text-indigo-700 hover:bg-indigo-500/20 hover:text-indigo-800 dark:text-indigo-300">
                <Link to="/super">
                  <Terminal className="h-4 w-4" /> Super Admin
                </Link>
              </Button>
            )}
            <OrgSwitcher />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="secondary" size="sm" className="gap-2">
                  <span className="grid h-6 w-6 place-items-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                    {user?.email?.[0]?.toUpperCase() ?? "?"}
                  </span>
                  <ChevronDown className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="truncate text-xs text-muted-foreground">
                  {user?.email}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/field" className="flex items-center gap-2">
                    <Smartphone className="h-4 w-4" /> Field App
                  </Link>
                </DropdownMenuItem>
                {isPlatformAdmin && (
                  <DropdownMenuItem asChild>
                    <Link to="/admin" className="flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4" /> Platform Admin
                    </Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={async () => { await signOut(); navigate("/"); }}>
                  <LogOut className="mr-2 h-4 w-4" /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <PaymentTestModeBanner />
      <PastDueBanner />

      <main className="relative z-10 mx-auto w-full max-w-[1400px] flex-1 px-4 py-8 sm:px-6 lg:px-8">
        <Outlet />
      </main>
      <FloatingAssistant />
    </div>
  );
}
