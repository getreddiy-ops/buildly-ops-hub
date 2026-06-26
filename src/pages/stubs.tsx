import { StubPage } from "@/components/StubPage";
import { Users, DollarSign, MessageSquare, Settings, User, Building2, ShieldAlert } from "lucide-react";

export const Messages = () => <StubPage title="Messages" description="Customer conversations in one inbox." icon={MessageSquare} emptyTitle="No conversations yet" emptyDescription="Messages with customers will be threaded here." />;
export const SettingsPage = () => <StubPage title="Settings" description="Company, billing, integrations." icon={Settings} emptyTitle="Settings — coming soon" emptyDescription="Profile, company, billing, and team invitations will live here." />;

// Field app
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
