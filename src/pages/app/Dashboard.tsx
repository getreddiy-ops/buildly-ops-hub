import { Link } from "react-router-dom";
import { Briefcase, Users, FileText, Clock, DollarSign, Sparkles, ArrowRight } from "lucide-react";
import Assistant from "./Assistant";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";

const stats = [
  { label: "Open Leads", value: "—", icon: Users, to: "/app/leads" },
  { label: "Active Jobs", value: "—", icon: Briefcase, to: "/app/jobs" },
  { label: "Pending Estimates", value: "—", icon: FileText, to: "/app/estimates" },
  { label: "Hours This Week", value: "—", icon: Clock, to: "/app/time" },
  { label: "Revenue MTD", value: "—", icon: DollarSign, to: "/app/invoices" },
];

export default function Dashboard() {
  const { activeOrg, user } = useAuth();
  const firstName = user?.email?.split("@")[0] ?? "";

  return (
    <div className="flex flex-col gap-6">
      {/* AI-first hero */}
      <div>
        <div className="mb-3 flex items-center gap-2 text-primary">
          <Sparkles className="h-5 w-5" />
          <span className="text-sm font-medium uppercase tracking-wide">Your AI operator</span>
        </div>
        <h1 className="text-2xl font-semibold sm:text-3xl">
          Hey{firstName ? `, ${firstName}` : ""} — what should we get done?
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {activeOrg
            ? `${activeOrg.organization.name} · Ask for a lead, estimate, invoice, schedule, or a full PDF — I handle it.`
            : "Ask for a lead, estimate, invoice, schedule, or a full PDF — I handle it."}
        </p>
      </div>

      {/* The Assistant is the main surface */}
      <Card className="p-0 overflow-hidden">
        <div className="h-[calc(100vh-22rem)] min-h-[440px] p-4 sm:p-6">
          <Assistant compact />
        </div>
      </Card>

      {/* Quick stats strip below */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {stats.map((s) => (
          <Link
            key={s.label}
            to={s.to}
            className="group rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary hover:bg-accent"
          >
            <div className="flex items-center justify-between">
              <s.icon className="h-4 w-4 text-muted-foreground" />
              <ArrowRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
            </div>
            <div className="mt-2 text-2xl font-semibold">{s.value}</div>
            <div className="text-xs text-muted-foreground">{s.label}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
