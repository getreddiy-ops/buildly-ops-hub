import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "org.fasttract.app",
  appName: "FastTract",
  webDir: "dist",
  backgroundColor: "#120c09",
  ios: {
    contentInset: "automatic",
    preferredContentMode: "mobile",
  },
  android: {
    backgroundColor: "#120c09",
    allowMixedContent: false,
  },
};

export default config;
