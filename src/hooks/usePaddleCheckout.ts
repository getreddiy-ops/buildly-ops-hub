import { useState } from "react";
import { initializePaddle, getPaddlePriceId } from "@/lib/paddle";

export function usePaddleCheckout() {
  const [loading, setLoading] = useState(false);

  const openCheckout = async (options: {
    priceId: string;
    quantity?: number;
    customerEmail?: string;
    customData?: Record<string, string>;
    successUrl?: string;
    displayMode?: "overlay" | "inline";
    frameTarget?: string;
  }) => {
    setLoading(true);
    try {
      await initializePaddle();
      const paddlePriceId = await getPaddlePriceId(options.priceId);
      const displayMode = options.displayMode ?? "overlay";
      const settings: Record<string, unknown> = {
        displayMode,
        successUrl: options.successUrl || `${window.location.origin}/app/billing?checkout=success`,
        allowLogout: false,
        variant: "one-page",
      };
      if (displayMode === "inline") {
        settings.frameTarget = options.frameTarget ?? "paddle-checkout-container";
        settings.frameInitialHeight = 450;
        settings.frameStyle = "width: 100%; min-width: 312px; background-color: transparent; border: none;";
      }
      window.Paddle.Checkout.open({
        items: [{ priceId: paddlePriceId, quantity: options.quantity ?? 1 }],
        customer: options.customerEmail ? { email: options.customerEmail } : undefined,
        customData: options.customData,
        settings,
      });
    } finally {
      setLoading(false);
    }
  };

  return { openCheckout, loading };
}
