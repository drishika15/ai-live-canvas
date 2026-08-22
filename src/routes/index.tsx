import { createFileRoute, Link } from "@tanstack/react-router";
import { Mail, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "AI Live Canvas — Speak it. See it. Present it, live." },
      {
        name: "description",
        content:
          "Sign in to AI Live Canvas: generate presentations from a topic, edit slides visually, and present with a voice co-pilot that pulls up images, videos and answers.",
      },
      { property: "og:title", content: "AI Live Canvas — Speak it. See it. Present it, live." },
      {
        property: "og:description",
        content: "AI presentations with a live voice co-pilot. Continue with email or jump in as a guest.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <main className="hero-glow grid min-h-screen place-items-center px-6 py-16">
      <div className="glass w-full max-w-md rounded-2xl px-8 py-10 text-center">
        <h1 className="brand-text text-4xl font-bold tracking-tight">AI Live Canvas</h1>
        <p className="mt-3 text-sm text-muted-foreground">Speak it. See it. Present it — live.</p>

        <div className="mt-8 space-y-3">
          <Button asChild size="lg" className="w-full rounded-full">
            <Link to="/auth">
              <Mail className="mr-2 size-4" />
              Continue with Email
            </Link>
          </Button>

          <div className="flex items-center gap-3 py-1 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            or
            <span className="h-px flex-1 bg-border" />
          </div>

          <Button asChild size="lg" variant="secondary" className="w-full rounded-full">
            <Link to="/auth" search={{ guest: true }}>
              <UserRound className="mr-2 size-4" />
              Continue as Guest
            </Link>
          </Button>
        </div>

        <p className="mt-8 text-xs leading-relaxed text-muted-foreground">
          Guest decks stay in this browser tab. Create an account to keep your presentations, imagery and
          preferences saved across devices.
        </p>
      </div>
    </main>
  );
}
