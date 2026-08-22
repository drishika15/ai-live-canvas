import { Link, useNavigate } from "@tanstack/react-router";
import { LogOut, Settings, Sparkles } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { endGuestSession } from "@/lib/decks";
import { useSession } from "@/hooks/use-session";
import { Button } from "@/components/ui/button";

export function AppHeader({ onOpenSettings }: { onOpenSettings?: () => void }) {
  const { user, guest } = useSession();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    endGuestSession();
    await supabase.auth.signOut();
    navigate({ to: "/", replace: true });
  }

  const label = guest && !user ? "Guest session" : (user?.email ?? "");

  return (
    <header className="sticky top-0 z-30 border-b border-border/60 bg-background/70 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4">
        <Link to="/app" className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="grid size-8 place-items-center rounded-xl bg-primary text-primary-foreground">
            <Sparkles className="size-4" />
          </span>
          <span className="brand-text text-lg">AI Live Canvas</span>
        </Link>
        <div className="ml-auto flex items-center gap-2">
          <span className="hidden text-xs text-muted-foreground sm:inline">{label}</span>
          {onOpenSettings ? (
            <Button variant="ghost" size="icon" onClick={onOpenSettings} aria-label="Settings">
              <Settings className="size-4" />
            </Button>
          ) : null}
          <Button variant="ghost" size="sm" onClick={signOut}>
            <LogOut className="mr-1.5 size-4" />
            Sign out
          </Button>
        </div>
      </div>
    </header>
  );
}
