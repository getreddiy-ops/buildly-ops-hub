import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { highLevel, type HighLevelConnectionContext } from "@/integrations/highlevel/client";

type HighLevelContextValue = {
  connection: HighLevelConnectionContext | null;
  loading: boolean;
  error: string | null;
  firstName: string;
  reload: () => Promise<void>;
};

const HighLevelContext = createContext<HighLevelContextValue | null>(null);

function getFirstName(connection: HighLevelConnectionContext | null) {
  const raw = connection?.user?.name || connection?.user?.email || "there";
  return raw.includes("@") ? raw.split("@")[0] : raw.trim().split(/\s+/)[0] || "there";
}

export function HighLevelProvider({ children }: { children: React.ReactNode }) {
  const [connection, setConnection] = useState<HighLevelConnectionContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const verificationRef = useRef<Promise<void> | null>(null);

  const verify = useCallback((silent = false) => {
    if (verificationRef.current) return verificationRef.current;

    const verification = (async () => {
      if (!silent) setLoading(true);
      if (!silent) setError(null);
      highLevel.resetEmbeddedContext();

      try {
        const next = await highLevel.context();
        if (!next.connected || !next.locationId) {
          throw new Error("HighLevel did not provide an active FastTract workspace.");
        }
        setConnection((current) => {
          if (
            current?.locationId === next.locationId &&
            current?.companyId === next.companyId &&
            current?.user?.id === next.user?.id
          ) return current;
          return next;
        });
        setError(null);
      } catch (cause) {
        if (!silent) {
          setConnection(null);
          setError(cause instanceof Error ? cause.message : "Unable to verify the HighLevel workspace");
        }
      } finally {
        if (!silent) setLoading(false);
      }
    })().finally(() => {
      verificationRef.current = null;
    });

    verificationRef.current = verification;
    return verification;
  }, []);

  const reload = useCallback(() => verify(false), [verify]);

  useEffect(() => {
    void verify(false);
  }, [verify]);

  useEffect(() => {
    const silentlyVerify = () => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      void verify(true);
    };
    const intervalId = window.setInterval(silentlyVerify, 60_000);
    window.addEventListener("focus", silentlyVerify);
    window.addEventListener("pageshow", silentlyVerify);
    document.addEventListener("visibilitychange", silentlyVerify);
    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", silentlyVerify);
      window.removeEventListener("pageshow", silentlyVerify);
      document.removeEventListener("visibilitychange", silentlyVerify);
    };
  }, [verify]);

  const value = useMemo<HighLevelContextValue>(() => ({
    connection,
    loading,
    error,
    firstName: getFirstName(connection),
    reload,
  }), [connection, error, loading, reload]);

  return <HighLevelContext.Provider value={value}>{children}</HighLevelContext.Provider>;
}

export function useHighLevel() {
  const value = useContext(HighLevelContext);
  if (!value) throw new Error("useHighLevel must be used inside HighLevelProvider");
  return value;
}
