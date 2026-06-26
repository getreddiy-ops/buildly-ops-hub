import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { RequireAuth, RequireOrg, RequireAgent, RequirePlatformAdmin } from "@/components/auth/Guards";

import Landing from "./pages/Landing";
import Pricing from "./pages/Pricing";
import Contact from "./pages/Contact";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Onboarding from "./pages/Onboarding";
import NotFound from "./pages/NotFound";

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
import FieldClock from "./pages/field/FieldClock";
import FieldJobs from "./pages/field/FieldJobs";
import FieldMap from "./pages/field/FieldMap";
import {
  TimeTracking, Approvals, Costing,
  Assistant, Messages, SettingsPage,
  FieldProfile,
  AgentOverview, AgentClients, AgentLeads, AgentPayouts,
  AdminOverview, AdminOrgs, AdminUsers, AdminAudit,
} from "./pages/stubs";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            {/* Public */}
            <Route path="/" element={<Landing />} />
            <Route path="/pricing" element={<Pricing />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/onboarding" element={<RequireAuth><Onboarding /></RequireAuth>} />

            {/* Main app (office) */}
            <Route path="/app" element={<RequireAuth><RequireOrg><AppShell /></RequireOrg></RequireAuth>}>
              <Route index element={<Dashboard />} />
              <Route path="leads" element={<Leads />} />
              <Route path="customers" element={<Customers />} />
              <Route path="estimates" element={<Estimates />} />
              <Route path="jobs" element={<Jobs />} />
              <Route path="crew" element={<Crew />} />
              <Route path="time" element={<TimeTracking />} />
              <Route path="approvals" element={<Approvals />} />
              <Route path="costing" element={<Costing />} />
              <Route path="assistant" element={<Assistant />} />
              <Route path="messages" element={<Messages />} />
              <Route path="settings" element={<SettingsPage />} />
            </Route>

            {/* Field app (mobile) */}
            <Route path="/field" element={<RequireAuth><RequireOrg><FieldAppShell /></RequireOrg></RequireAuth>}>
              <Route index element={<FieldClock />} />
              <Route path="jobs" element={<FieldJobs />} />
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
