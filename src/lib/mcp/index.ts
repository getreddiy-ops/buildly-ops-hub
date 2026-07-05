import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listCustomers from "./tools/list-customers";
import createCustomer from "./tools/create-customer";
import listJobs from "./tools/list-jobs";
import listLeads from "./tools/list-leads";
import listEstimates from "./tools/list-estimates";
import createEstimate from "./tools/create-estimate";
import updateEstimate from "./tools/update-estimate";
import createInvoice from "./tools/create-invoice";
import updateInvoice from "./tools/update-invoice";
import createJob from "./tools/create-job";
import updateJob from "./tools/update-job";

const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "fasttract-mcp",
  title: "FastTract MCP",
  version: "0.2.0",
  instructions:
    "Tools for FastTract, a contractor CRM. Use these to read, create, and update the signed-in user's customers, leads, estimates, invoices, and jobs. All calls run under the user's Row-Level Security context.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [
    listCustomers,
    createCustomer,
    listJobs,
    listLeads,
    listEstimates,
    createEstimate,
    updateEstimate,
    createInvoice,
    updateInvoice,
    createJob,
    updateJob,
  ],
});
