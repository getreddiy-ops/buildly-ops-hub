import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const SITE = "https://fasttract.org";
const UPDATED = "2026-08-10";

const pages = [
  {
    path: "/",
    title: "FastTract | Contractor Estimating, CRM & AI Phone Answering",
    description: "Run your contracting business from first call to final invoice with AI phone answering, estimating, CRM, scheduling, and invoicing.",
    h1: "Run your contracting business from first call to final invoice",
    summary: "FastTract helps contractors answer calls, capture leads, draft estimates, manage jobs, track crews, create contracts, and send invoices from one app.",
    type: "software",
  },
  { path: "/pricing", title: "FastTract Pricing | Contractor Software Plans", description: "Compare FastTract plans for contractor CRM, AI estimating, voice workflows, and AI phone answering. Start with a 7-day free trial.", h1: "FastTract pricing for contractors", summary: "Choose the FastTract plan that fits your crew, workflow, and AI phone-answering needs.", type: "software" },
  { path: "/features", title: "Contractor Software Features | FastTract", description: "Explore FastTract features for AI phone answering, estimating, CRM, scheduling, crew time tracking, invoicing, and job management.", h1: "Every tool a contractor needs in one app", summary: "See how FastTract connects lead capture, estimates, jobs, crew time, invoices, payments, and AI assistance.", type: "software" },
  { path: "/demo", title: "FastTract Demo | See the Contractor App in Action", description: "Take a guided tour of FastTract on a phone, including AI phone answering, leads, estimating, scheduling, time tracking, job costs, and invoices.", h1: "See the FastTract contractor app in action", summary: "Walk through the complete contractor workflow from an answered call to a paid invoice.", type: "video" },
  { path: "/ai-photo-estimator", title: "AI Photo Estimator for Contractors | FastTract", description: "Turn customer photos and voice descriptions into draft contractor estimates using your unit pricing and final approval before sending.", h1: "AI photo and voice estimating for contractors", summary: "FastTract helps contractors draft estimates from job photos and spoken scope while keeping the contractor in control of final pricing.", type: "software" },
  { path: "/ai-phone-agent", title: "AI Phone Answering for Contractors | FastTract", description: "Answer contractor calls 24/7, capture lead details, book appointments, and write call information directly into your FastTract CRM.", h1: "AI phone answering for contractors", summary: "FastTract answers missed calls, qualifies the job, captures customer details, and creates the lead for follow-up.", type: "software" },
  { path: "/contractor-crm", title: "Contractor CRM | Lead & Customer Management | FastTract", description: "Manage contractor leads, customers, estimates, jobs, communications, and invoices together in the FastTract contractor CRM.", h1: "A CRM built for contractors", summary: "Keep every call, customer, estimate, job, and invoice connected to the right record.", type: "software" },
  { path: "/estimate-software", title: "Construction Estimate Software with AI | FastTract", description: "Draft contractor estimates from photos or voice, apply unit pricing, send branded proposals, and convert approved estimates into jobs.", h1: "Construction estimate software with AI", summary: "Create professional contractor estimates faster with AI-assisted scope, photos, voice, pricing, and your final review.", type: "software" },
  { path: "/invoice-software", title: "Contractor Invoice Software | FastTract", description: "Convert estimates into contractor invoices, send them by email or text, collect payments, and track balances by job and customer.", h1: "Contractor invoice software", summary: "Create, send, and track invoices without separating them from the customer, estimate, and job.", type: "software" },
  { path: "/concrete-contractor-software", title: "Concrete Contractor Software | FastTract", description: "Concrete contractor software for AI estimating, CRM, scheduling, crew time tracking, invoicing, and AI phone answering.", h1: "Concrete contractor software from lead to paid", summary: "Manage driveway, patio, slab, and flatwork leads, estimates, schedules, crew time, materials, and invoices.", type: "software" },
  { path: "/framing-contractor-software", title: "Framing Contractor Software | FastTract", description: "Framing contractor software for estimates, takeoffs, lead management, scheduling, crew tracking, invoices, and AI phone answering.", h1: "Framing contractor software for growing crews", summary: "Keep framing scopes, labor, materials, scheduling, crew time, and billing connected from one dashboard.", type: "software" },
  { path: "/fencing-contractor-software", title: "Fence Contractor Software | FastTract", description: "Fence contractor software for quoting, CRM, scheduling, materials, crew tracking, invoicing, and missed-call lead capture.", h1: "Fence contractor software for faster quoting", summary: "Manage fence leads, measurements, materials, estimates, schedules, and invoices in one workflow.", type: "software" },
  { path: "/landscaping-contractor-software", title: "Landscaping Contractor Software | FastTract", description: "Landscaping contractor software for lead capture, estimating, scheduling, crews, job costing, invoicing, and AI phone answering.", h1: "Landscaping contractor software that keeps jobs moving", summary: "Organize landscaping leads, recurring work, estimates, schedules, crew hours, job costs, and payments.", type: "software" },
  { path: "/roofing-contractor-software", title: "Roofing Contractor Software | FastTract", description: "Roofing contractor software for lead intake, photo-assisted estimates, scheduling, crews, invoices, CRM, and AI phone answering.", h1: "Roofing contractor software from inspection to invoice", summary: "Capture roofing leads, draft estimates, coordinate crews, track jobs, and invoice customers from one app.", type: "software" },
  { path: "/siding-contractor-software", title: "Siding Contractor Software | FastTract", description: "Siding contractor software for estimating, lead management, scheduling, material planning, crew tracking, and invoicing.", h1: "Siding contractor software for cleaner operations", summary: "Connect siding leads, measurements, scopes, materials, crews, estimates, jobs, and invoices.", type: "software" },
  { path: "/deck-builder-software", title: "Deck Builder Software | FastTract", description: "Deck builder software for estimates, CRM, scheduling, materials, job tracking, invoices, and AI phone answering.", h1: "Deck builder software from design call to final invoice", summary: "Manage deck leads, scopes, materials, estimates, schedules, customer records, and payments in FastTract.", type: "software" },
  { path: "/general-contractor-software", title: "General Contractor Software | FastTract", description: "General contractor software for CRM, estimates, contracts, scheduling, crew time, job costing, invoices, and AI assistance.", h1: "General contractor software for the whole job", summary: "Keep leads, customers, estimates, contracts, jobs, labor, materials, costs, and invoices together.", type: "software" },
  { path: "/resellers", title: "FastTract Reseller Program | Recurring Revenue", description: "Resell FastTract to contractors with supported onboarding, an agent portal, client management, and recurring payout tracking.", h1: "FastTract reseller program", summary: "Help contractors adopt FastTract while managing client accounts and recurring revenue through the reseller portal.", type: "webpage" },
  { path: "/blog", title: "FastTract Blog | Contractor Software & AI Guides", description: "Practical guides for contractors about AI estimating, CRM, phone answering, job management, invoicing, and running a profitable business.", h1: "Practical contractor software guides", summary: "Read field-focused guidance about estimating, missed calls, customer management, job workflows, and contractor software.", type: "webpage" },
  { path: "/blog/how-ai-estimating-helps-contractors-save-time", title: "How AI Estimating Helps Contractors Save Time | FastTract", description: "Learn how AI-assisted estimating creates a contractor-controlled draft from photos, scope, and saved unit pricing.", h1: "How AI estimating helps contractors save time", summary: "A practical explanation of where AI helps with estimate preparation and why contractors must still verify the final scope and price.", type: "article", date: "2025-01-15" },
  { path: "/blog/best-contractor-software-for-small-construction-companies", title: "Best Contractor Software for Small Construction Companies | FastTract", description: "Learn which CRM, estimating, scheduling, time tracking, invoicing, and payment capabilities matter most to a small construction company.", h1: "Choosing contractor software for a small construction company", summary: "A buyer's guide to replacing disconnected tools with a practical lead-to-payment workflow.", type: "article", date: "2025-01-20" },
  { path: "/blog/how-concrete-contractors-can-use-ai-to-quote-faster", title: "How Concrete Contractors Can Quote Faster with AI | FastTract", description: "See how concrete contractors can use photos, dimensions, scope, and unit pricing to prepare faster draft quotes with AI assistance.", h1: "How concrete contractors can use AI to quote faster", summary: "A workflow for drafting driveway, patio, and slab estimates while keeping site verification and final approval with the contractor.", type: "article", date: "2025-01-25" },
  { path: "/blog/why-contractors-miss-leads-and-how-ai-phone-answering-fixes-it", title: "How AI Phone Answering Captures Contractor Leads | FastTract", description: "Learn how AI phone answering captures contractor lead details, qualifies calls, and schedules the next step while crews are working.", h1: "Why contractors miss leads and how AI phone answering helps", summary: "A practical missed-call workflow for getting caller details into the CRM and back in front of the contractor.", type: "article", date: "2025-02-01" },
  { path: "/blog/how-to-turn-job-photos-into-faster-contractor-estimates", title: "Turn Job Photos into Faster Contractor Estimates | FastTract", description: "Learn which job photos and measurements help contractors prepare faster AI-assisted estimate drafts without surrendering final approval.", h1: "How to turn job photos into faster contractor estimates", summary: "A field checklist for collecting useful site photos, measurements, access details, and damage close-ups before drafting an estimate.", type: "article", date: "2025-02-08" },
  { path: "/blog/best-contractor-management-software-comparison", title: "Contractor Management Software Comparison for 2026 | FastTract", description: "Compare contractor management software by CRM, estimating, scheduling, field operations, invoicing, pricing, and AI workflow capabilities.", h1: "Contractor management software comparison for 2026", summary: "Compare FastTract with traditional construction and field-service platforms based on the workflow your contracting business needs.", type: "article", date: "2026-01-10" },
  { path: "/contact", title: "Contact FastTract | Contractor Software Demo", description: "Contact the FastTract team about contractor CRM, estimating, job management, crew tracking, invoicing, or AI phone answering.", h1: "Talk to the FastTract team", summary: "Tell us about your contracting business and the workflow you want to improve.", type: "webpage" },
  { path: "/legal/privacy", title: "Privacy Policy | FastTract", description: "Learn how FastTract, operated by Lynchmarc LLC, collects, uses, shares, and retains personal data.", h1: "FastTract privacy policy", summary: "Review how FastTract handles account, business, payment, and product-use information.", type: "webpage" },
  { path: "/legal/terms", title: "Terms of Service | FastTract", description: "Review the terms governing FastTract subscriptions, accounts, contractor workflows, and payments processed through Stripe.", h1: "FastTract terms of service", summary: "The terms governing access to and use of FastTract services.", type: "webpage" },
  { path: "/legal/refunds", title: "Refund Policy | FastTract", description: "Review FastTract's refund policy and learn how to request a refund for an eligible subscription payment.", h1: "FastTract refund policy", summary: "Eligibility, timing, and instructions for requesting a FastTract refund.", type: "webpage" },
];

