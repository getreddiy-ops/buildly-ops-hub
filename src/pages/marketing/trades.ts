export type TradeConfig = {
  slug: string;
  trade: string;
  title: string;
  description: string;
  h1: string;
  intro: string;
  painPoints: string[];
  estimating: string[];
  phone: string[];
  jobs: string[];
  invoices: string[];
  faq: { q: string; a: string }[];
};

const baseFaq = (trade: string) => [
  {
    q: `Is ContractorOS built for ${trade.toLowerCase()} companies?`,
    a: `Yes. ContractorOS is built for ${trade.toLowerCase()} contractors and other trade-based construction businesses. The CRM, estimator, scheduler, and AI phone agent are tuned to how field-based crews actually work.`,
  },
  {
    q: `Can ${trade} contractors create estimates from photos?`,
    a: `Yes. Customers or your crew upload photos of the site. ContractorOS uses AI-assisted measurement and your unit pricing to produce a draft estimate you review and approve before sending.`,
  },
  {
    q: "Does the AI replace site visits?",
    a: "No. AI-assisted estimates are drafts to speed up quoting. We recommend verifying measurements on site for final quotes. Contractors stay in full control.",
  },
  {
    q: `Can ContractorOS answer the phone for my ${trade.toLowerCase()} business?`,
    a: `Yes. The AI Phone Agent answers missed calls 24/7, captures lead details, books appointments, and creates the customer record in your CRM automatically.`,
  },
  {
    q: "Can I send invoices and collect payment?",
    a: "Yes. Convert approved estimates into invoices, send them to the customer, and collect payments online. Everything ties back to the job and customer record.",
  },
];

