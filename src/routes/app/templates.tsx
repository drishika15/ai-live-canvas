import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { AppShell, useDeckDefaults } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { createDeck } from "@/lib/decks";
import { TEMPLATE_NAMES, emptySlide, templateGradient, type TemplateName } from "@/lib/deck-types";

export const Route = createFileRoute("/app/templates")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Templates — AI Live Canvas" },
      {
        name: "description",
        content: "Preview every AI Live Canvas template and start a new presentation in that style.",
      },
      { property: "og:title", content: "Templates — AI Live Canvas" },
      { property: "og:description", content: "Six deck looks, one click to start." },
    ],
  }),
  component: TemplatesPage,
});

function TemplatesPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { font } = useDeckDefaults();
  const [busy, setBusy] = useState<TemplateName | null>(null);

  async function start(template: TemplateName) {
    setBusy(template);
    try {
      const title = `${template} presentation`;
      const deck = await createDeck({ title, template, font, slides: [emptySlide(title)] });
      await queryClient.invalidateQueries({ queryKey: ["decks"] });
      navigate({ to: "/app/deck/$id", params: { id: deck.id } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not create a deck.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <AppShell title="Templates" description="Pick a look — we'll start a deck in that style.">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {TEMPLATE_NAMES.map((t) => (
          <div key={t} className="glass overflow-hidden rounded-2xl">
            <div
              className="flex h-32 items-end p-4 text-lg font-semibold text-white"
              style={{ background: templateGradient(t) }}
            >
              {t}
            </div>
            <div className="p-4">
              <Button size="sm" onClick={() => void start(t)} disabled={busy !== null}>
                {busy === t ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                Use this template
              </Button>
            </div>
          </div>
        ))}
      </div>
    </AppShell>
  );
}