const noindexRoutes = ["/login", "/signup", "/forgot-password", "/reset-password", "/onboarding", "/unsubscribe", "/app", "/field", "/agent", "/admin", "/super"];
const redirects = new Map([
  ["/privacy", "/legal/privacy"],
  ["/terms", "/legal/terms"],
  ["/refunds", "/legal/refunds"],
  ["/features/contractor-crm", "/contractor-crm"],
]);

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]);
}

function replaceOrInsert(html, pattern, replacement) {
  return pattern.test(html) ? html.replace(pattern, replacement) : html.replace("</head>", `  ${replacement}\n</head>`);
}

function schemaFor(page) {
  if (page.type === "article") {
    return {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: page.h1,
      description: page.description,
      datePublished: page.date,
      dateModified: UPDATED,
      mainEntityOfPage: `${SITE}${page.path}`,
      author: { "@type": "Organization", name: "FastTract", url: SITE },
      publisher: { "@type": "Organization", name: "Lynchmarc LLC", url: SITE },
    };
  }
  if (page.type === "software") {
    return {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: "FastTract",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web, iOS, Android",
      description: page.description,
      url: `${SITE}${page.path}`,
      offers: { "@type": "Offer", price: "69", priceCurrency: "USD" },
    };
  }
  if (page.type === "video") {
    return {
      "@context": "https://schema.org",
      "@type": "VideoObject",
      name: page.title,
      description: page.description,
      uploadDate: UPDATED,
      contentUrl: `${SITE}${page.path}`,
    };
  }
  return {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: page.title,
    description: page.description,
    url: `${SITE}${page.path}`,
  };
}

