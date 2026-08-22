import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Plus } from "lucide-react";
import { AppShell, useDeckDefaults } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createDeck } from "@/lib/decks";
import {
  FONT_NAMES,
  TEMPLATE_NAMES,
  emptySlide,
  templateGradient,
  type FontName,
  type TemplateName,
} from "@/lib/deck-types";

export const Route = createFileRoute("/app/blank")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "New blank deck — AI Live Canvas" },
      {
        name: "description",
        content: "Start an empty presentation, pick a template and font, and build the slides yourself.",
      },
      { property: "og:title", content: "New blank deck — AI Live Canvas" },
      { property: "og:description", content: "Start from an empty slide in AI Live Canvas." },
    ],
  }),
  component: BlankPage,
});

function BlankPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { template, setTemplate, font, setFont } = useDeckDefaults();
  const [title, setTitle] = useState("Untitled presentation");
  const [busy, setBusy] = useState(false);

  async function create() {
    setBusy(true);
    try {
      const name = title.trim() || "Untitled presentation";
      const deck = await createDeck({ title: name, template, font, slides: [emptySlide(name)] });
      await queryClient.invalidateQueries({ queryKey: ["decks"] });
      navigate({ to: "/app/deck/$id", params: { id: deck.id } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not create a deck.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell title="Blank deck" description="Name it, choose a look, and start editing right away.">
      <div className="glass max-w-2xl space-y-4 rounded-2xl p-6">
        <div
          className="flex h-28 items-end rounded-xl p-4 text-sm font-semibold text-white"
          style={{ background: templateGradient(template) }}
        >
          {title.trim() || "Untitled presentation"}
        </div>
        <div className="space-y-1.5">
          <Label>Presentation title</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Template</Label>
            <Select value={template} onValueChange={(v) => setTemplate(v as TemplateName)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TEMPLATE_NAMES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Font</Label>
            <Select value={font} onValueChange={(v) => setFont(v as FontName)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FONT_NAMES.map((f) => (
                  <SelectItem key={f} value={f}>
                    {f}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <Button onClick={create} disabled={busy}>
          {busy ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Plus className="mr-2 size-4" />}
          Create blank deck
        </Button>
      </div>
    </AppShell>
  );
}
