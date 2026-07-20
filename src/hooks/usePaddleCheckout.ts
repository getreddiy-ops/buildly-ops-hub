import { useEffect, useState } from "react";
import { initializePaddle, getPaddlePriceId, PADDLE_EVENT } from "@/lib/paddle";
import { toast } from "sonner";

export type CheckoutOptions = {
  priceId: string;
  quantity?: number;
  customerEmail?: string;
  customData?: Record<string, string>;
  successUrl?: string;
  displayMode?: "overlay" | "inline";
  frameTarget?: string;
};

export function usePaddleCheckout() {
  const [loading, setLoading] = useState(false);

  // Global listener: surface Paddle checkout errors as toasts so failures are
  // never silent. This complements per-call try/catch which only catches
  // synchronous init/resolve errors — actual iframe/render failures arrive
  // asynchronously via Paddle's eventCallback.
  useEffect(() => {
    const onEvent = (e: Event) => {
      const detail = (e as CustomEvent).detail as { name?: string; error?: any } | undefined;
      if (!detail?.name) return;
      if (detail.name === "checkout.error") {
        const msg =
          detail.error?.detail ||
          detail.error?.message ||
          "Checkout failed to load. If this keeps happening, please contact support.";
        toast.error(msg);
        // eslint-disable-next-line no-console
        console.error("[paddle checkout.error]", detail);
      }
      if (detail.name === "checkout.warning") {
        // eslint-disable-next-line no-console
        console.warn("[paddle checkout.warning]", detail);
      }
    };
    window.addEventListener(PADDLE_EVENT, onEvent);
    return () => window.removeEventListener(PADDLE_EVENT, onEvent);
  }, []);

  const openCheckout = async (options: CheckoutOptions) => {
    setLoading(true);
    try {
      await initializePaddle();
      const paddlePriceId = await getPaddlePriceId(options.priceId);
      // Overlay is the only supported customer-facing display mode.
      // Inline requires a valid frameTarget DOM node, and if the container
      // is missing/hidden Paddle throws "Cannot read properties of undefined
      // (reading 'appendChild')". Overlay is self-contained and reliable.
      const displayMode: "overlay" | "inline" = options.displayMode ?? "overlay";

      const settings: Record<string, unknown> = {
        displayMode,
        successUrl:
          options.successUrl ||
          `${window.location.origin}/app/billing?checkout=success`,
        allowLogout: false,
      };

      if (displayMode === "overlay") {
        settings.variant = "one-page";
      } else {
        // Inline path retained only for internal/embedded use. Requires the
        // caller to have already mounted the target element in the DOM.
        const frameTarget = options.frameTarget ?? "paddle-checkout-container";
        if (typeof document === "undefined" || !document.getElementById(frameTarget)) {
          throw new Error(
            `Inline checkout target #${frameTarget} not found. Use overlay mode instead.`,
          );
        }
        settings.frameTarget = frameTarget;
        settings.frameInitialHeight = 450;
        settings.frameStyle =
          "width: 100%; min-width: 312px; background-color: transparent; border: none;";
      }

      if (!window.Paddle?.Checkout?.open) {
        throw new Error("Paddle failed to initialize");
      }

      window.Paddle.Checkout.open({
        items: [{ priceId: paddlePriceId, quantity: options.quantity ?? 1 }],
        customer: options.customerEmail
          ? { email: options.customerEmail }
          : undefined,
        customData: options.customData,
        settings,
      });
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Could not open checkout. Please try again.";
      toast.error(message);
      // eslint-disable-next-line no-console
      console.error("[usePaddleCheckout] open failed:", err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return { openCheckout, loading };
}
