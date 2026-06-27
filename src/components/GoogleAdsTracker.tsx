import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { loadGoogleAds, trackPageview } from "@/lib/gtag";

/** Loads the Google Ads / gtag.js script once and fires a pageview on every route change. */
export function GoogleAdsTracker() {
  const location = useLocation();

  useEffect(() => {
    loadGoogleAds();
  }, []);

  useEffect(() => {
    trackPageview(location.pathname + location.search);
  }, [location.pathname, location.search]);

  return null;
}
