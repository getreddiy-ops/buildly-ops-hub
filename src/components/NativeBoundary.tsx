import { Navigate, useLocation } from "react-router-dom";
import { isNativeApp } from "@/lib/native";

// The native release is a free companion to existing FastTract accounts.
// Keep web marketing and digital-subscription checkout outside this release.
export function NativeBoundary({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation();
  const allowed = /^\/(app|field|agent|admin|super)(\/|$)/.test(pathname)
    || ["/login", "/signup", "/onboarding", "/reset-password", "/account", "/privacy", "/terms", "/contact", "/legal/privacy", "/legal/terms"].includes(pathname);
  if (isNativeApp() && !allowed) return <Navigate to="/login" replace />;
  return <>{children}</>;
}
