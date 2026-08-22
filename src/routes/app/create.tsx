import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Mic, MicOff, Wand2 } from "lucide-react";
import { AppShell, useDeckDefaults } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSpeech } from "@/hooks/use-speech";
import { createDeck } from "@/lib/decks";
import {
  FONT_NAMES,
  TEMPLATE_NAMES,
  placeholderImage,
  uid,
  type FontName,
  type Slide,
  type TemplateName,
} from "@/lib/deck-types";
import { generateOutline } from "@/lib/ai.functions";
import { bestImageLive } from "@/lib/image.functions";

export const Route = createFileRoute("/app/create")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Create a presentation — AI Live Canvas" },
      {
        name: "description",
        content: "Describe or dictate your topic and AI Live Canvas writes the deck and sources the imagery.",
      },
      { property: "og:title", content: "Create a presentation — AI Live Canvas" },
      { property: "og:description", content: "AI deck generation with voice dictation." },
    ],
  }),
  component: CreatePage,
});

function CreatePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { template, setTemplate, font, setFont, count, setCount } = useDeckDefaults();
  const [topic, setTopic] = useState("");
  const [status, setStatus] = useState<string | null>(null);

  const mic = useSpeech((text) => {
    setTopic((prev) => (prev.trim() ? `${prev.trim()} ${text}` : text));
  });

  async function handleGenerate() {
    if (topic.trim().length < 3) {
      toast.error("Describe your topic in a few more words.");
      return;
    }
    setStatus("Outlining your deck…");
    try {
      const outline = await generateOutline({ data: { topic: topic.trim(), slideCount: count } });
      const slides: Slide[] = [];
      const deckTitle = outline.title || topic.trim();

      setStatus("Finding a cover image…");
      // Track every picked image so no two slides ever show the same picture.
      const used: string[] = [];
      const cover = await bestImageLive({ data: { query: deckTitle, exclude: used } });
      if (cover) used.push(cover.fullUrl, cover.url);
      slides.push({
        id: uid(),
        title: deckTitle,
        bullets: outline.slides.slice(0, 5).map((s) => s.title).filter(Boolean),
        notes: `Open with the framing of ${deckTitle}, then walk the agenda.`,
        image: cover?.url ?? placeholderImage(deckTitle),
        imageCredit: cover?.title ?? null,
      });
      for (let i = 0; i < outline.slides.length; i++) {
        const s = outline.slides[i]!;
        setStatus(`Finding imagery (${i + 1}/${outline.slides.length})…`);
        const match = await bestImageLive({
          data: { query: s.imageQuery || s.title, exclude: used },
        });
        if (match) used.push(match.fullUrl, match.url);
        slides.push({
          id: uid(),
          title: s.title,
          bullets: Array.isArray(s.bullets) ? s.bullets : [],
          notes: s.notes ?? "",
          image: match?.url ?? placeholderImage(s.imageQuery || s.title),
          imageCredit: match?.title ?? null,
        });
      }

      setStatus("Saving…");
      const deck = await createDeck({ title: outline.title || topic.trim(), template, font, slides });
      await queryClient.invalidateQueries({ queryKey: ["decks"] });
      navigate({ to: "/app/deck/$id", params: { id: deck.id } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Generation failed.");
    } finally {
      setStatus(null);
    }
  }

  return (
    <AppShell
      title="Create a presentation"
      description="Describe your topic and AI Live Canvas writes the deck and sources the imagery."
    >
      <div className="glass rounded-2xl p-6">
        <div className="space-y-4">
          <div className="relative">
            <Textarea
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              rows={3}
              className="pr-14"
              placeholder="e.g. How tidal energy works, for a high-school science class — or tap the mic and just say it"
            />
            <Button
              type="button"
              size="icon"
              variant={mic.listening ? "default" : "outline"}
              aria-label={mic.listening ? "Turn microphone off" : "Turn microphone on"}
              aria-pressed={mic.listening}
              disabled={!mic.supported}
              onClick={mic.toggle}
              className={`absolute right-2 top-2 rounded-full ${mic.listening ? "mic-live" : ""}`}
            >
              {mic.listening ? <Mic className="size-4" /> : <MicOff className="size-4" />}
            </Button>
          </div>
          <p
            className={`text-xs ${mic.error ? "text-destructive" : "text-muted-foreground"}`}
            aria-live="polite"
          >
            {!mic.supported
              ? "Voice input isn't available in this browser — type your topic instead."
              : mic.error
                ? mic.error
                : mic.listening
                  ? mic.transcript
                    ? `Listening: ${mic.transcript}`
                    : "Listening… say what your deck should be about."
                  : "Mic is off. Tap the mic to dictate your topic."}
          </p>


          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label>Slides: {count}</Label>
              <Slider min={3} max={12} step={1} value={[count]} onValueChange={(v) => setCount(v[0] ?? 7)} />
            </div>
            <div className="space-y-2">
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
            <div className="space-y-2">
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

          <Button onClick={handleGenerate} disabled={status !== null}>
            {status ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Wand2 className="mr-2 size-4" />}
            {status ?? "Generate deck"}
          </Button>
        </div>
      </div>
    </AppShell>
  );
}
