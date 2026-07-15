// Central routing rule for where a user should land after auth (Google or email).
// Priority: platform_admin > worker (field app) > owner/admin/manager (office app)
//         > agent-only > no memberships (onboarding).

type Role = "platform_admin" | "agent" | "owner" | "admin" | "manager" | "worker";

interface Membership {
  role: Role | string;
}

interface Args {
  memberships: Membership[];
  isPlatformAdmin: boolean;
  isAgent: boolean;
}

export function resolvePostLoginRoute({ memberships, isPlatformAdmin, isAgent }: Args): string {
  // Platform admins always land in the admin console.
  if (isPlatformAdmin) return "/admin";

  // Users with an org membership go into the product, split by role.
  if (memberships.length > 0) {
    const roles = memberships.map((m) => m.role);
    const hasOffice = roles.some((r) => r === "owner" || r === "admin" || r === "manager");
    if (hasOffice) return "/app";
    if (roles.every((r) => r === "worker")) return "/field";
    return "/app";
  }

  // No org membership: agents go to their portal, everyone else onboards.
  if (isAgent) return "/agent";
  return "/onboarding";
}

/** Validate a `?next=` param — only allow same-origin app paths. */
export function safeNextPath(raw: string | null): string | null {
  if (!raw) return null;
  if (!raw.startsWith("/") || raw.startsWith("//")) return null;
  return raw;
}