function staticContent(page) {
  const keyLinks = [
    ["/features", "Features"],
    ["/estimate-software", "Estimating software"],
    ["/ai-phone-agent", "AI phone answering"],
    ["/contractor-crm", "Contractor CRM"],
    ["/pricing", "Pricing"],
    ["/blog", "Contractor guides"],
  ];
  return `<main class="seo-prerender" data-static-seo="true" style="max-width:72rem;margin:0 auto;padding:3rem 1.25rem;font-family:system-ui,sans-serif;color:#f8fafc;background:#0f172a;min-height:100vh"><nav aria-label="FastTract"><a href="/" style="color:#fb923c;font-weight:700;text-decoration:none">FastTract</a>${keyLinks.map(([href, label]) => `<a href="${href}" style="color:#cbd5e1;margin-left:1rem">${label}</a>`).join("")}</nav><article style="max-width:48rem;margin-top:4rem"><h1 style="font-size:clamp(2rem,6vw,4rem);line-height:1.05">${escapeHtml(page.h1)}</h1><p style="font-size:1.2rem;line-height:1.7;color:#cbd5e1">${escapeHtml(page.summary)}</p><p><a href="/signup" style="color:#fb923c;font-weight:700">Start your FastTract trial</a> · <a href="/demo" style="color:#cbd5e1">Watch the demo</a></p></article></main>`;
}

