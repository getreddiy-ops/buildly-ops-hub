// Central routing rule for where a user should land after auth (Google or email).
// Priority: platform_admin > worker (field app) > owner/admin/manager (office app)
//         > agent-only > no memberships (onboarding).

type Role = "platform_admin" | "agent" | "owner" | "admin" | "worker";

interface Membership {
  role: Role | string;
}

interface Args {
  memberships: Membership[];
  isPlatformAdmin: boolean;
  isAgent: boolean;
}

export function resolvePostLoginRoute({ memberships, isPlatformAdmin, isAgent }: Args): string {
  if (isPlatformAdmin) return "/admin";

  if (memberships.length > 0) {
    const roles = memberships.map((m) => m.role);
    const hasOffice = roles.some((r) => r === "owner" || r === "admin");
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
  // Reject separators and control characters before URL normalization.
  // eslint-disable-next-line no-control-regex
  if (!raw.startsWith("/") || raw.startsWith("//") || /[\\\u0000-\u0020\u007f]/.test(raw)) return null;
  try {
    const path = decodeURIComponent(raw.split(/[?#]/, 1)[0]);
    // eslint-disable-next-line no-control-regex
    if (path.startsWith("//") || /[\\\u0000-\u0020\u007f]/.test(path)) return null;
    const origin = "https://fasttract.invalid";
    if (new URL(raw, origin).origin !== origin) return null;
  } catch { return null; }
  return raw;
}
