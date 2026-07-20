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

type OpenMock = ReturnType<typeof vi.fn>;
const getOpenMock = (): OpenMock =>
  (window as unknown as { Paddle: { Checkout: { open: OpenMock } } }).Paddle.Checkout.open;

describe("usePaddleCheckout", () => {
  beforeEach(() => {
    vi.mocked(toast.error).mockClear();
    (window as unknown as { Paddle?: unknown }).Paddle = {
      Checkout: { open: vi.fn() },
    };
  });

  it("defaults to overlay mode with variant one-page and NO frameTarget", async () => {
    const { result } = renderHook(() => usePaddleCheckout());
    await act(async () => {
      await result.current.openCheckout({
        priceId: "contractor_os_pro_monthly",
        customerEmail: "owner@example.com",
        customData: { userId: "u1", orgId: "o1" },
        successUrl: "https://contractoros.online/app/billing?checkout=success",
      });
    });

    expect(getPaddlePriceId).toHaveBeenCalledWith("contractor_os_pro_monthly");
    const args = getOpenMock().mock.calls[0][0];
    expect(args.items[0].priceId).toBe("pri_live_abc123");
    expect(args.items[0].quantity).toBe(1);
    expect(args.customer).toEqual({ email: "owner@example.com" });
    expect(args.customData).toEqual({ userId: "u1", orgId: "o1" });
    expect(args.settings.displayMode).toBe("overlay");
    expect(args.settings.variant).toBe("one-page");
    expect(args.settings.successUrl).toBe(
      "https://contractoros.online/app/billing?checkout=success",
    );
    expect(args.settings.allowLogout).toBe(false);
    // Critical: overlay must NOT include any inline-only settings that
    // caused Paddle to call appendChild on an undefined container.
    expect(args.settings.frameTarget).toBeUndefined();
    expect(args.settings.frameStyle).toBeUndefined();
    expect(args.settings.frameInitialHeight).toBeUndefined();
  });

  it("explicit overlay mode also omits frameTarget", async () => {
    const { result } = renderHook(() => usePaddleCheckout());
    await act(async () => {
      await result.current.openCheckout({
        priceId: "contractor_os_pro_monthly",
        displayMode: "overlay",
      });
    });
    const args = getOpenMock().mock.calls[0][0];
    expect(args.settings.displayMode).toBe("overlay");
    expect(args.settings.frameTarget).toBeUndefined();
  });

  it("throws a descriptive error (never silent) when Paddle is unavailable", async () => {
    (window as unknown as { Paddle?: unknown }).Paddle = undefined;
    const { result } = renderHook(() => usePaddleCheckout());
    await expect(
      act(async () => {
        await result.current.openCheckout({
          priceId: "contractor_os_pro_monthly",
        });
      }),
    ).rejects.toThrow(/Paddle failed to initialize/);
  });

  it("refuses inline mode when the target container is missing", async () => {
    const { result } = renderHook(() => usePaddleCheckout());
    await expect(
      act(async () => {
        await result.current.openCheckout({
          priceId: "contractor_os_pro_monthly",
          displayMode: "inline",
          frameTarget: "does-not-exist",
        });
      }),
    ).rejects.toThrow(/Inline checkout target/);
    expect(getOpenMock()).not.toHaveBeenCalled();
  });
});
