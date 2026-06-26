import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, Users, FileText, Briefcase, HardHat, Clock,
  CheckSquare, DollarSign, Bot, MessageSquare, Settings, LogOut, CreditCard, Phone, Sparkles,
  Receipt, FileSignature, Palette, Code2,
} from "lucide-react";


import { useAuth } from "@/contexts/AuthContext";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";
import { PastDueBanner } from "@/components/PastDueBanner";
import { useBranding } from "@/hooks/useBranding";
import { Link } from "react-router-dom";
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
  { to: "/app/time", label: "Time Tracking", icon: Clock },
  { to: "/app/approvals", label: "Approvals", icon: CheckSquare },
  { to: "/app/costing", label: "Job Costing", icon: DollarSign },
  { to: "/app/business-profile", label: "AI Business Profile", icon: Sparkles },
  { to: "/app/branding", label: "Branding", icon: Palette },

  { to: "/app/assistant", label: "AI Assistant", icon: Bot },
  { to: "/app/phone-assistant", label: "Phone Assistant", icon: Phone },

  { to: "/app/messages", label: "Messages", icon: MessageSquare },
  { to: "/app/billing", label: "Billing", icon: CreditCard },
  { to: "/app/settings", label: "Settings", icon: Settings },
];

export default function AppShell() {
  const { user, activeOrg, signOut, memberships, setActiveOrgId } = useAuth();
  const { branding } = useBranding();

  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen w-full bg-background">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:flex">
        <div className="border-b border-sidebar-border p-4">
          {branding?.logo_signed_url ? (
            <Link to="/app" className="flex items-center gap-2">
              <img
                src={branding.logo_signed_url}
                alt={branding.name}
                className="max-h-10 max-w-[180px] object-contain"
              />
            </Link>
          ) : (
            <Logo to="/app" />
          )}
        </div>

        {memberships.length > 1 && (
          <div className="border-b border-sidebar-border p-3">
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
          </div>
        )}
        <nav className="flex-1 overflow-y-auto p-3">
          <ul className="space-y-0.5">
            {nav.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.end}
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
          </ul>
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
      <main className="flex-1 overflow-y-auto">
        <PaymentTestModeBanner />
        <PastDueBanner />
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
