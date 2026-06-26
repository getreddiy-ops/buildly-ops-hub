import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Briefcase, Users, FileText, Clock, DollarSign } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const stats = [
  { label: "Open Leads", value: "—", icon: Users },
  { label: "Active Jobs", value: "—", icon: Briefcase },
  { label: "Pending Estimates", value: "—", icon: FileText },
  { label: "Hours This Week", value: "—", icon: Clock },
  { label: "Revenue MTD", value: "—", icon: DollarSign },
];

export default function Dashboard() {
  const { activeOrg, user } = useAuth();
  return (
    <>
      <PageHeader
        title={`Welcome${user?.email ? `, ${user.email.split("@")[0]}` : ""}`}
        description={activeOrg ? `${activeOrg.organization.name} · ${activeOrg.role}` : ""}
      />
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-normal text-muted-foreground">{s.label}</CardTitle>
              <s.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent><div className="text-2xl font-semibold">{s.value}</div></CardContent>
          </Card>
        ))}
      </div>
      <EmptyState
        icon={Briefcase}
        title="Your business at a glance — coming together"
        description="Start by adding a lead or a job. Numbers above will fill in as your team works."
      />
    </>
  );
}
