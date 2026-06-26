import { StubPage } from "@/components/StubPage";
import { MessageSquare, Settings, User } from "lucide-react";

export const Messages = () => <StubPage title="Messages" description="Customer conversations in one inbox." icon={MessageSquare} emptyTitle="No conversations yet" emptyDescription="Messages with customers will be threaded here." />;
export const SettingsPage = () => <StubPage title="Settings" description="Company, billing, integrations." icon={Settings} emptyTitle="Settings — coming soon" emptyDescription="Profile, company, billing, and team invitations will live here." />;
export const FieldProfile = () => <StubPage title="Profile" description="Your account and preferences." icon={User} emptyTitle="Profile" emptyDescription="Edit your name, photo, and notification preferences." />;
