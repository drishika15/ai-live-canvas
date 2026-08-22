import { useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Loader2 } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { SettingsDialog } from "@/components/settings-dialog";
import { useSession } from "@/hooks/use-session";
import { getPrefs } from "@/lib/prefs";
import type { FontName, TemplateName } from "@/lib/deck-types";

export function useDeckDefaults() {
  const { signedIn } = useSession();
  const prefsQuery = useQuery({ queryKey: ["prefs"], queryFn: getPrefs, enabled: signedIn });
  const [template, setTemplate] = useState<TemplateName>("Modern");
  const [font, setFont] = useState<FontName>("Space Grotesk");
  const [count, setCount] = useState(7);

  useEffect(() => {
    const p = prefsQuery.data;
    if (p) {
      setTemplate(p.defaultTemplate);
      setFont(p.defaultFont);
      setCount(p.defaultSlideCount);
    }
  }, [prefsQuery.data]);

  return { template, setTemplate, font, setFont, count, setCount };
}

export function AppShell({
  title,
  description,
  back = true,
  children,
}: {
  title?: string;
  description?: string;
  back?: boolean;
  children: ReactNode;
}) {
  const { signedIn, loading, guest } = useSession();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const prefsQuery = useQuery({ queryKey: ["prefs"], queryFn: getPrefs, enabled: signedIn });

  useEffect(() => {
    if (!loading && !signedIn) navigate({ to: "/auth", replace: true });
  }, [loading, signedIn, navigate]);

  if (loading || !signedIn) {
    return (
      <div className="grid min-h-screen place-items-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <AppHeader onOpenSettings={() => setSettingsOpen(true)} />
      <main className="mx-auto max-w-6xl px-4 py-10">
        {guest ? (
          <div className="glass mb-6 rounded-xl px-4 py-3 text-sm text-muted-foreground">
            You're in a guest session — decks stay in this browser tab.{" "}
            <Link to="/auth" className="text-primary underline">
              Create an account
            </Link>{" "}
            to keep them.
          </div>
        ) : null}

        {back ? (
          <Link
            to="/app"
            className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            Back to hub
          </Link>
        ) : null}

        {title ? (
          <header className="mb-6">
            <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
            {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
          </header>
        ) : null}

        {children}
      </main>

      <SettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        prefs={prefsQuery.data}
        onSaved={() => queryClient.invalidateQueries({ queryKey: ["prefs"] })}
      />
    </div>
  );
}
