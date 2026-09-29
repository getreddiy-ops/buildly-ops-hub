export type BlogPost = {
  slug: string;
  title: string;
  description: string;
  date: string;
  body: string[];
};

export const posts: BlogPost[] = [
  {
    slug: "best-contractor-software-for-small-construction-companies",
    title: "What to Look for in Contractor Software",
    description: "A practical checklist for choosing software to organize customers, estimates, jobs, crews, and invoices.",
    date: "2026-09-29",
    body: [
      "Small construction companies often keep customer details in one place, estimates in another, and crew schedules in a spreadsheet. That makes it hard to see what needs attention next.",
      "When comparing software, check whether it connects customer records with estimates, jobs, scheduling, time tracking, and invoices. Also check how owners review changes, control team access, and export business records.",
      "FastTract Core brings contractor customer and job workflows into one workspace, including estimates, scheduling, crew time, and job costing. The launch plan works without an AI provider.",
      "FastTract's optional AI features and bring-your-own AI connections are planned for a later release and are not available now. Review the current plan and setup details before subscribing.",
    ],
  },
  {
    slug: "organize-contractor-customer-and-job-records",
    title: "How to Keep Contractor Customer and Job Records Organized",
    description: "Simple ways to connect customer details, estimate history, job schedules, and crew notes.",
    date: "2026-09-29",
    body: [
      "A customer record is most useful when it gives the office and field team the same view of the work: contact details, estimate status, job schedule, and relevant notes.",
      "Start by using a consistent customer and job name, recording the next follow-up step, and keeping job notes with the work they describe. Give each team member only the access they need.",
      "FastTract Core is designed to connect contractor customers, estimates, jobs, scheduling, crew time, and job costing. Teams can use those workflows without AI.",
    ],
  },
  {
    slug: "contractor-job-costing-basics",
    title: "Job Costing Basics for Small Contractors",
    description: "Track labor and project costs against the work so you can review how each job performed.",
    date: "2026-09-29",
    body: [
      "Job costing starts with assigning labor and expenses to the right job. If hours or purchases are recorded late, it becomes harder to understand the actual cost of the work.",
      "Set a routine for recording crew time, reviewing hours, and entering job expenses. Compare those costs with the estimate and invoice when the job closes.",
      "FastTract Core includes crew time tracking, approvals, and job costing workflows. AI features are optional and are not part of the current launch plan.",
    ],
  },
];

export const postBySlug = Object.fromEntries(posts.map((p) => [p.slug, p]));