function renderPage(template, page, { noindex = false } = {}) {
  const url = `${SITE}${page.path}`;
  let html = template;
  html = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(page.title)}</title>`);
  html = replaceOrInsert(html, /<meta\s+name="description"[^>]*>/i, `<meta name="description" content="${escapeHtml(page.description)}">`);
  html = replaceOrInsert(html, /<link\s+rel="canonical"[^>]*>/i, `<link rel="canonical" href="${url}">`);
  html = replaceOrInsert(html, /<meta\s+property="og:title"[^>]*>/i, `<meta property="og:title" content="${escapeHtml(page.title)}">`);
  html = replaceOrInsert(html, /<meta\s+property="og:description"[^>]*>/i, `<meta property="og:description" content="${escapeHtml(page.description)}">`);
  html = replaceOrInsert(html, /<meta\s+property="og:url"[^>]*>/i, `<meta property="og:url" content="${url}">`);
  html = replaceOrInsert(html, /<meta\s+name="twitter:title"[^>]*>/i, `<meta name="twitter:title" content="${escapeHtml(page.title)}">`);
  html = replaceOrInsert(html, /<meta\s+name="twitter:description"[^>]*>/i, `<meta name="twitter:description" content="${escapeHtml(page.description)}">`);
  html = html.replace(/<meta\s+name="robots"[^>]*>\s*/gi, "");
  if (noindex) html = html.replace("</head>", "  <meta name=\"robots\" content=\"noindex, nofollow\">\n</head>");
  html = html.replace("</head>", `  <script type="application/ld+json">${JSON.stringify(schemaFor(page)).replace(/</g, "\\u003c")}</script>\n</head>`);
  html = html.replace(/<div id="root"><\/div>/, `<div id="root">${staticContent(page)}</div>`);
  return html;
}

async function writeRoute(route, html) {
  if (route === "/") {
    await writeFile(path.join("dist", "index.html"), html);
    return;
  }
  const relative = route.replace(/^\//, "");
  const directory = path.join("dist", relative);
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, "index.html"), html);
  await mkdir(path.dirname(path.join("dist", `${relative}.html`)), { recursive: true });
  await writeFile(path.join("dist", `${relative}.html`), html);
}

const template = await readFile(path.join("dist", "index.html"), "utf8");

for (const page of pages) {
  await writeRoute(page.path, renderPage(template, page));
}

for (const route of noindexRoutes) {
  const page = { path: route, title: "FastTract Account", description: "Secure FastTract account area.", h1: "FastTract account", summary: "Sign in to continue to your secure FastTract workspace.", type: "webpage" };
  await writeRoute(route, renderPage(template, page, { noindex: true }));
}

for (const [from, to] of redirects) {
  const target = pages.find((page) => page.path === to);
  let html = renderPage(template, { ...target, path: to }, { noindex: true });
  html = html.replace("</head>", `  <meta http-equiv="refresh" content="0;url=${to}">\n</head>`);
  await writeRoute(from, html);
}

const notFound = renderPage(template, {
  path: "/404",
  title: "Page Not Found | FastTract",
  description: "The requested FastTract page could not be found.",
  h1: "Page not found",
  summary: "Return to FastTract to explore contractor estimating, CRM, job management, and AI phone answering.",
  type: "webpage",
}, { noindex: true });
await writeFile(path.join("dist", "404.html"), notFound);

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${pages.map((page) => `  <url><loc>${SITE}${page.path}</loc><lastmod>${UPDATED}</lastmod></url>`).join("\n")}\n</urlset>\n`;
await writeFile(path.join("dist", "sitemap.xml"), sitemap);

for (const page of pages) {
  const relative = page.path === "/" ? "index.html" : path.join(page.path.slice(1), "index.html");
  const html = await readFile(path.join("dist", relative), "utf8");
  const expectedCanonical = `rel="canonical" href="${SITE}${page.path}"`;
  if (!html.includes(`<title>${escapeHtml(page.title)}</title>`) ||
      !html.includes(expectedCanonical) ||
      !html.includes(`data-static-seo="true"`) ||
      !html.includes(`<h1`)) {
    throw new Error(`SEO generation failed for ${page.path}`);
  }
}

for (const route of noindexRoutes) {
  const html = await readFile(path.join("dist", route.slice(1), "index.html"), "utf8");
  if (!html.includes('name="robots" content="noindex, nofollow"')) {
    throw new Error(`Noindex generation failed for ${route}`);
  }
}

const sitemapLocations = [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map((match) => match[1]);
if (sitemapLocations.length !== pages.length || new Set(sitemapLocations).size !== pages.length) {
  throw new Error("Sitemap generation produced a missing or duplicate URL");
}

console.log(`Generated ${pages.length} crawlable pages, ${noindexRoutes.length} noindex shells, redirects, 404.html, and sitemap.xml.`);
console.log("Verified unique metadata, canonicals, static content, noindex routes, and sitemap output.");
