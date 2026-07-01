import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { RequireAuth, RequireOrg, RequireAgent, RequirePlatformAdmin, RequireOfficeRole } from "@/components/auth/Guards";
import { GoogleAdsTracker } from "@/components/GoogleAdsTracker";

import Landing from "./pages/Landing";
import Pricing from "./pages/Pricing";
import Contact from "./pages/Contact";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Onboarding from "./pages/Onboarding";
import NotFound from "./pages/NotFound";
import Privacy from "./pages/legal/Privacy";
import Terms from "./pages/legal/Terms";
import Refunds from "./pages/legal/Refunds";
import ContractorCRMOld from "./pages/features/ContractorCRM";
import Features from "./pages/marketing/Features";
import AIPhotoEstimator from "./pages/marketing/AIPhotoEstimator";
import AIPhoneAgent from "./pages/marketing/AIPhoneAgent";
import ContractorCRMPage from "./pages/marketing/ContractorCRM";
import EstimateSoftware from "./pages/marketing/EstimateSoftware";
import InvoiceSoftware from "./pages/marketing/InvoiceSoftware";
import Resellers from "./pages/marketing/Resellers";
import TradePage from "./pages/marketing/TradePage";
import BlogIndex from "./pages/marketing/blog/BlogIndex";
import BlogPost from "./pages/marketing/blog/BlogPost";

import AppShell from "./layouts/AppShell";
import FieldAppShell from "./layouts/FieldAppShell";
import AgentShell from "./layouts/AgentShell";
import AdminShell from "./layouts/AdminShell";

import Dashboard from "./pages/app/Dashboard";
import Leads from "./pages/app/Leads";
import Customers from "./pages/app/Customers";
import Estimates from "./pages/app/Estimates";
import Jobs from "./pages/app/Jobs";
import Crew from "./pages/app/Crew";
import TimeTracking from "./pages/app/TimeTracking";
import Approvals from "./pages/app/Approvals";
import Costing from "./pages/app/Costing";
import FieldClock from "./pages/field/FieldClock";
import FieldJobs from "./pages/field/FieldJobs";
import FieldMap from "./pages/field/FieldMap";
import FieldCrew from "./pages/field/FieldCrew";
import FieldAssistant from "./pages/field/FieldAssistant";
import Assistant from "./pages/app/Assistant";
import PhoneAssistant from "./pages/app/PhoneAssistant";
import Billing from "./pages/app/Billing";
import BusinessProfile from "./pages/app/BusinessProfile";
import Branding from "./pages/app/Branding";
import Developer from "./pages/app/Developer";
import Invoices from "./pages/app/Invoices";
import Contracts from "./pages/app/Contracts";
import Vendors from "./pages/app/Vendors";
import Materials from "./pages/app/Materials";
import Calendar from "./pages/app/Calendar";
import { BrandingProvider } from "./components/BrandingProvider";


