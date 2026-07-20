import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { toast } from "sonner";

vi.mock("@/lib/paddle", () => ({
  initializePaddle: vi.fn().mockResolvedValue(undefined),
  getPaddlePriceId: vi.fn().mockResolvedValue("pri_live_abc123"),
  PADDLE_EVENT: "fasttract:paddle-event",
}));

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

import { usePaddleCheckout } from "./usePaddleCheckout";
import { getPaddlePriceId } from "@/lib/paddle";

describe("usePaddleCheckout", () => {
  beforeEach(() => {
    vi.mocked(toast.error).mockClear();
    (window as unknown as { Paddle?: unknown }).Paddle = {
      Checkout: { open: vi.fn() },
    };
  });

  it("resolves external price id, passes internal id to Paddle, and omits variant in inline mode", async () => {
    const { result } = renderHook(() => usePaddleCheckout());
    await act(async () => {
      await result.current.openCheckout({
        priceId: "contractor_os_pro_monthly",
        displayMode: "inline",
        customData: { userId: "u1" },
      });
    });
    expect(getPaddlePriceId).toHaveBeenCalledWith("contractor_os_pro_monthly");
    const openMock = (window as unknown as { Paddle: { Checkout: { open: ReturnType<typeof vi.fn> } } })
      .Paddle.Checkout.open;
    expect(openMock).toHaveBeenCalledTimes(1);
    const args = openMock.mock.calls[0][0];
    expect(args.items[0].priceId).toBe("pri_live_abc123");
    expect(args.settings.displayMode).toBe("inline");
    expect(args.settings.variant).toBeUndefined();
    expect(args.settings.frameTarget).toBe("paddle-checkout-container");
  });

  it("shows a toast (never silent) and rethrows when Paddle is unavailable", async () => {
    (window as unknown as { Paddle?: unknown }).Paddle = undefined;
    const { result } = renderHook(() => usePaddleCheckout());
    await expect(
      act(async () => {
        await result.current.openCheckout({
          priceId: "contractor_os_pro_monthly",
          displayMode: "inline",
        });
      }),
    ).rejects.toThrow(/Paddle failed to initialize/);
    expect(vi.mocked(toast.error)).toHaveBeenCalled();
  });
});
