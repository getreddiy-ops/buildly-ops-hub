import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { Wrench } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";
import { PastDueBanner } from "@/components/PastDueBanner";
import { FloatingAssistant } from "@/components/FloatingAssistant";
import { WorkspaceFrame } from "@/components/workspace/WorkspaceFrame";
import { workspaceGroups } from "@/components/workspace/navigation";
export function getSettingsGroup(isPlatformAdmin: boolean) {
  const items = workspaceGroups.find(g => g.label === "Company")!.items;
  return isPlatformAdmin ? [...items, { to: "/app/developer", label: "Developer", icon: Wrench }] : items;
}
export default function AppShell() {
  const { user, activeOrg, signOut, isPlatformAdmin } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const name = user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Owner";
  return <WorkspaceFrame path={pathname} name={name} company={activeOrg?.organization?.name || "My company"} admin={isPlatformAdmin} onSignOut={async () => { await signOut(); navigate("/"); }}>
    <PaymentTestModeBanner /><PastDueBanner /><Outlet />
    {pathname !== "/app" && <FloatingAssistant />}
  </WorkspaceFrame>;
}
