import { useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  BarChart3, BriefcaseBusiness, CalendarDays, ChevronDown, ClipboardCheck,
  FileText, LogOut, Menu, PhoneCall, Receipt, Settings, Sparkles, Users,
  Wrench, Clock3, Boxes, BadgeDollarSign, UserRoundCog, ShieldCheck,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";
import { PastDueBanner } from "@/components/PastDueBanner";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FloatingAssistant } from "@/components/FloatingAssistant";
import { cn } from "@/lib/utils";

type NavItem = { to: string; label: string; icon: typeof Sparkles };
type NavGroup = { label: string; icon: typeof Sparkles; to: string; items: NavItem[] };

const groups: NavGroup[] = [
  {
    label: "Today", icon: CalendarDays, to: "/app",
    items: [
      { to: "/app", label: "My day", icon: CalendarDays },
      { to: "/app/assistant", label: "Agent conversations", icon: Sparkles },
      { to: "/app/approvals", label: "Approvals", icon: ClipboardCheck },
      { to: "/app/calendar", label: "Calendar", icon: Clock3 },
    ],
  },
  {
    label: "Customers", icon: Users, to: "/app/customers",
    items: [
      { to: "/app/leads", label: "Leads & follow-up", icon: Sparkles },
      { to: "/app/customers", label: "Customers", icon: Users },
      { to: "/app/estimates", label: "Estimates", icon: FileText },
      { to: "/app/contracts", label: "Contracts", icon: ClipboardCheck },
      { to: "/app/invoices", label: "Invoices", icon: Receipt },
    ],
  },
  {
    label: "Operations", icon: BriefcaseBusiness, to: "/app/jobs",
    items: [
      { to: "/app/jobs", label: "Jobs & projects", icon: BriefcaseBusiness },
      { to: "/app/crew", label: "People & crew", icon: Users },
      { to: "/app/time", label: "Time tracking", icon: Clock3 },
      { to: "/app/materials", label: "Materials", icon: Boxes },
      { to: "/app/vendors", label: "Vendors", icon: Wrench },
      { to: "/app/costing", label: "Job costing", icon: BadgeDollarSign },
    ],
  },
  {
    label: "Business", icon: BarChart3, to: "/app/business-profile",
    items: [
      { to: "/app/business-profile", label: "Business profile", icon: BriefcaseBusiness },
      { to: "/app/phone-assistant", label: "24/7 phone agent", icon: PhoneCall },
      { to: "/app/branding", label: "Brand & documents", icon: Sparkles },
      { to: "/app/billing", label: "Billing & plan", icon: Receipt },
      { to: "/app/settings", label: "Settings & memory", icon: Settings },
    ],
  },
];

function GroupMenu({ group, path }: { group: NavGroup; path: string }) {
  const active = group.items.some((item) => item.to === path) || (group.to === "/app" && path === "/app");
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className={cn(
          "flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
          active ? "bg-secondary text-primary" : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
        )}>
          <group.icon className="h-5 w-5" />
          <span className="flex-1">{group.label}</span>
          <ChevronDown className="h-4 w-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="right" align="start" sideOffset={8} className="w-60">
        <DropdownMenuLabel>{group.label}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {group.items.map((item) => (
          <DropdownMenuItem key={item.to} asChild>
            <Link to={item.to} className="flex items-center gap-2">
              <item.icon className="h-4 w-4" /> {item.label}
            </Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function getSettingsGroup(isPlatformAdmin: boolean): NavItem[] {
  const settings = groups[3].items;
  return isPlatformAdmin
    ? [...settings, { to: "/app/developer", label: "Developer", icon: Wrench }]
    : settings;
}

export default function AppShell() {
  const { user, activeOrg, signOut, isPlatformAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const path = location.pathname;
  const name = user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Owner";

  const signOutNow = async () => {
    await signOut();
    navigate("/");
  };

  const MobileNav = () => (
    <nav className="space-y-5 p-4">
      {groups.map((group) => (
        <div key={group.label}>
          <p className="mb-2 px-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">{group.label}</p>
          <div className="space-y-1">
            {group.items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/app"}
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) => cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm",
                  isActive ? "bg-secondary text-primary" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <item.icon className="h-4 w-4" /> {item.label}
              </NavLink>
            ))}
          </div>
        </div>
      ))}
    </nav>
  );

  return (
    <div className="dark min-h-screen bg-background text-foreground">
      <div className="flex min-h-screen">
        <aside className="sticky top-0 hidden h-screen w-[224px] shrink-0 flex-col border-r border-border bg-background md:flex">
          <div className="border-b border-border px-5 py-[18px]"><Logo to="/app" /></div>
          <nav className="flex-1 space-y-2 p-3">
            {groups.map((group) => <GroupMenu key={group.label} group={group} path={path} />)}
          </nav>
          <div className="border-t border-border p-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex w-full items-center gap-3 rounded-xl p-2 text-left hover:bg-secondary">
                  <span className="grid h-9 w-9 place-items-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                    {name[0]?.toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{name}</span><span className="block truncate text-xs text-muted-foreground">{activeOrg?.organization?.name || "Owner"}</span></span>
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="right" align="end" className="w-56">
                <DropdownMenuItem asChild><Link to="/app/settings"><UserRoundCog className="mr-2 h-4 w-4" />Settings</Link></DropdownMenuItem>
                {isPlatformAdmin && <DropdownMenuItem asChild><Link to="/admin"><ShieldCheck className="mr-2 h-4 w-4" />Platform admin</Link></DropdownMenuItem>}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={signOutNow}><LogOut className="mr-2 h-4 w-4" />Sign out</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          <header className="sticky top-0 z-40 flex h-14 items-center border-b border-border bg-background/95 px-4 backdrop-blur md:hidden">
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild><Button variant="ghost" size="icon" className="md:hidden"><Menu className="h-5 w-5" /></Button></SheetTrigger>
              <SheetContent side="left" className="w-80 overflow-y-auto p-0">
                <SheetHeader className="border-b border-border p-4"><SheetTitle><Logo to="/app" /></SheetTitle></SheetHeader>
                <MobileNav />
              </SheetContent>
            </Sheet>
            <span className="ml-auto flex items-center gap-2 text-xs text-muted-foreground"><span className="h-2 w-2 rounded-full bg-emerald-400" /> Agent online</span>
          </header>
          <PaymentTestModeBanner />
          <PastDueBanner />
          <main className="min-h-screen"><Outlet /></main>
        </div>
      </div>
      {path !== "/app" && <FloatingAssistant />}
    </div>
  );
}
