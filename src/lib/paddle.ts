import { supabase } from "@/integrations/supabase/client";

const clientToken = import.meta.env.VITE_PAYMENTS_CLIENT_TOKEN;

declare global {
  interface Window {
    Paddle: any;
  }
}

export function getPaddleEnvironment(): "sandbox" | "live" {
  return clientToken?.startsWith("test_") ? "sandbox" : "live";
}

// Custom event dispatched from Paddle's global eventCallback so any component
// (checkout hook, banners, tests) can react to checkout errors/close without
// silent failures.
export const PADDLE_EVENT = "fasttract:paddle-event";

let paddleInitialized = false;
let paddleInitPromise: Promise<void> | null = null;

export async function initializePaddle() {
  if (paddleInitialized) return;
  if (paddleInitPromise) return paddleInitPromise;
  if (!clientToken) throw new Error("VITE_PAYMENTS_CLIENT_TOKEN is not set");

  paddleInitPromise = new Promise<void>((resolve, reject) => {
    const finishInit = () => {
      try {
        const paddleJsEnvironment =
          getPaddleEnvironment() === "sandbox" ? "sandbox" : "production";
        window.Paddle.Environment.set(paddleJsEnvironment);
        window.Paddle.Initialize({
          token: clientToken,
          eventCallback: (event: any) => {
            // Surface Paddle checkout lifecycle to the app. Without this the
            // checkout can fail silently (e.g. domain not approved, price
            // misconfigured, network blocked) and the user sees nothing.
            try {
              // eslint-disable-next-line no-console
              console.info("[paddle]", event?.name, event);
              window.dispatchEvent(
                new CustomEvent(PADDLE_EVENT, { detail: event }),
              );
            } catch {
              /* no-op */
            }
          },
        });
        paddleInitialized = true;
        resolve();
      } catch (err) {
        reject(err);
      }
    };

    if (typeof window !== "undefined" && (window as any).Paddle) {
      finishInit();
      return;
    }

    const script = document.createElement("script");
    script.src = "https://cdn.paddle.com/paddle/v2/paddle.js";
    script.async = true;
    script.onload = finishInit;
    script.onerror = () =>
      reject(new Error("Failed to load Paddle.js (network or CSP block)"));
    document.head.appendChild(script);
  });

  return paddleInitPromise;
}

export async function getPaddlePriceId(priceId: string): Promise<string> {
  const environment = getPaddleEnvironment();
  const { data, error } = await supabase.functions.invoke("get-paddle-price", {
    body: { priceId, environment },
  });
  if (error || !data?.paddleId) {
    const detail = error?.message || data?.error || "unknown error";
    throw new Error(`Failed to resolve price "${priceId}": ${detail}`);
  }
  return data.paddleId;
}
