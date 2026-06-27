import { GOOGLE_ADS_ID, GADS_SIGNUP_LABEL, GADS_TRIAL_LABEL } from "./ads-config";

declare global {
  interface Window {
    dataLayer: unknown[];
    gtag: (...args: unknown[]) => void;
  }
}

let loaded = false;

export function loadGoogleAds() {
  if (loaded || typeof window === "undefined") return;
  if (!GOOGLE_ADS_ID) return;
  loaded = true;

  const s = document.createElement("script");
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${GOOGLE_ADS_ID}`;
  document.head.appendChild(s);

  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() {
    // eslint-disable-next-line prefer-rest-params
    window.dataLayer.push(arguments);
  };
  window.gtag("js", new Date());
  window.gtag("config", GOOGLE_ADS_ID);
}

export function trackPageview(path: string) {
  if (!GOOGLE_ADS_ID || typeof window === "undefined" || !window.gtag) return;
  window.gtag("config", GOOGLE_ADS_ID, { page_path: path });
}

function fireConversion(label: string, value?: number) {
  if (!GOOGLE_ADS_ID || !label) return;
  if (typeof window === "undefined" || !window.gtag) return;
  window.gtag("event", "conversion", {
    send_to: `${GOOGLE_ADS_ID}/${label}`,
    value: value ?? 0,
    currency: "USD",
  });
}

export const trackSignup = () => fireConversion(GADS_SIGNUP_LABEL);
export const trackTrialStart = (value?: number) => fireConversion(GADS_TRIAL_LABEL, value);
