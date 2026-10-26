import { useAuth } from "@/contexts/AuthContext";
import FieldClock from "./FieldClock";
import FieldJobs from "./FieldJobs";

export default function FieldDashboard() {
  const { user } = useAuth();
  return <div className="mx-auto max-w-3xl space-y-8">
    <header><h1 className="text-2xl font-semibold">My crew dashboard</h1>
      <p className="text-muted-foreground">{user?.user_metadata?.full_name || "Your workspace"} · Clock in or out and view your assigned open jobs. Job details are read only.</p></header>
    <FieldClock embedded />
    <FieldJobs />
  </div>;
}
