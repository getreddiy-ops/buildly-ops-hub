import { Home, Users, FolderOpen, Wallet, Building2, CalendarDays, FileText, Receipt, Clock3, Boxes, Wrench, Settings, Sparkles, ClipboardCheck, PhoneCall, MessageSquare, TerminalSquare, BadgeDollarSign } from "lucide-react";
export const workspaceGroups = [
  { label: "Home", to: "/app", icon: Home, description: "Your day, at a glance", items: [
    { to: "/app", label: "Overview", icon: Home }, { to: "/app/calendar", label: "Calendar", icon: CalendarDays }, { to: "/app/approvals", label: "Approvals", icon: ClipboardCheck },
  ] },
  { label: "Customers", to: "/app/customers", icon: Users, description: "Relationships & conversations", items: [
    { to: "/app/customers", label: "All customers", icon: Users }, { to: "/app/leads", label: "Leads & follow-up", icon: Sparkles }, { to: "/app/messages", label: "Messages", icon: MessageSquare },
  ] },
  { label: "Jobs", to: "/app/jobs", icon: FolderOpen, description: "A folder for every project", items: [
    { to: "/app/jobs", label: "Job folders", icon: FolderOpen }, { to: "/app/time", label: "Time tracking", icon: Clock3 }, { to: "/app/materials", label: "Materials", icon: Boxes },
  ] },
  { label: "Money", to: "/app/money", icon: Wallet, description: "Estimates, invoices & costs", items: [
    { to: "/app/estimates", label: "Estimates", icon: FileText }, { to: "/app/invoices", label: "Invoices & payments", icon: Receipt }, { to: "/app/contracts", label: "Contracts", icon: ClipboardCheck }, { to: "/app/costing", label: "Job costing", icon: BadgeDollarSign },
  ] },
  { label: "Company", to: "/app/company", icon: Building2, description: "Your people & preferences", items: [
    { to: "/app/crew", label: "People & crew", icon: Users }, { to: "/app/vendors", label: "Vendors", icon: Wrench }, { to: "/app/business-profile", label: "Business profile", icon: Building2 }, { to: "/app/branding", label: "Brand & documents", icon: FileText }, { to: "/app/phone-assistant", label: "Phone assistant", icon: PhoneCall }, { to: "/app/billing", label: "Billing & plan", icon: Receipt }, { to: "/app/settings", label: "Settings & memory", icon: Settings }, { to: "/app/command-center", label: "Command center", icon: TerminalSquare },
  ] },
];
export function activeWorkspaceGroup(path: string) {
  return workspaceGroups.find((group) => group.to === path || group.items.some((item) => item.to === path || (item.to !== "/app" && path.startsWith(item.to + "/")))) ?? workspaceGroups[0];
}
