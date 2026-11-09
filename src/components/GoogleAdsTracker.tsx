import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { loadGoogleAds, trackPageview } from "@/lib/gtag";
import { isNativeApp } from "@/lib/native";

/** Loads the Google Ads / gtag.js script once and fires a pageview on every route change. */
export function GoogleAdsTracker() {
  const location = useLocation();

  useEffect(() => {
    if (!isNativeApp()) loadGoogleAds();
  }, []);

  useEffect(() => {
    if (!isNativeApp()) trackPageview(location.pathname + location.search);
  }, [location.pathname, location.search]);

  return null;
}
