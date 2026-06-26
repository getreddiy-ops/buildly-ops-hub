import { Link } from "react-router-dom";
import { StubPage } from "@/components/StubPage";
import { MessageSquare, Settings, User, Code2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Messages = () => <StubPage title="Messages" description="Customer conversations in one inbox." icon={MessageSquare} emptyTitle="No conversations yet" emptyDescription="Messages with customers will be threaded here." />;
export const SettingsPage = () => (
  <StubPage
    title="Settings"
    description="Company, billing, integrations, and developer tools."
    icon={Settings}
    emptyTitle="Settings"
    emptyDescription="Profile, company, billing, and team invitations will live here."
  >
    <div className="mt-6 flex flex-wrap gap-3">
      <Button variant="outline" asChild>
        <Link to="/app/developer">
          <Code2 className="mr-2 h-4 w-4" />
          Developer workflow
        </Link>
      </Button>
    </div>
  </StubPage>
);
export const FieldProfile = () => <StubPage title="Profile" description="Your account and preferences." icon={User} emptyTitle="Profile" emptyDescription="Edit your name, photo, and notification preferences." />;
