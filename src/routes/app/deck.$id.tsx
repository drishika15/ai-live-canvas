import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  Copy,
  Download,
  FileDown,
  GripVertical,
  Image as ImageIcon,
  Loader2,
  Mic,
  MicOff,
  Plus,
  Presentation,
  Save,
  Trash2,
} from "lucide-react";

import { AppHeader } from "@/components/app-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSession } from "@/hooks/use-session";
import { useSpeech } from "@/hooks/use-speech";
import { getDeck, saveDeck } from "@/lib/decks";
import { normalizeImageQuery } from "@/lib/images";
import { searchImagesLive, type ImageSearchHit } from "@/lib/image.functions";

import { exportPdf, exportPptx } from "@/lib/export-deck";
import {
  FONT_NAMES,
  TEMPLATE_NAMES,
  emptySlide,
  templateGradient,
  uid,
  type Deck,
  type FontName,
  type Slide,
  type TemplateName,
} from "@/lib/deck-types";

export const Route = createFileRoute("/app/deck/$id")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Slide editor — AI Live Canvas" },
      {
        name: "description",
        content: "Edit slide text, reorder slides by drag and drop, swap imagery, and export to PPTX or PDF.",
      },
      { property: "og:title", content: "Slide editor — AI Live Canvas" },
      { property: "og:description", content: "Edit, reorder and export your AI-generated presentation." },
    ],
  }),
  component: Editor,
});