export const trades: TradeConfig[] = [
  {
    slug: "concrete-contractor-software",
    trade: "Concrete",
    title: "Concrete Contractor Software | AI Estimating, CRM & Invoicing — ContractorOS",
    description:
      "ContractorOS is concrete contractor software with AI photo estimating, CRM, scheduling, crew time tracking, invoicing, and an AI phone agent that books pours and patios while you work.",
    h1: "Concrete Contractor Software With AI Estimating, CRM, and Invoicing",
    intro:
      "Built for driveway, patio, slab, foundation, and decorative concrete crews. Quote faster from photos, answer every call, schedule the pour, track the crew, and get paid — from one app.",
    painPoints: [
      "Driving across town for $500 driveway quotes",
      "Missing calls while you’re on the pour",
      "Hand-measuring square footage and guessing yardage",
      "Estimates and invoices scattered across texts and notebooks",
      "Crews not knowing where to be in the morning",
    ],
    estimating: [
      "Customer uploads phone photos of the driveway, patio, or slab",
      "AI drafts a rough square-footage estimate and suggested yardage",
      "Your unit pricing, rebar, finish, and seal options auto-apply",
      "You review, adjust, approve, and send a branded proposal",
    ],
    phone: [
      "AI answers every missed call about pours, patios, and repairs",
      "Captures address, scope, and preferred date",
      "Creates the lead in your CRM and texts you a summary",
      "Books estimate appointments 24/7",
    ],
    jobs: [
      "Schedule pours with crew assignments and equipment",
      "Crew clocks in on-site with GPS verification",
      "Photo-document the prep, pour, and finish",
      "Job costing rolls up labor, concrete, and materials",
    ],
    invoices: [
      "Convert approved estimates to invoices in one click",
      "Send invoice + payment link by email or text",
      "Collect deposits up front, balance on completion",
      "Track outstanding balances per customer",
    ],
    faq: baseFaq("Concrete"),
  },
  {
    slug: "framing-contractor-software",
    trade: "Framing",
    title: "Framing Contractor Software | Estimates, Crew & Invoicing — ContractorOS",
    description:
      "ContractorOS is framing contractor software. AI-assisted estimating from plans and photos, CRM, crew scheduling, GPS time tracking, and invoicing in one app.",
    h1: "Framing Contractor Software for Faster Bids and Tighter Crews",
    intro:
      "From single-family to multi-unit framing, ContractorOS handles bids, crew scheduling, and invoicing so framers can spend more time swinging hammers and less time on paperwork.",
    painPoints: [
      "Bids dragging on for days while GCs go elsewhere",
      "Hand-counting studs, plates, and headers from plans",
      "Crew hours scribbled on notebooks",
      "Change orders forgotten until invoicing",
    ],
    estimating: [
      "Upload plan photos or PDFs for an AI-assisted takeoff draft",
      "Quick lumber, fastener, and labor estimates",
      "Change orders captured and added to the live estimate",
      "Approve and send branded proposals in minutes",
    ],
    phone: [
      "AI answers GC and homeowner calls when you’re on a wall",
      "Captures scope, square footage, and timeline",
      "Books walkthroughs on your calendar",
    ],
    jobs: [
      "Schedule framing crews by job phase",
      "GPS clock-in for accurate payroll",
      "Site photos and notes attached to each job",
    ],
    invoices: [
      "Progress invoices by phase: deck, walls, roof",
      "Include approved change orders automatically",
      "Online payment links for faster collection",
    ],
    faq: baseFaq("Framing"),
  },
  {
    slug: "fencing-contractor-software",
    trade: "Fencing",
    title: "Fencing Contractor Software | AI Estimating & CRM — ContractorOS",
    description:
      "ContractorOS is fencing contractor software with AI photo estimating for linear footage, CRM, scheduling, AI phone answering, and invoicing.",
    h1: "Fencing Contractor Software That Quotes Fences From Photos",
    intro:
      "Wood, vinyl, chain link, aluminum — quote it all faster. ContractorOS gives fence companies AI-assisted linear-foot estimates, an AI receptionist, and a full CRM.",
    painPoints: [
      "Driving to every yard for a 100-ft fence quote",
      "Calculating posts, panels, and gates by hand",
      "Missing weekend leads",
      "No clear backlog or schedule",
    ],
    estimating: [
      "Homeowner uploads yard photos and a rough sketch",
      "AI drafts linear footage, post count, and gate count",
      "Auto-apply material, style, and height pricing",
      "Send a clean proposal the same day",
    ],
    phone: [
      "AI answers every fence inquiry, day or night",
      "Books estimate appointments on the spot",
      "Sends you a lead summary by text",
    ],
    jobs: [
      "Schedule installs by crew and material delivery",
      "Photo documentation per fence run",
      "GPS time tracking for crews",
    ],
    invoices: [
      "Deposit invoice on signing, balance at completion",
      "Online payment by card or ACH",
      "Track AR per customer",
    ],
    faq: baseFaq("Fencing"),
  },
  {
    slug: "landscaping-contractor-software",
    trade: "Landscaping",
    title: "Landscaping Contractor Software | AI Estimates & Scheduling — ContractorOS",
    description:
      "ContractorOS is landscaping contractor software with AI photo estimating, CRM, route scheduling, crew time tracking, invoicing, and an AI phone agent.",
    h1: "Landscaping Contractor Software for Designs, Installs, and Maintenance",
    intro:
      "From design-build to weekly maintenance routes, ContractorOS keeps your crews on schedule, your estimates accurate, and your phone answered.",
    painPoints: [
      "Maintenance routes built in spreadsheets",
      "Quotes lost in voicemail",
      "Unclear job profitability",
      "Materials and labor not reconciled",
    ],
    estimating: [
      "AI drafts sod, mulch, plant, and hardscape estimates from photos",
      "Plug in your unit pricing and markups",
      "Send branded proposals with options the customer can pick",
    ],
    phone: [
      "AI answers new-customer calls and maintenance requests",
      "Books estimates and routes calls to the right person",
      "Auto-creates leads in your CRM",
    ],
    jobs: [
      "Recurring maintenance schedules",
      "Crew assignment by route",
      "Photo before/after attached to each visit",
    ],
    invoices: [
      "One-time and recurring invoicing",
      "Auto-charge for monthly maintenance plans",
      "Track AR per customer",
    ],
    faq: baseFaq("Landscaping"),
  },
  {
    slug: "roofing-contractor-software",
    trade: "Roofing",
    title: "Roofing Contractor Software | AI Estimates, CRM & Invoicing — ContractorOS",
    description:
      "ContractorOS is roofing contractor software. AI-assisted estimates from drone or phone photos, CRM, crew scheduling, time tracking, and invoicing.",
    h1: "Roofing Contractor Software With AI Photo Estimating",
    intro:
      "Built for residential and light-commercial roofers. Quote from photos, schedule tear-offs and installs, track every crew hour, and bill the insurance company.",
    painPoints: [
      "Climbing roofs for every quote",
      "Insurance scope sheets that take all day",
      "Missing storm-call leads",
      "No clear job costing per job",
    ],
    estimating: [
      "AI drafts a rough square count from drone or phone photos",
      "Auto-apply shingle, underlayment, and tear-off pricing",
      "Adjust pitch, layers, and accessories",
      "Send a branded proposal same-day",
    ],
    phone: [
      "AI answers storm-call surges 24/7",
      "Captures address, damage type, and insurance status",
      "Books inspection appointments",
    ],
    jobs: [
      "Schedule tear-offs and installs by crew",
      "GPS clock-in for accurate payroll",
      "Photo documentation per job stage",
    ],
    invoices: [
      "Progress invoices and final billing",
      "Insurance-friendly line items",
      "Online payment for deductibles",
    ],
    faq: baseFaq("Roofing"),
  },
  {
    slug: "siding-contractor-software",
    trade: "Siding",
    title: "Siding Contractor Software | AI Estimates & CRM — ContractorOS",
    description:
      "ContractorOS is siding contractor software with AI photo estimating for wall area, CRM, scheduling, and invoicing.",
    h1: "Siding Contractor Software for Faster Wall-Area Estimates",
    intro:
      "Vinyl, fiber cement, wood, metal — ContractorOS helps siding contractors quote faster from photos and run the install end to end.",
    painPoints: [
      "Measuring elevations the old way",
      "Quoting taking days instead of hours",
      "Missing calls during install days",
    ],
    estimating: [
      "AI drafts wall square footage from elevation photos",
      "Trim, soffit, fascia, and wrap line items included",
      "Send branded proposals with material options",
    ],
    phone: [
      "AI answers and qualifies every siding inquiry",
      "Books estimate appointments automatically",
    ],
    jobs: [
      "Schedule installs and material drops",
      "Crew GPS clock-in",
      "Photo documentation per elevation",
    ],
    invoices: [
      "Deposit + final invoicing",
      "Online payment links",
      "AR by customer",
    ],
    faq: baseFaq("Siding"),
  },
  {
    slug: "deck-builder-software",
    trade: "Deck Builder",
    title: "Deck Builder Software | AI Estimates, CRM & Invoicing — ContractorOS",
    description:
      "ContractorOS is deck builder software. AI photo estimating for deck square footage, CRM, scheduling, crew time tracking, and invoicing.",
    h1: "Deck Builder Software With AI Estimating From Photos",
    intro:
      "Composite, pressure-treated, cedar, or hardwood — ContractorOS helps deck builders quote faster, schedule cleaner, and collect sooner.",
    painPoints: [
      "Hand-drawn sketches that turn into wrong quotes",
      "Missing weekend leads",
      "No clear material list per deck",
    ],
    estimating: [
      "AI drafts deck square footage and rough framing from photos",
      "Choose decking material and railing style for instant pricing",
      "Add stairs, lighting, and built-ins",
    ],
    phone: [
      "AI answers new deck inquiries 24/7",
      "Books in-home estimates",
    ],
    jobs: [
      "Schedule builds with material delivery",
      "Crew GPS clock-in and job-stage photos",
    ],
    invoices: [
      "Deposit + progress + final invoicing",
      "Online payment by card or ACH",
    ],
    faq: baseFaq("Deck Builder"),
  },
  {
    slug: "general-contractor-software",
    trade: "General Contractor",
    title: "General Contractor Software | CRM, Estimates & Job Management — ContractorOS",
    description:
      "ContractorOS is general contractor software with AI-assisted estimating, CRM, subs and crew scheduling, time tracking, invoicing, and an AI phone agent.",
    h1: "General Contractor Software for Remodelers and Builders",
    intro:
      "Manage subs, crews, customers, estimates, and invoices in one place. Built for remodelers, custom home builders, and small GCs who want to scale without more admin.",
    painPoints: [
      "Spreadsheets glued together with email",
      "Estimates that take a week",
      "Sub schedules in your head",
      "No real visibility into job profit",
    ],
    estimating: [
      "AI-assisted estimating from plans, photos, and scopes",
      "Reusable assemblies and unit pricing",
      "Change-order management baked in",
    ],
    phone: [
      "AI answers homeowner and sub calls",
      "Books appointments and walkthroughs",
    ],
    jobs: [
      "Master schedule across multiple jobs",
      "Crew + sub assignments",
      "Photo-documented progress",
    ],
    invoices: [
      "Progress invoicing tied to schedule of values",
      "Online deposits and final payments",
      "Job costing dashboard",
    ],
    faq: baseFaq("General Contractor"),
  },
];

export const tradeBySlug = Object.fromEntries(trades.map((t) => [t.slug, t]));
