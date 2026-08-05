import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/hooks/useSubscription";
import { getImpersonation } from "@/lib/impersonation";

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <FullPageSpinner />;
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  return <>{children}</>;
}

export function RequireOrg({ children }: { children: ReactNode }) {
  const { user, loading, memberships, isPlatformAdmin, isAgent } = useAuth();
  if (loading) return <FullPageSpinner />;
  if (!user) return <Navigate to="/login" replace />;
  if (memberships.length === 0) {
    if (isPlatformAdmin) return <Navigate to="/admin" replace />;
    if (isAgent) return <Navigate to="/agent" replace />;
    return <Navigate to="/onboarding" replace />;
  }
  // Worker-only memberships never see the office app — push them to the field app.
  const roles = memberships.map((m) => m.role);
  const hasOffice = roles.some((r) => r === "owner" || r === "admin");
  if (!hasOffice && roles.every((r) => r === "worker")) {
    return <Navigate to="/field" replace />;
  }
  return <>{children}</>;
}

/** Office portal is for owners/admins only. Workers are redirected to /field. */
export function RequireOfficeRole({ children }: { children: ReactNode }) {
  const { activeOrg, loading, isPlatformAdmin } = useAuth();
  if (loading) return <FullPageSpinner />;
  if (isPlatformAdmin) return <>{children}</>;
  const role = activeOrg?.role;
  if (role !== "owner" && role !== "admin") return <Navigate to="/field" replace />;
  return <>{children}</>;
}

export function RequireRole({
  children,
  roles,
}: {
  children: ReactNode;
  roles: Array<"owner" | "admin" | "worker">;
}) {
  const { activeOrg, loading } = useAuth();
  if (loading) return <FullPageSpinner />;
  if (!activeOrg || !roles.includes(activeOrg.role as "owner" | "admin" | "worker"))
    return <Navigate to="/app" replace />;
  return <>{children}</>;
}

export function RequirePlatformAdmin({
  children,
  redirectTo = "/app",
}: {
  children: ReactNode;
  redirectTo?: string;
}) {
  const { isPlatformAdmin, loading } = useAuth();
  if (loading) return <FullPageSpinner />;
  if (!isPlatformAdmin) return <Navigate to={redirectTo} replace />;
  return <>{children}</>;
}

/**
 * The office portal requires an active subscription (a 7-day trial counts).
 * Billing and account settings stay reachable so an expired org can resubscribe.
 */
const SUBSCRIPTION_EXEMPT = ["/app/billing", "/app/settings"];

export function RequireSubscription({ children }: { children: ReactNode }) {
  const { loading, isPlatformAdmin } = useAuth();
  const { isActive, loading: subLoading } = useSubscription();
  const location = useLocation();

  if (SUBSCRIPTION_EXEMPT.some((p) => location.pathname.startsWith(p))) return <>{children}</>;
  // Admin support sessions keep full access even if the client's plan lapsed.
  if (getImpersonation()) return <>{children}</>;
  if (loading || subLoading) return <FullPageSpinner />;
  if (isPlatformAdmin || isActive) return <>{children}</>;
  return <Navigate to="/app/billing" state={{ from: location, reason: "subscription" }} replace />;
}

export function RequireAgent({ children }: { children: ReactNode }) {
  const { isAgent, loading } = useAuth();
  if (loading) return <FullPageSpinner />;
  if (!isAgent) return <Navigate to="/app" replace />;
  return <>{children}</>;
}

function FullPageSpinner() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  );
}
