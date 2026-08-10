import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { RequireAuth, RequireOrg, RequireAgent, RequirePlatformAdmin, RequireOfficeRole, RequireSubscription } from "@/components/auth/Guards";
import { GoogleAdsTracker } from "@/components/GoogleAdsTracker";

import { BrandingProvider } from "./components/BrandingProvider";
import { PaywallGate } from "./components/PaywallGate";
import { ImpersonationBanner } from "./components/ImpersonationBanner";

const Landing = lazy(() => import("./pages/Landing"));
const Pricing = lazy(() => import("./pages/Pricing"));
const Contact = lazy(() => import("./pages/Contact"));
const Demo = lazy(() => import("./pages/Demo"));
const Login = lazy(() => import("./pages/Login"));
const Signup = lazy(() => import("./pages/Signup"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const Onboarding = lazy(() => import("./pages/Onboarding"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Privacy = lazy(() => import("./pages/legal/Privacy"));
const Terms = lazy(() => import("./pages/legal/Terms"));
const Refunds = lazy(() => import("./pages/legal/Refunds"));
const Features = lazy(() => import("./pages/marketing/Features"));
const AIPhotoEstimator = lazy(() => import("./pages/marketing/AIPhotoEstimator"));
const AIPhoneAgent = lazy(() => import("./pages/marketing/AIPhoneAgent"));
const ContractorCRMPage = lazy(() => import("./pages/marketing/ContractorCRM"));
const EstimateSoftware = lazy(() => import("./pages/marketing/EstimateSoftware"));
const InvoiceSoftware = lazy(() => import("./pages/marketing/InvoiceSoftware"));
const Resellers = lazy(() => import("./pages/marketing/Resellers"));
const TradePage = lazy(() => import("./pages/marketing/TradePage"));
const BlogIndex = lazy(() => import("./pages/marketing/blog/BlogIndex"));
const BlogPost = lazy(() => import("./pages/marketing/blog/BlogPost"));
const AppShell = lazy(() => import("./layouts/AppShell"));
const FieldAppShell = lazy(() => import("./layouts/FieldAppShell"));
const AgentShell = lazy(() => import("./layouts/AgentShell"));
const AdminShell = lazy(() => import("./layouts/AdminShell"));
const Dashboard = lazy(() => import("./pages/app/Dashboard"));
const Leads = lazy(() => import("./pages/app/Leads"));
const Customers = lazy(() => import("./pages/app/Customers"));
const Estimates = lazy(() => import("./pages/app/Estimates"));
const EstimateDetail = lazy(() => import("./pages/app/EstimateDetail"));
const Jobs = lazy(() => import("./pages/app/Jobs"));
const Crew = lazy(() => import("./pages/app/Crew"));
const TimeTracking = lazy(() => import("./pages/app/TimeTracking"));
const Approvals = lazy(() => import("./pages/app/Approvals"));
const Costing = lazy(() => import("./pages/app/Costing"));
const FieldClock = lazy(() => import("./pages/field/FieldClock"));
const FieldJobs = lazy(() => import("./pages/field/FieldJobs"));
const FieldMap = lazy(() => import("./pages/field/FieldMap"));
const FieldCrew = lazy(() => import("./pages/field/FieldCrew"));
const FieldAssistant = lazy(() => import("./pages/field/FieldAssistant"));
const Assistant = lazy(() => import("./pages/app/Assistant"));
const PhoneAssistant = lazy(() => import("./pages/app/PhoneAssistant"));
const Billing = lazy(() => import("./pages/app/Billing"));
const BusinessProfile = lazy(() => import("./pages/app/BusinessProfile"));
const Branding = lazy(() => import("./pages/app/Branding"));
const Developer = lazy(() => import("./pages/app/Developer"));
const Invoices = lazy(() => import("./pages/app/Invoices"));
const Contracts = lazy(() => import("./pages/app/Contracts"));
const Vendors = lazy(() => import("./pages/app/Vendors"));
const Materials = lazy(() => import("./pages/app/Materials"));
const Calendar = lazy(() => import("./pages/app/Calendar"));
const AgentOverview = lazy(() => import("./pages/agent/AgentOverview"));
const AgentClients = lazy(() => import("./pages/agent/AgentClients"));
const AgentLeads = lazy(() => import("./pages/agent/AgentLeads"));
const AgentPayouts = lazy(() => import("./pages/agent/AgentPayouts"));
const AdminOverview = lazy(() => import("./pages/admin/AdminOverview"));
const AdminOrgs = lazy(() => import("./pages/admin/AdminOrgs"));
const AdminOrgDetail = lazy(() => import("./pages/admin/AdminOrgDetail"));
const AdminUsers = lazy(() => import("./pages/admin/AdminUsers"));
const AdminAudit = lazy(() => import("./pages/admin/AdminAudit"));
const AdminAiUsage = lazy(() => import("./pages/admin/AdminAiUsage"));
const AdminWorkspace = lazy(() => import("./pages/admin/AdminWorkspace"));
const SuperShell = lazy(() => import("./pages/super/SuperShell"));
const SuperOverview = lazy(() => import("./pages/super/SuperOverview"));
const SuperControls = lazy(() => import("./pages/super/SuperControls"));
const SuperOrgs = lazy(() => import("./pages/super/SuperOrgs"));
const SuperData = lazy(() => import("./pages/super/SuperData"));
const SuperLive = lazy(() => import("./pages/super/SuperLive"));
const Messages = lazy(() => import("./pages/stubs").then((module) => ({ default: module.Messages })));
const FieldProfile = lazy(() => import("./pages/stubs").then((module) => ({ default: module.FieldProfile })));
const Preferences = lazy(() => import("./pages/app/Preferences"));
const DnsSetup = lazy(() => import("./pages/app/DnsSetup"));
const Unsubscribe = lazy(() => import("./pages/Unsubscribe"));
const OAuthConsent = lazy(() => import("./pages/OAuthConsent"));

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <GoogleAdsTracker />
          <ImpersonationBanner />
          <Suspense fallback={<div className="grid min-h-screen place-items-center bg-background text-sm text-muted-foreground">Loading FastTract…</div>}>
            <Routes>
            {/* Public */}
            <Route path="/" element={<Landing />} />
            <Route path="/pricing" element={<Pricing />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/demo" element={<Demo />} />
            <Route path="/unsubscribe" element={<Unsubscribe />} />
            <Route path="/.lovable/oauth/consent" element={<OAuthConsent />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/onboarding" element={<RequireAuth><Onboarding /></RequireAuth>} />
            <Route path="/legal/privacy" element={<Privacy />} />
            <Route path="/legal/terms" element={<Terms />} />
            <Route path="/legal/refunds" element={<Refunds />} />
            <Route path="/privacy" element={<Navigate to="/legal/privacy" replace />} />
            <Route path="/terms" element={<Navigate to="/legal/terms" replace />} />
            <Route path="/refunds" element={<Navigate to="/legal/refunds" replace />} />
            <Route path="/features/contractor-crm" element={<Navigate to="/contractor-crm" replace />} />
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
            <Route path="/app" element={<RequireAuth><RequireOrg><RequireOfficeRole><RequireSubscription><BrandingProvider><AppShell /></BrandingProvider></RequireSubscription></RequireOfficeRole></RequireOrg></RequireAuth>}>
              <Route index element={<Dashboard />} />
              <Route path="leads" element={<Leads />} />
              <Route path="customers" element={<Customers />} />
              <Route path="estimates" element={<Estimates />} />
              <Route path="estimates/:id" element={<EstimateDetail />} />
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
              <Route
                path="developer"
                element={<RequirePlatformAdmin redirectTo="/app/settings"><Developer /></RequirePlatformAdmin>}
              />

              <Route path="settings" element={<Preferences />} />
              <Route path="settings/dns-setup" element={<DnsSetup />} />

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
              <Route path="workspace" element={<AdminWorkspace />} />
              <Route path="audit" element={<AdminAudit />} />
              <Route path="ai-usage" element={<AdminAiUsage />} />
            </Route>

            {/* Super admin ops console (Midnight Indigo) */}
            <Route path="/super" element={<RequireAuth><RequirePlatformAdmin><SuperShell /></RequirePlatformAdmin></RequireAuth>}>
              <Route index element={<SuperOverview />} />
              <Route path="controls" element={<SuperControls />} />
              <Route path="orgs" element={<SuperOrgs />} />
              <Route path="data" element={<SuperData />} />
              <Route path="live" element={<SuperLive />} />
            </Route>

            <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
