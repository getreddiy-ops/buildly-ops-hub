import { supabase } from "@/integrations/supabase/client";

const ADMIN_SESSION_KEY = "ft_admin_session";
const IMPERSONATION_KEY = "ft_impersonation";

export type ImpersonationMeta = {
  session_id: string;
  target_email: string;
  target_user_id: string | null;
  organization_id?: string | null;
  organization_name?: string | null;
  started_at: string;
};

type SavedAdminSession = {
  access_token: string;
  refresh_token: string;
  email?: string | null;
};

export function getImpersonation(): ImpersonationMeta | null {
  try {
    const raw = localStorage.getItem(IMPERSONATION_KEY);
    return raw ? (JSON.parse(raw) as ImpersonationMeta) : null;
  } catch {
    return null;
  }
}

export function getSavedAdminSession(): SavedAdminSession | null {
  try {
    const raw = localStorage.getItem(ADMIN_SESSION_KEY);
    return raw ? (JSON.parse(raw) as SavedAdminSession) : null;
  } catch {
    return null;
  }
}

export function clearImpersonation() {
  localStorage.removeItem(IMPERSONATION_KEY);
  localStorage.removeItem(ADMIN_SESSION_KEY);
}

/** Log an action. Uses the stored admin token so events stay attributed to the admin. */
export async function logImpersonationEvent(payload: {
  action: string;
  path?: string;
  details?: Record<string, unknown>;
}) {
  const meta = getImpersonation();
  const adminSession = getSavedAdminSession();
  if (!meta || !adminSession) return;
  try {
    await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-impersonate`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          Authorization: `Bearer ${adminSession.access_token}`,
        },
        body: JSON.stringify({
          type: "log",
          session_id: meta.session_id,
          target_user_id: meta.target_user_id,
          target_email: meta.target_email,
          organization_id: meta.organization_id ?? null,
          ...payload,
        }),
      },
    );
  } catch {
    /* logging must never break the workspace */
  }
}

/** Start impersonating a customer: stash the admin session, then follow the sign-in link. */
export async function startImpersonation(input: {
  user_id?: string | null;
  email?: string | null;
  organization_id?: string | null;
  organization_name?: string | null;
  reason?: string;
}) {
  const { data: sessionData } = await supabase.auth.getSession();
  const session = sessionData.session;
  if (!session) throw new Error("Your admin session expired — sign in again.");

  const { data, error } = await supabase.functions.invoke("admin-impersonate", {
    body: {
      type: "start",
      user_id: input.user_id ?? undefined,
      email: input.email ?? undefined,
      organization_id: input.organization_id ?? undefined,
      reason: input.reason ?? undefined,
    },
  });
  if (error) throw new Error(error.message);
  const res = data as {
    error?: string;
    session_id?: string;
    action_link?: string;
    target_email?: string;
    target_user_id?: string | null;
  };
  if (res?.error) throw new Error(res.error);
  if (!res?.action_link) throw new Error("Could not create a sign-in link for this account.");

  const adminSession: SavedAdminSession = {
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    email: session.user.email,
  };
  localStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify(adminSession));
  localStorage.setItem(
    IMPERSONATION_KEY,
    JSON.stringify({
      session_id: res.session_id,
      target_email: res.target_email ?? input.email ?? "",
      target_user_id: res.target_user_id ?? input.user_id ?? null,
      organization_id: input.organization_id ?? null,
      organization_name: input.organization_name ?? null,
      started_at: new Date().toISOString(),
    } satisfies ImpersonationMeta),
  );

  window.location.href = res.action_link;
}

/** Leave the customer account and restore the admin session. */
export async function exitImpersonation() {
  await logImpersonationEvent({ action: "impersonation_end", path: window.location.pathname });
  const adminSession = getSavedAdminSession();
  clearImpersonation();
  if (adminSession) {
    const { error } = await supabase.auth.setSession({
      access_token: adminSession.access_token,
      refresh_token: adminSession.refresh_token,
    });
    if (!error) {
      window.location.href = "/admin/workspace";
      return;
    }
  }
  await supabase.auth.signOut();
  window.location.href = "/login";
}
