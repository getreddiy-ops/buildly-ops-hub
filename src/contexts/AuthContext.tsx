import { createContext, useContext, useEffect, useRef, useState, ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type AppRole = "platform_admin" | "agent" | "owner" | "admin" | "worker";

interface Membership {
  organization_id: string;
  role: AppRole;
  organization: { id: string; name: string; slug: string | null };
}

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  loading: boolean;
  memberships: Membership[];
  activeOrg: Membership | null;
  setActiveOrgId: (id: string) => void;
  isPlatformAdmin: boolean;
  isAgent: boolean;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [activeOrgId, setActiveOrgIdState] = useState<string | null>(
    () => localStorage.getItem("activeOrgId"),
  );
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);
  const [isAgent, setIsAgent] = useState(false);
  const profileLoadId = useRef(0);

  const setActiveOrgId = (id: string) => {
    localStorage.setItem("activeOrgId", id);
    setActiveOrgIdState(id);
  };

  const loadProfile = async (uid: string) => {
    const { data: mems } = await supabase
      .from("organization_members")
      .select("organization_id, role, organization:organizations(id,name,slug)")
      .eq("user_id", uid);
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", uid);
    const list = (mems ?? []) as unknown as Membership[];
    setMemberships(list);
    setIsPlatformAdmin(!!roles?.some((r) => r.role === "platform_admin"));
    setIsAgent(!!roles?.some((r) => r.role === "agent"));
    if (!activeOrgId && list.length > 0) setActiveOrgId(list[0].organization_id);
  };

  const clearProfile = () => {
    setMemberships([]);
    setIsPlatformAdmin(false);
    setIsAgent(false);
  };

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      const requestId = ++profileLoadId.current;
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        setLoading(true);
        setTimeout(() => {
          loadProfile(s.user.id).finally(() => {
            if (profileLoadId.current === requestId) setLoading(false);
          });
        }, 0);
      } else {
        clearProfile();
        setLoading(false);
      }
    });

    supabase.auth.getSession().then(async ({ data }) => {
      const requestId = ++profileLoadId.current;
      setSession(data.session);
      setUser(data.session?.user ?? null);
      if (data.session?.user) await loadProfile(data.session.user.id);
      else clearProfile();
      if (profileLoadId.current === requestId) setLoading(false);
    });

    return () => sub.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activeOrg =
    memberships.find((m) => m.organization_id === activeOrgId) ?? memberships[0] ?? null;

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        memberships,
        activeOrg,
        setActiveOrgId,
        isPlatformAdmin,
        isAgent,
        signOut: async () => {
          await supabase.auth.signOut();
          localStorage.removeItem("activeOrgId");
        },
        refresh: async () => {
          if (user) await loadProfile(user.id);
        },
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