function Editor() {
  const { id } = Route.useParams();
  const { signedIn, loading } = useSession();
  const navigate = useNavigate();

  const [deck, setDeck] = useState<Deck | null>(null);
  const [active, setActive] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [imageFor, setImageFor] = useState<string | null>(null);
  const dragIndex = useRef<number | null>(null);

  useEffect(() => {
    if (!loading && !signedIn) navigate({ to: "/auth", replace: true });
  }, [loading, signedIn, navigate]);

  const deckQuery = useQuery({
    queryKey: ["deck", id],
    queryFn: () => getDeck(id),
    enabled: signedIn,
  });

  useEffect(() => {
    if (deckQuery.data) setDeck(deckQuery.data);
  }, [deckQuery.data]);

  const slide = deck?.slides[active] ?? null;

  const gradient = useMemo(() => templateGradient(deck?.template ?? "Modern"), [deck?.template]);

  function update(mutator: (d: Deck) => Deck) {
    setDeck((prev) => (prev ? mutator(prev) : prev));
    setDirty(true);
  }

  function updateSlide(slideId: string, patch: Partial<Slide>) {
    update((d) => ({
      ...d,
      slides: d.slides.map((s) => (s.id === slideId ? { ...s, ...patch } : s)),
    }));
  }

  async function save() {
    if (!deck) return;
    setSaving(true);
    try {
      await saveDeck(deck);
      setDirty(false);
      toast.success("Saved.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  function addSlide() {
    if (!deck) return;
    const s = emptySlide("New slide");
    update((d) => ({ ...d, slides: [...d.slides, s] }));
    setActive(deck.slides.length);
  }

  function duplicateSlide(index: number) {
    if (!deck) return;
    const source = deck.slides[index];
    if (!source) return;
    const copy: Slide = { ...source, id: uid(), bullets: [...source.bullets] };
    update((d) => ({
      ...d,
      slides: [...d.slides.slice(0, index + 1), copy, ...d.slides.slice(index + 1)],
    }));
    setActive(index + 1);
  }

  function removeSlide(index: number) {
    if (!deck || deck.slides.length <= 1) {
      toast.error("A deck needs at least one slide.");
      return;
    }
    update((d) => ({ ...d, slides: d.slides.filter((_, i) => i !== index) }));
    setActive((a) => Math.max(0, Math.min(a, deck.slides.length - 2)));
  }

  function handleDrop(target: number) {
    const from = dragIndex.current;
    dragIndex.current = null;
    if (from === null || from === target || !deck) return;
    const slides = [...deck.slides];
    const [moved] = slides.splice(from, 1);
    if (!moved) return;
    slides.splice(target, 0, moved);
    update((d) => ({ ...d, slides }));
    setActive(target);
  }

  if (loading || deckQuery.isLoading) {
    return (
      <div className="grid min-h-screen place-items-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!deck) {
    return (
      <div className="grid min-h-screen place-items-center px-4 text-center">
        <div>
          <h1 className="text-lg font-semibold">Presentation not found</h1>
          <Button asChild className="mt-4">
            <Link to="/app">Back to dashboard</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <AppHeader />

      <div className="mx-auto max-w-7xl px-4 py-6">
        <div className="mb-5 flex flex-wrap items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link to="/app">
              <ArrowLeft className="mr-1.5 size-4" />
              Dashboard
            </Link>
          </Button>
          <Input
            value={deck.title}
            onChange={(e) => update((d) => ({ ...d, title: e.target.value }))}
            className="max-w-xs font-medium"
          />
          <Select value={deck.template} onValueChange={(v) => update((d) => ({ ...d, template: v as TemplateName }))}>
            <SelectTrigger className="w-32">
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
          <Select value={deck.font} onValueChange={(v) => update((d) => ({ ...d, font: v as FontName }))}>
            <SelectTrigger className="w-40">
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

          <div className="ml-auto flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => void exportPptx(deck)}>
              <Download className="mr-1.5 size-4" />
              PPTX
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                try {
                  exportPdf(deck);
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "Export failed.");
                }
              }}
            >
              <FileDown className="mr-1.5 size-4" />
              PDF
            </Button>
            <Button size="sm" variant={dirty ? "default" : "secondary"} onClick={save} disabled={saving}>
              {saving ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : <Save className="mr-1.5 size-4" />}
              {dirty ? "Save changes" : "Saved"}
            </Button>
            <Button asChild size="sm">
              <Link to="/present/$id" params={{ id: deck.id }}>
                <Presentation className="mr-1.5 size-4" />
                Present
              </Link>
            </Button>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[240px_1fr_320px]">
          {/* Slide list */}
          <aside className="space-y-2">
            {deck.slides.map((s, i) => (
              <div
                key={s.id}
                draggable
                onDragStart={() => (dragIndex.current = i)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => handleDrop(i)}
                onClick={() => setActive(i)}
                className={`glass flex cursor-pointer items-center gap-2 rounded-xl p-3 text-sm transition ${
                  i === active ? "ring-2 ring-primary" : "hover:bg-accent/40"
                }`}
              >
                <GripVertical className="size-4 shrink-0 text-muted-foreground" />
                <span className="w-5 shrink-0 text-xs text-muted-foreground">{i + 1}</span>
                <span className="truncate">{s.title || "Untitled"}</span>
              </div>
            ))}
            <Button variant="outline" className="w-full" onClick={addSlide}>
              <Plus className="mr-1.5 size-4" />
              Add slide
            </Button>
          </aside>

          {/* Preview */}
          <div>
            <div
              className="slide-stage aspect-video w-full overflow-hidden rounded-2xl p-6 text-white shadow-xl sm:p-8"
              style={{ background: gradient, fontFamily: deck.font }}
            >
              {slide ? (
                <div className="flex h-full min-h-0 gap-6">
                  <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
                    <h2 className="text-2xl font-semibold sm:text-3xl">{slide.title}</h2>
                    <ul className="mt-5 min-h-0 flex-1 space-y-2 overflow-y-auto pr-1 text-sm sm:text-base">
                      {slide.bullets.map((b, i) => (
                        <li key={i} className="flex gap-2">
                          <span className="opacity-70">•</span>
                          <span>{b}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  {slide.image ? (
                    <div className="flex h-full w-2/5 shrink-0 items-center justify-center">
                      <img
                      referrerPolicy="no-referrer"
                        src={slide.image}
                        alt={slide.imageCredit ?? slide.title}
                        className="max-h-full max-w-full rounded-xl object-contain"
                      />
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
            <div className="mt-3 flex gap-2">
              <Button variant="outline" size="sm" onClick={() => duplicateSlide(active)}>
                <Copy className="mr-1.5 size-4" />
                Duplicate
              </Button>
              <Button variant="outline" size="sm" onClick={() => removeSlide(active)}>
                <Trash2 className="mr-1.5 size-4" />
                Delete slide
              </Button>
              <Button variant="outline" size="sm" onClick={() => setImageFor(slide?.id ?? null)}>
                <ImageIcon className="mr-1.5 size-4" />
                Find image
              </Button>
            </div>
          </div>

          {/* Inspector */}
          <aside className="glass space-y-4 rounded-2xl p-4">
            {slide ? (
              <>
                <div className="space-y-1.5">
                  <Label>Slide title</Label>
                  <Input value={slide.title} onChange={(e) => updateSlide(slide.id, { title: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Bullets (one per line)</Label>
                  <Textarea
                    rows={7}
                    value={slide.bullets.join("\n")}
                    onChange={(e) =>
                      updateSlide(slide.id, {
                        bullets: e.target.value.split("\n").map((l) => l.trimStart()),
                      })
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Speaker notes</Label>
                  <Textarea
                    rows={4}
                    value={slide.notes}
                    onChange={(e) => updateSlide(slide.id, { notes: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Image URL</Label>
                  <Input
                    value={slide.image ?? ""}
                    placeholder="https://…"
                    onChange={(e) => updateSlide(slide.id, { image: e.target.value || null })}
                  />
                </div>
              </>
            ) : null}
          </aside>
        </div>
      </div>

      <ImageDialog
        open={imageFor !== null}
        onOpenChange={(v) => setImageFor(v ? imageFor : null)}
        defaultQuery={slide?.title ?? ""}
        onPick={(result) => {
          if (imageFor) updateSlide(imageFor, { image: result.url, imageCredit: result.title });
          setImageFor(null);
        }}
      />
    </div>
  );
}

function ImageDialog({
  open,
  onOpenChange,
  defaultQuery,
  onPick,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  defaultQuery: string;
  onPick: (result: ImageSearchHit) => void;
}) {
  const [query, setQuery] = useState(defaultQuery);
  const [results, setResults] = useState<ImageSearchHit[]>([]);
  const [busy, setBusy] = useState(false);
  const mic = useSpeech((text) => {
    const spoken = normalizeImageQuery(text);
    setQuery(spoken);
    void run(spoken);
  });

  useEffect(() => {
    if (open) {
      setQuery(defaultQuery);
      setResults([]);
    } else {
      mic.stop();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, defaultQuery]);

  async function run(term = query) {
    setBusy(true);
    setResults(await searchImagesLive({ data: { query: term, limit: 12 } }));
    setBusy(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Find an image</DialogTitle>
          <DialogDescription>Live web image search — the closest match to what you ask for.</DialogDescription>
        </DialogHeader>
        <div className="flex gap-2">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void run();
            }}
            placeholder="tidal turbine"
          />
          <Button
            type="button"
            size="icon"
            variant={mic.listening ? "default" : "outline"}
            aria-label={mic.listening ? "Turn microphone off" : "Turn microphone on"}
            aria-pressed={mic.listening}
            disabled={!mic.supported}
            onClick={mic.toggle}
            className={`shrink-0 rounded-full ${mic.listening ? "mic-live" : ""}`}
          >
            {mic.listening ? <Mic className="size-4" /> : <MicOff className="size-4" />}
          </Button>
          <Button onClick={() => void run()} disabled={busy}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : "Search"}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground" aria-live="polite">
          {!mic.supported
            ? "Voice search isn't available in this browser — type your query instead."
            : mic.listening
              ? mic.transcript
                ? `Listening: ${mic.transcript}`
                : "Listening… say something like “show image of tidal turbine”."
              : "Mic is off. Tap the mic to say what image you need."}
        </p>

        <div className="grid max-h-80 grid-cols-3 gap-2 overflow-y-auto">
          {results.map((r) => (
            <button
              key={r.fullUrl}
              type="button"
              onClick={() => onPick(r)}
              className="overflow-hidden rounded-lg border border-border transition hover:ring-2 hover:ring-primary"
            >
              <img referrerPolicy="no-referrer" src={r.url} alt={r.title} className="h-24 w-full object-cover" />
              <span className="block truncate px-1.5 py-1 text-[10px] text-muted-foreground">{r.title}</span>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
