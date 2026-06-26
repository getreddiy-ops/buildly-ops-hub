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
      "Contractors using ContractorOS typically cut estimating time by half on small-to-medium jobs and close more deals because they quote same-day.",
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
      "ContractorOS adds AI on top — a phone agent that answers your calls and a photo estimator that drafts quotes for you.",
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
      "With ContractorOS, the homeowner sends photos of the driveway or patio. AI drafts a rough square-footage estimate and suggested yardage. Your unit pricing — rebar, finish, seal — auto-applies.",
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
      "ContractorOS includes an AI Phone Agent trained on your services, your pricing range, and your tone. Leads land in your CRM ready to follow up.",
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
      "Feed those into ContractorOS. The AI estimator drafts rough measurements, applies your unit pricing, and gives you a starting estimate.",
      "Then you verify on site if needed. The estimate is already 90% done before you arrive.",
    ],
  },
];

export const postBySlug = Object.fromEntries(posts.map((p) => [p.slug, p]));
