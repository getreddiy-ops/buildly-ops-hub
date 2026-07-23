import { withSupabase } from "jsr:@supabase/server@^1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PRIVATE_HOST_PATTERNS = [
  /^localhost$/i,
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^169\.254\./,
  /^0\./,
  /^\[?::1\]?$/,
  /^172\.(1[6-9]|2\d|3[01])\./,
];

function safeUrl(input: string) {
  const value = /^https?:\/\//i.test(input) ? input : `https://${input}`;
  const url = new URL(value);
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("Only public HTTP websites can be scanned.");
  if (PRIVATE_HOST_PATTERNS.some((pattern) => pattern.test(url.hostname))) throw new Error("Private network addresses cannot be scanned.");
  url.hash = "";
  return url;
}

function absoluteUrl(value: string, base: URL) {
  try {
    return new URL(value, base).toString();
  } catch {
    return null;
  }
}

function extractAttribute(tag: string, name: string) {
  const match = tag.match(new RegExp(`${name}\\s*=\\s*["']([^"']+)["']`, "i"));
  return match?.[1] ?? null;
}

function colorScore(color: string) {
  const hex = color.replace("#", "");
  const expanded = hex.length === 3 ? hex.split("").map((v) => v + v).join("") : hex.slice(0, 6);
  const r = parseInt(expanded.slice(0, 2), 16);
  const g = parseInt(expanded.slice(2, 4), 16);
  const b = parseInt(expanded.slice(4, 6), 16);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const saturation = max - min;
  const brightness = (r + g + b) / 3;
  return saturation - Math.abs(brightness - 140) * 0.25;
}

function normalizeHex(color: string) {
  const clean = color.toLowerCase();
  if (clean.length === 4) return `#${clean[1]}${clean[1]}${clean[2]}${clean[2]}${clean[3]}${clean[3]}`;
  return clean.slice(0, 7);
}

export default {
  fetch: withSupabase({ auth: "user" }, async (req) => {
    try {
      const { website } = await req.json();
    const url = safeUrl(String(website ?? "").trim());
    const response = await fetch(url, {
      redirect: "follow",
      headers: { "User-Agent": "FastTract Brand Setup/1.0" },
      signal: AbortSignal.timeout(12_000),
    });
    if (!response.ok) throw new Error(`Website returned ${response.status}.`);
    const finalUrl = safeUrl(response.url);
    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html")) throw new Error("That URL does not appear to be a website.");
    const html = (await response.text()).slice(0, 1_500_000);

    const title = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim() ?? finalUrl.hostname.replace(/^www\./, "");
    const ogSiteName = html.match(/<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)["']/i)?.[1]?.trim();
    const logoCandidates: string[] = [];
    for (const tag of html.match(/<(?:meta|link|img)\b[^>]*>/gi) ?? []) {
      const rel = extractAttribute(tag, "rel") ?? "";
      const property = extractAttribute(tag, "property") ?? "";
      const itemprop = extractAttribute(tag, "itemprop") ?? "";
      const alt = extractAttribute(tag, "alt") ?? "";
      const className = extractAttribute(tag, "class") ?? "";
      const src = extractAttribute(tag, "src");
      const href = extractAttribute(tag, "href");
      const content = extractAttribute(tag, "content");
      if (/og:image|logo/i.test(property + itemprop) && content) logoCandidates.push(content);
      if (/icon|apple-touch-icon/i.test(rel) && href) logoCandidates.push(href);
      if (/logo/i.test(alt + className) && src) logoCandidates.unshift(src);
    }

    const colors = new Map<string, number>();
    for (const match of html.matchAll(/#[0-9a-f]{3,8}\b/gi)) {
      const color = normalizeHex(match[0]);
      if (/^#(?:fff(?:fff)?|000(?:000)?)$/i.test(color)) continue;
      colors.set(color, (colors.get(color) ?? 0) + 1);
    }
    const rankedColors = [...colors.entries()]
      .sort((a, b) => (b[1] * 8 + colorScore(b[0])) - (a[1] * 8 + colorScore(a[0])))
      .map(([color]) => color);
    const primaryColor = rankedColors[0] ?? "#ff5a2a";
    const secondaryColor = rankedColors.find((color) => color !== primaryColor) ?? "#241812";

    let logo: { data: string; contentType: string; sourceUrl: string } | null = null;
    for (const candidate of logoCandidates.slice(0, 8)) {
      const logoUrl = absoluteUrl(candidate, finalUrl);
      if (!logoUrl) continue;
      try {
        const logoTarget = safeUrl(logoUrl);
        const logoResponse = await fetch(logoTarget, { redirect: "follow", signal: AbortSignal.timeout(8_000) });
        const logoType = logoResponse.headers.get("content-type") ?? "";
        const length = Number(logoResponse.headers.get("content-length") ?? 0);
        if (!logoResponse.ok || !logoType.startsWith("image/") || length > 2_000_000) continue;
        const bytes = new Uint8Array(await logoResponse.arrayBuffer());
        if (bytes.length > 2_000_000) continue;
        let binary = "";
        for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
        logo = { data: btoa(binary), contentType: logoType.split(";")[0], sourceUrl: logoTarget.toString() };
        break;
      } catch {
        // Try the next public logo candidate.
      }
    }

    return new Response(JSON.stringify({
      companyName: ogSiteName || title,
      website: finalUrl.origin,
      primaryColor,
      secondaryColor,
      logo,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    } catch (error) {
      return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Brand scan failed." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }),
};
