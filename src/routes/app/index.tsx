import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { FileUp, LayoutTemplate, Plus, Presentation, Wand2 } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { useSession } from "@/hooks/use-session";
import { listDecks } from "@/lib/decks";

export const Route = createFileRoute("/app/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Workspace hub — AI Live Canvas" },
      {
        name: "description",
        content: "Pick a path: generate a deck with AI, start blank, import a file, browse templates or open a saved presentation.",
      },
      { property: "og:title", content: "Workspace hub — AI Live Canvas" },
      { property: "og:description", content: "Everything you can do with AI Live Canvas, one card at a time." },
    ],
  }),
  component: Hub,
});

const CARDS = [
  {
    to: "/app/create" as const,
    icon: Wand2,
    title: "Create presentation",
    text: "Describe or dictate a topic and let AI write the deck and source imagery.",
    accent: "from-[#2E6BFF] to-[#63E6FF]",
  },
  {
    to: "/app/blank" as const,
    icon: Plus,
    title: "Blank deck",
    text: "Start from an empty slide and build the story yourself.",
    accent: "from-[#22345E] to-[#5A6480]",
  },
  {
    to: "/app/import" as const,
    icon: FileUp,
    title: "Import PDF, PPTX or text",
    text: "Bring an existing file in and keep editing it here.",
    accent: "from-[#F5A524] to-[#FF5F6D]",
  },
  {
    to: "/app/decks" as const,
    icon: Presentation,
    title: "Your presentations",
    text: "Open, edit, present or delete everything you've saved.",
    accent: "from-[#0F766E] to-[#34D399]",
  },
  {
    to: "/app/templates" as const,
    icon: LayoutTemplate,
    title: "Templates",
    text: "Preview every look and start a deck in that style.",
    accent: "from-[#FF7A59] to-[#B23FD6]",
  },
];

function Hub() {
  const { signedIn } = useSession();
  const decksQuery = useQuery({ queryKey: ["decks"], queryFn: listDecks, enabled: signedIn });
  const deckCount = (decksQuery.data ?? []).length;

  return (
    <AppShell
      back={false}
      title="What are we building?"
      description="Each task has its own space — pick a card to go there."
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {CARDS.map((card) => (
          <Link
            key={card.to}
            to={card.to}
            className="glass group flex flex-col rounded-2xl p-5 transition hover:-translate-y-0.5 hover:shadow-lg"
          >
            <span
              className={`grid size-11 place-items-center rounded-xl bg-gradient-to-br ${card.accent} text-white`}
            >
              <card.icon className="size-5" />
            </span>
            <h2 className="mt-4 font-semibold tracking-tight">{card.title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{card.text}</p>
            {card.to === "/app/decks" ? (
              <span className="mt-3 text-xs text-muted-foreground">
                {deckCount === 0 ? "No decks yet" : `${deckCount} saved`}
              </span>
            ) : null}
            <span className="mt-auto pt-4 text-sm font-medium text-primary">Open →</span>
          </Link>
        ))}
      </div>
    </AppShell>
  );
}
