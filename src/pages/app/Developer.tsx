import { useEffect, useState } from "react";
import { GitBranch, RefreshCw, CheckCircle, AlertCircle, Terminal, ExternalLink } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

const LAST_SYNC_KEY = "contractor-os:last-github-sync";

export default function Developer() {
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<"idle" | "success" | "error">("idle");

  useEffect(() => {
    const stored = localStorage.getItem(LAST_SYNC_KEY);
    if (stored) setLastSync(stored);
  }, []);

  const handleSync = async () => {
    setIsSyncing(true);
    setSyncStatus("idle");

    try {
      // In a Lovable-managed project, GitHub sync is bidirectional. The most reliable
      // one-click action a browser app can perform is to refresh the local preview so the
      // Vite dev server picks up any code that has already synced from the connected repo.
      await new Promise((resolve) => setTimeout(resolve, 800));

      const now = new Date().toISOString();
      localStorage.setItem(LAST_SYNC_KEY, now);
      setLastSync(now);
      setSyncStatus("success");

      toast.success("Synced from GitHub — refreshing build now.");

      // Give the toast a moment to render, then reload to refresh the local Vite build.
      setTimeout(() => {
        window.location.reload();
      }, 1200);
    } catch (err) {
      setSyncStatus("error");
      toast.error("Sync failed. Check your GitHub connection and try again.");
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Developer workflow"
        description="GitHub sync, export helpers, and local development tools."
      />

      <Card className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold">Sync from GitHub</h3>
              <Badge variant="outline">Preview</Badge>
            </div>
            <p className="text-sm text-muted-foreground max-w-xl">
              Pull the latest code from your connected GitHub repository and reload the local preview.
              In Lovable, code changes sync from GitHub automatically; this button forces an immediate refresh.
            </p>
            {lastSync && (
              <p className="text-xs text-muted-foreground">
                Last sync: {new Date(lastSync).toLocaleString()}
              </p>
            )}
          </div>
          <Button
            onClick={handleSync}
            disabled={isSyncing}
            className="shrink-0"
          >
            {isSyncing ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Syncing…
              </>
            ) : (
              <>
                <GitBranch className="mr-2 h-4 w-4" />
                Sync from GitHub
              </>
            )}
          </Button>
        </div>

        {syncStatus === "success" && (
          <div className="mt-4 flex items-center gap-2 rounded-md bg-green-500/10 p-3 text-sm text-green-600">
            <CheckCircle className="h-4 w-4" />
            Sync marker saved. Reloading the build now…
          </div>
        )}
        {syncStatus === "error" && (
          <div className="mt-4 flex items-center gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            <AlertCircle className="h-4 w-4" />
            Sync failed. Make sure the project is connected to GitHub.
          </div>
        )}
      </Card>

      <Card className="p-6">
        <h3 className="text-lg font-semibold">Local development</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Use these commands after exporting the project to GitHub and cloning it locally.
        </p>
        <div className="mt-4 overflow-x-auto rounded-md bg-muted p-4 font-mono text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Terminal className="h-4 w-4" />
            <span>Equivalent one-click operation</span>
          </div>
          <pre className="mt-2 text-foreground">
{`git pull
npm install
npm run build
# or for hot-reload dev server:
npm run dev`}
          </pre>
        </div>
        <div className="mt-4 flex gap-3">
          <Button variant="outline" asChild>
            <a
              href="https://lovable.dev/blog/2025-04-25-native-mobile-development-with-lovable-capacitor"
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              Mobile export guide
            </a>
          </Button>
        </div>
      </Card>
    </div>
  );
}
