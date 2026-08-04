/**
 * Resolves the origin used for Stripe success / cancel / return URLs.
 *
 * Security: never trust a raw request header for redirects. We only accept an
 * origin that is explicitly allowlisted, otherwise we fall back to the
 * authoritative production domain.
 */

export const PRODUCTION_ORIGIN = "https://contractoros.online";

/** Exact origins that are always allowed. */
const STATIC_ALLOWED_ORIGINS = [
  "https://contractoros.online",
  "https://www.contractoros.online",
];

/** Lovable preview / published hosts, allowed only for preview testing. */
const PREVIEW_HOST_PATTERN = /^[a-z0-9-]+\.lovable\.app$/i;

function normalize(origin: string): string {
  return origin.trim().replace(/\/+$/, "");
}

export function isAllowedOrigin(origin: string | null | undefined): boolean {
  if (!origin) return false;
  let url: URL;
  try {
    url = new URL(normalize(origin));
  } catch {
    return false;
  }
  if (url.protocol !== "https:") return false;
  const candidate = `${url.protocol}//${url.host}`;
  if (STATIC_ALLOWED_ORIGINS.includes(candidate.toLowerCase())) return true;
  return PREVIEW_HOST_PATTERN.test(url.host);
}

/**
 * Picks the best origin for redirect URLs:
 * 1. the request's Origin header when allowlisted,
 * 2. the request's Referer origin when allowlisted,
 * 3. PUBLIC_APP_URL when allowlisted,
 * 4. the production fallback.
 */
export function resolveAppOrigin(
  req?: { headers: { get(name: string): string | null } } | null,
  publicAppUrl?: string | null,
): string {
  const candidates: (string | null | undefined)[] = [];
  const origin = req?.headers.get("origin");
  candidates.push(origin);
  const referer = req?.headers.get("referer");
  if (referer) {
    try {
      candidates.push(new URL(referer).origin);
    } catch {
      /* ignore malformed referer */
    }
  }
  candidates.push(publicAppUrl);

  for (const candidate of candidates) {
    if (isAllowedOrigin(candidate)) return normalize(candidate as string);
  }
  return PRODUCTION_ORIGIN;
}

export function checkoutSuccessUrl(origin: string): string {
  return `${origin}/app/billing?checkout=success&session_id={CHECKOUT_SESSION_ID}`;
}

export function checkoutCancelUrl(origin: string): string {
  return `${origin}/app/billing?checkout=cancelled`;
}

export function billingPortalReturnUrl(origin: string): string {
  return `${origin}/app/billing`;
}
