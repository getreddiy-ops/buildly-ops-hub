export type BlogPost = {
  slug: string;
  title: string;
  description: string;
  date: string;
  body: string[];
};

export const posts: BlogPost[] = [
  {
    slug: "how-ai-estimating-helps-contractors-save-time",
    title: "How AI Estimating Helps Contractors Save Time",
    description:
      "AI estimating gives contractors a draft estimate in minutes instead of hours. Here’s how it works and where it actually saves time.",
    date: "2025-01-15",
    body: [
      "Most contractors lose 5–10 hours a week to estimating. Driving to the site, measuring, typing it up, sending the proposal, chasing the customer.",
      "AI estimating compresses that work. The customer uploads photos. AI drafts rough dimensions and applies your saved unit pricing. You review, adjust, and send.",
      "It’s not magic — it’s a head start. You still own the final quote. But starting from a 90%-done draft beats starting from a blank page every time.",
      "Contractors using FastTract typically cut estimating time by half on small-to-medium jobs and close more deals because they quote same-day.",
    ],
  },
  {
    slug: "best-contractor-software-for-small-construction-companies",
    title: "Best Contractor Software for Small Construction Companies",
    description:
      "Small construction companies need software that runs the whole business — not five separate tools. Here’s what to look for.",
    date: "2025-01-20",
    body: [
      "Most small contractors are stitching together a CRM, a scheduler, an estimator, an invoicing tool, and a phone service. Five subscriptions, five logins, five places things slip through the cracks.",
      "The best contractor software for small construction companies does the full job-to-cash workflow in one place: lead capture, estimating, scheduling, time tracking, invoicing, and payments.",
      "FastTract adds AI on top — a phone agent that answers your calls and a photo estimator that drafts quotes for you.",
      "If you’re running a crew of 1–20, this is the stack you want.",
    ],
  },
  {
    slug: "how-concrete-contractors-can-use-ai-to-quote-faster",
    title: "How Concrete Contractors Can Use AI to Quote Faster",
    description:
      "Driveways, patios, and slabs all share a common bottleneck: estimating. Here’s how concrete contractors use AI to quote same-day.",
    date: "2025-01-25",
    body: [
      "Concrete jobs are estimated on square footage, yardage, finish, and prep. Most of that can be drafted from photos.",
      "With FastTract, the homeowner sends photos of the driveway or patio. AI drafts a rough square-footage estimate and suggested yardage. Your unit pricing — rebar, finish, seal — auto-applies.",
      "You verify on site if needed, but you’ve already sent a quote the same day. That alone wins more bids.",
    ],
  },
  {
    slug: "why-contractors-miss-leads-and-how-ai-phone-answering-fixes-it",
    title: "Why Contractors Miss Leads and How AI Phone Answering Fixes It",
    description:
      "Most contractor leads die in voicemail. AI phone answering captures them 24/7 and books appointments while you work.",
    date: "2025-02-01",
    body: [
      "Most homeowners calling a contractor don’t leave voicemail. They call the next name on the list.",
      "If you’re on a roof, in a trench, or pouring concrete, you’re missing leads. Every missed call is real money.",
      "AI phone answering picks up every call, captures the scope, and books an estimate — even at 9pm on a Sunday.",
      "FastTract includes an AI Phone Agent trained on your services, your pricing range, and your tone. Leads land in your CRM ready to follow up.",
    ],
  },
  {
    slug: "how-to-turn-job-photos-into-faster-contractor-estimates",
    title: "How to Turn Job Photos Into Faster Contractor Estimates",
    description:
      "Job photos hold most of the information needed to draft an estimate. Here’s how to use them — and where AI helps.",
    date: "2025-02-08",
    body: [
      "A few good photos cover scope: dimensions, condition, access, and obstructions.",
      "Ask the customer for: a wide shot, a measured shot (a tape or a ruler in the frame), and any close-ups of damage or specifics.",
      "Feed those into FastTract. The AI estimator drafts rough measurements, applies your unit pricing, and gives you a starting estimate.",
      "Then you verify on site if needed. The estimate is already 90% done before you arrive.",
    ],
  },
  {
    slug: "best-contractor-management-software-comparison",
    title: "Best Contractor Management Software Comparison for 2026",
    description:
      "FastTract vs Contractor Foreman, ADP, and other contractor management software. Compare features, pricing, and AI capabilities for small-to-mid contractors.",
    date: "2026-01-10",
    body: [
      "Picking contractor management software in 2026 isn’t just about a CRM and a scheduler anymore. The question is which platform actually runs the job-to-cash workflow — lead capture, estimating, scheduling, time tracking, invoicing, and payments — without you stitching five tools together.",
      "Below is an honest comparison of the most common contractor management software contractors evaluate against FastTract.",
      "FastTract — built as an AI-first operating system for contractors. Includes a contractor CRM, AI photo estimating, AI phone answering, job scheduling, GPS crew time tracking, invoicing with online payments, and an AI command chat that runs the business by voice or text. Starts at $69/mo, AI Phone Agent add-on at $169/mo, full phone answering tier at $269/mo. Best for contractors who want one app and want AI doing the busywork.",
      "Contractor Foreman — strong on traditional construction management features (job costing, daily logs, RFIs, submittals). Solid value for small-to-mid GCs that need document-heavy project management. Limited AI: no AI phone answering, no photo-to-estimate. Better fit if your bottleneck is project documentation, not lead response or quoting speed.",
      "ADP — primarily a payroll and HR platform. Contractors use it for payroll and compliance, not for CRM, estimating, or scheduling. Pair it with something else for the front of the business. ADP and FastTract aren’t direct competitors — most contractors run both.",
      "Buildertrend / JobTread — full-featured construction management aimed at remodelers and custom-home builders. Higher price point, steeper learning curve, less focus on trade-based field crews. AI features are limited compared to FastTract.",
      "Jobber / Housecall Pro — strong field-service CRMs for home-service trades. Good scheduling and invoicing. No native AI phone agent and no photo-based AI estimating today. FastTract overlaps heavily and adds the AI layer on top.",
      "How to choose. If you’re a trade contractor (concrete, framing, fencing, roofing, siding, decks, landscaping) and your biggest pain is missed calls and slow estimates, FastTract wins on AI. If you’re a GC running large commercial projects with heavy documentation requirements, Contractor Foreman or Buildertrend may fit better. If you only need payroll, stick with ADP and pair it with a front-office tool.",
      "AI-assisted estimates are drafts — contractors verify before final quote. FastTract keeps you in control of every estimate before it’s sent.",
      "Try FastTract free and see the AI workflow end to end: customer call answered by AI, lead created, photos uploaded, estimate drafted, job scheduled, crew clocked in, invoice paid.",
    ],
  },
];

export const postBySlug = Object.fromEntries(posts.map((p) => [p.slug, p]));
