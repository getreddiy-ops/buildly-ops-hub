import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "app.lovable.buildlyopshub",
  appName: "buildly-ops-hub",
  webDir: "dist",
  server: {
    url: "https://1d49f476-8db3-4f42-923a-396122508a13.lovableproject.com?forceHideBadge=true",
    cleartext: true,
  },
};

export default config;
