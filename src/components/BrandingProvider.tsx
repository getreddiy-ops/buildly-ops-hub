import { useEffect } from "react";
import { useBranding } from "@/hooks/useBranding";
import { hexToHslString, readableForeground } from "@/lib/color";

/**
 * Applies the active organization's brand color as the --primary CSS token
 * so the dashboard accent (buttons, links, active nav, focus rings) reflects
 * the customer's brand. Accent-only — does not touch background or surfaces.
 */
export function BrandingProvider({ children }: { children: React.ReactNode }) {
  const { branding } = useBranding();

  useEffect(() => {
    const root = document.documentElement;
    const color = branding?.brand_color;
    const hsl = color ? hexToHslString(color) : null;
    if (hsl) {
      root.style.setProperty("--primary", hsl);
      root.style.setProperty("--primary-foreground", readableForeground(color!));
      root.style.setProperty("--ring", hsl);
      root.style.setProperty("--sidebar-primary", hsl);
      root.style.setProperty("--sidebar-primary-foreground", readableForeground(color!));
      root.style.setProperty("--accent", hsl);
    } else {
      root.style.removeProperty("--primary");
      root.style.removeProperty("--primary-foreground");
      root.style.removeProperty("--ring");
      root.style.removeProperty("--sidebar-primary");
      root.style.removeProperty("--sidebar-primary-foreground");
      root.style.removeProperty("--accent");
    }
  }, [branding?.brand_color]);

  return <>{children}</>;
}
