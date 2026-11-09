import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/hooks/useSubscription";

/** Office-app paths a business can always reach, so it can pick a plan or fix its account. */
export const ALWAYS_OPEN_PATHS = ["/app/billing", "/app/settings", "/app/profile", "/app/business-profile", "/app/branding", "/app/company"];

export function isAlwaysOpen(pathname: string) {
  return ALWAYS_OPEN_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/**
 * The office app needs an active plan (trial, paid, past-due grace, or complimentary).
 * Without one, every other page sends the user to Plan & billing.
 * Platform admins pass so support can work in any business.
 */
export function SubscriptionGate({ children }: { children: React.ReactNode }) {
  const { isPlatformAdmin } = useAuth();
  const { isActive, loading } = useSubscription();
  const { pathname } = useLocation();
  if (isPlatformAdmin || isAlwaysOpen(pathname)) return <>{children}</>;
  if (loading) return <div className="p-8 text-sm text-muted-foreground" role="status">Checking your plan…</div>;
  if (!isActive) return <Navigate to="/app/billing" replace />;
  return <>{children}</>;
}
