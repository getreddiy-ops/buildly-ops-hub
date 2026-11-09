import { Capacitor } from "@capacitor/core";

export const isNativeApp = () => Capacitor.isNativePlatform();

// Email links open in the system browser. Never send capacitor://localhost to
// the authentication service as a public email callback.
export function authEmailRedirect(path: "/onboarding" | "/reset-password") {
  return `${isNativeApp() ? "https://fasttract-app.vercel.app" : window.location.origin}${path}`;
}