import { PaywallGate } from "./components/PaywallGate";
import AgentOverview from "./pages/agent/AgentOverview";
import AgentClients from "./pages/agent/AgentClients";
import AgentLeads from "./pages/agent/AgentLeads";
import AgentPayouts from "./pages/agent/AgentPayouts";
import AdminOverview from "./pages/admin/AdminOverview";
import AdminOrgs from "./pages/admin/AdminOrgs";
import AdminOrgDetail from "./pages/admin/AdminOrgDetail";
import AdminUsers from "./pages/admin/AdminUsers";
import AdminAudit from "./pages/admin/AdminAudit";
import { Messages, SettingsPage, FieldProfile } from "./pages/stubs";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <GoogleAdsTracker />
          <Routes>
            {/* Public */}
            <Route path="/" element={<Landing />} />
            <Route path="/pricing" element={<Pricing />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/onboarding" element={<RequireAuth><Onboarding /></RequireAuth>} />
            <Route path="/legal/privacy" element={<Privacy />} />
            <Route path="/legal/terms" element={<Terms />} />
            <Route path="/legal/refunds" element={<Refunds />} />
            <Route path="/features/contractor-crm" element={<ContractorCRMOld />} />
            <Route path="/features" element={<Features />} />
            <Route path="/ai-photo-estimator" element={<AIPhotoEstimator />} />
            <Route path="/ai-phone-agent" element={<AIPhoneAgent />} />
            <Route path="/contractor-crm" element={<ContractorCRMPage />} />
            <Route path="/estimate-software" element={<EstimateSoftware />} />
            <Route path="/invoice-software" element={<InvoiceSoftware />} />
            <Route path="/resellers" element={<Resellers />} />
            <Route path="/blog" element={<BlogIndex />} />
            <Route path="/blog/:slug" element={<BlogPost />} />
            <Route path="/concrete-contractor-software" element={<TradePage />} />
            <Route path="/framing-contractor-software" element={<TradePage />} />
            <Route path="/fencing-contractor-software" element={<TradePage />} />
            <Route path="/landscaping-contractor-software" element={<TradePage />} />
            <Route path="/roofing-contractor-software" element={<TradePage />} />
            <Route path="/siding-contractor-software" element={<TradePage />} />
            <Route path="/deck-builder-software" element={<TradePage />} />
            <Route path="/general-contractor-software" element={<TradePage />} />

            {/* Main app (office) */}
            <Route path="/app" element={<RequireAuth><RequireOrg><RequireOfficeRole><BrandingProvider><AppShell /></BrandingProvider></RequireOfficeRole></RequireOrg></RequireAuth>}>
              <Route index element={<Dashboard />} />
              <Route path="leads" element={<Leads />} />
              <Route path="customers" element={<Customers />} />
              <Route path="estimates" element={<Estimates />} />
              <Route path="invoices" element={<Invoices />} />
              <Route path="contracts" element={<Contracts />} />

              <Route path="jobs" element={<Jobs />} />
              <Route path="crew" element={<Crew />} />
              <Route path="vendors" element={<Vendors />} />
              <Route path="materials" element={<Materials />} />
              <Route path="time" element={<TimeTracking />} />
              <Route path="calendar" element={<Calendar />} />
              <Route path="approvals" element={<Approvals />} />
              <Route path="costing" element={<Costing />} />
              <Route path="assistant" element={<PaywallGate feature="AI Assistant"><Assistant /></PaywallGate>} />
              <Route path="phone-assistant" element={<PaywallGate feature="Phone Assistant" requires="premium"><PhoneAssistant /></PaywallGate>} />
              <Route path="messages" element={<Messages />} />
              <Route path="billing" element={<Billing />} />
              <Route path="business-profile" element={<BusinessProfile />} />
              <Route path="branding" element={<Branding />} />
              <Route path="developer" element={<Developer />} />

              <Route path="settings" element={<SettingsPage />} />

            </Route>

            {/* Field app (mobile) */}
            <Route path="/field" element={<RequireAuth><RequireOrg><FieldAppShell /></RequireOrg></RequireAuth>}>
              <Route index element={<FieldClock />} />
              <Route path="jobs" element={<FieldJobs />} />
              <Route path="crew" element={<FieldCrew />} />
              <Route path="calendar" element={<Calendar />} />
              <Route path="assistant" element={<PaywallGate feature="AI Assistant"><FieldAssistant /></PaywallGate>} />
              <Route path="map" element={<FieldMap />} />
              <Route path="profile" element={<FieldProfile />} />
            </Route>

            {/* Agent portal */}
            <Route path="/agent" element={<RequireAuth><RequireAgent><AgentShell /></RequireAgent></RequireAuth>}>
              <Route index element={<AgentOverview />} />
              <Route path="clients" element={<AgentClients />} />
              <Route path="leads" element={<AgentLeads />} />
              <Route path="payouts" element={<AgentPayouts />} />
            </Route>

            {/* Platform admin */}
            <Route path="/admin" element={<RequireAuth><RequirePlatformAdmin><AdminShell /></RequirePlatformAdmin></RequireAuth>}>
              <Route index element={<AdminOverview />} />
              <Route path="organizations" element={<AdminOrgs />} />
              <Route path="organizations/:id" element={<AdminOrgDetail />} />
              <Route path="users" element={<AdminUsers />} />
              <Route path="audit" element={<AdminAudit />} />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
