import { StubPage } from "@/components/StubPage";
import { Users, FileText, Briefcase, HardHat, Clock, CheckSquare, DollarSign, Bot, MessageSquare, Settings, MapPin, User, Building2, ShieldAlert } from "lucide-react";

export const Leads = () => <StubPage title="Leads" description="Track prospects from first contact to signed estimate." icon={Users} emptyTitle="No leads yet" emptyDescription="Add your first lead or import from a CSV." ctaLabel="New lead" />;
export const Customers = () => <StubPage title="Customers" description="Your active and past customers." icon={Users} emptyTitle="No customers yet" emptyDescription="Customers are created automatically when a lead is won, or add one manually." ctaLabel="New customer" />;
export const Estimates = () => <StubPage title="Estimates" description="Drafts, sent, approved, rejected." icon={FileText} emptyTitle="No estimates yet" emptyDescription="Build an estimate from scratch or from a lead." ctaLabel="New estimate" />;
export const Jobs = () => <StubPage title="Jobs" description="Scheduled, in progress, completed." icon={Briefcase} emptyTitle="No jobs scheduled" emptyDescription="Convert an approved estimate to a job, or schedule one directly." ctaLabel="New job" />;
export const Crew = () => <StubPage title="Crew" description="Your team and their roles." icon={HardHat} emptyTitle="No crew members yet" emptyDescription="Invite workers and admins to your organization." ctaLabel="Invite member" />;
export const TimeTracking = () => <StubPage title="Time Tracking" description="GPS-verified clock in / clock out." icon={Clock} emptyTitle="No time entries this week" emptyDescription="Crew time entries from the field app will show up here." />;
export const Approvals = () => <StubPage title="Approvals" description="Review and approve crew hours before payroll." icon={CheckSquare} emptyTitle="Nothing waiting for approval" emptyDescription="Pending time entries from your crew will appear here." />;
export const Costing = () => <StubPage title="Job Costing" description="Labor + materials + margin per job." icon={DollarSign} emptyTitle="No job cost data yet" emptyDescription="Job costing fills in as approved hours and expenses roll in." />;
export const Assistant = () => <StubPage title="AI Assistant" description="Draft follow-ups, estimates, and schedules. You approve before anything sends." icon={Bot} emptyTitle="Your assistant is ready" emptyDescription="Coming online — ask it to draft an estimate, summarize a lead, or plan tomorrow's schedule." />;
export const Messages = () => <StubPage title="Messages" description="Customer conversations in one inbox." icon={MessageSquare} emptyTitle="No conversations yet" emptyDescription="Messages with customers will be threaded here." />;
export const SettingsPage = () => <StubPage title="Settings" description="Company, billing, integrations." icon={Settings} emptyTitle="Settings — coming soon" emptyDescription="Profile, company, billing, and team invitations will live here." />;

// Field app
export const FieldClock = () => <StubPage title="Clock In" description="Tap to clock in. Your location is recorded." icon={Clock} emptyTitle="You're clocked out" emptyDescription="Tap the button to start tracking your hours on a job." ctaLabel="Clock in" />;
export const FieldJobs = () => <StubPage title="My Jobs" description="Jobs you're assigned to today." icon={Briefcase} emptyTitle="No jobs assigned" emptyDescription="Your boss will assign jobs that show up here." />;
export const FieldMap = () => <StubPage title="Job Map" description="See your jobs on a map." icon={MapPin} emptyTitle="No job locations" emptyDescription="Job sites will show up on this map." />;
export const FieldProfile = () => <StubPage title="Profile" description="Your account and preferences." icon={User} emptyTitle="Profile" emptyDescription="Edit your name, photo, and notification preferences." />;

// Agent
export const AgentOverview = () => <StubPage title="Agent Overview" description="Your reseller dashboard." icon={Building2} emptyTitle="No client organizations yet" emptyDescription="When you onboard contractors, they show up here." />;
export const AgentClients = () => <StubPage title="Client Organizations" description="Contractors you manage." icon={Building2} emptyTitle="No clients yet" emptyDescription="Invite a contractor to get started." ctaLabel="Invite contractor" />;
export const AgentLeads = () => <StubPage title="Lead Sharing" description="Pass leads to your contractors." icon={Users} emptyTitle="No shared leads" emptyDescription="Leads you forward to your contractors will appear here." />;
export const AgentPayouts = () => <StubPage title="Payouts" description="Your revenue share." icon={DollarSign} emptyTitle="No payouts yet" emptyDescription="Stripe-powered payouts coming in a later phase." />;

// Platform Admin
export const AdminOverview = () => <StubPage title="Platform Overview" description="All organizations and users." icon={Building2} emptyTitle="Platform stats — coming soon" emptyDescription="Org count, MRR, active users." />;
export const AdminOrgs = () => <StubPage title="Organizations" description="Every contractor on the platform." icon={Building2} emptyTitle="No organizations yet" />;
export const AdminUsers = () => <StubPage title="Users" description="Every user on the platform." icon={Users} emptyTitle="No users yet" />;
export const AdminAudit = () => <StubPage title="Audit Log" description="Security-sensitive events." icon={ShieldAlert} emptyTitle="No events yet" />;
