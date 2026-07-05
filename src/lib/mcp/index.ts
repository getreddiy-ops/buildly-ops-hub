import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listCustomers from "./tools/list-customers";
import createCustomer from "./tools/create-customer";
import listJobs from "./tools/list-jobs";
import listLeads from "./tools/list-leads";
import listEstimates from "./tools/list-estimates";

const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "fasttract-mcp",
  title: "FastTract MCP",
  version: "0.1.0",
  instructions:
    "Tools for FastTract, a contractor CRM. Use these to read and create the signed-in user's customers, leads, estimates, and jobs. All calls run under the user's Row-Level Security context.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listCustomers, createCustomer, listJobs, listLeads, listEstimates],
});
