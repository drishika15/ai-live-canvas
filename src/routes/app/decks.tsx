import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Pencil, Presentation, Trash2, Wand2 } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { useSession } from "@/hooks/use-session";
import { deleteDeck, listDecks } from "@/lib/decks";
import { templateGradient } from "@/lib/deck-types";

export const Route = createFileRoute("/app/decks")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Your presentations — AI Live Canvas" },
      {
        name: "description",
        content: "Open, edit, present or delete every presentation you've saved in AI Live Canvas.",
      },
      { property: "og:title", content: "Your presentations — AI Live Canvas" },
      { property: "og:description", content: "All of your saved AI Live Canvas decks in one place." },
    ],
  }),
  component: DecksPage,
});

function DecksPage() {
  const { signedIn } = useSession();
  const queryClient = useQueryClient();
  const decksQuery = useQuery({ queryKey: ["decks"], queryFn: listDecks, enabled: signedIn });

  async function handleDelete(id: string) {
    try {
      await deleteDeck(id);
      await queryClient.invalidateQueries({ queryKey: ["decks"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete.");
    }
  }

  return (
    <AppShell title="Your presentations" description="Everything you've generated, imported or built by hand.">
      {decksQuery.isLoading ? (
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      ) : (decksQuery.data ?? []).length === 0 ? (
        <div className="glass max-w-xl rounded-2xl p-6">
          <p className="text-sm text-muted-foreground">Nothing here yet.</p>
          <Button asChild className="mt-4">
            <Link to="/app/create">
              <Wand2 className="mr-2 size-4" />
              Create your first deck
            </Link>
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(decksQuery.data ?? []).map((deck) => (
            <div key={deck.id} className="glass overflow-hidden rounded-2xl">
              <div
                className="flex h-28 items-end p-4 text-sm font-semibold text-white"
                style={{ background: templateGradient(deck.template) }}
              >
                {deck.slides.length} slides
              </div>
              <div className="p-4">
                <h2 className="truncate font-medium">{deck.title}</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Updated {new Date(deck.updatedAt).toLocaleString()}
                </p>
                <div className="mt-4 flex gap-2">
                  <Button asChild size="sm" variant="outline">
                    <Link to="/app/deck/$id" params={{ id: deck.id }}>
                      <Pencil className="mr-1.5 size-3.5" />
                      Edit
                    </Link>
                  </Button>
                  <Button asChild size="sm">
                    <Link to="/present/$id" params={{ id: deck.id }}>
                      <Presentation className="mr-1.5 size-3.5" />
                      Present
                    </Link>
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="ml-auto"
                    aria-label="Delete deck"
                    onClick={() => void handleDelete(deck.id)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </AppShell>
  );
}
