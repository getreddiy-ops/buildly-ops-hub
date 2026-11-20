import { Capacitor } from "@capacitor/core";

export const isNativeApp = () => Capacitor.isNativePlatform();

// Email links open in the system browser. Never send capacitor://localhost to
// the authentication service as a public email callback.
export function authEmailRedirect(path: "/onboarding" | "/reset-password" | JoinInvitePath) {
  return `${isNativeApp() ? "https://fasttract-app.vercel.app" : window.location.origin}${path}`;
}

export type JoinInvitePath = `/join?invite=${string}`;

export function isJoinInvitePath(path: string | null | undefined): path is JoinInvitePath {
  return typeof path === "string" && path.startsWith("/join?invite=");
}
