import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <FullPageSpinner />;
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  return <>{children}</>;
}

export function RequireOrg({ children }: { children: ReactNode }) {
  const { user, loading, memberships } = useAuth();
  if (loading) return <FullPageSpinner />;
  if (!user) return <Navigate to="/login" replace />;
  if (memberships.length === 0) return <Navigate to="/onboarding" replace />;
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

export function RequirePlatformAdmin({ children }: { children: ReactNode }) {
  const { isPlatformAdmin, loading } = useAuth();
  if (loading) return <FullPageSpinner />;
  if (!isPlatformAdmin) return <Navigate to="/app" replace />;
  return <>{children}</>;
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
