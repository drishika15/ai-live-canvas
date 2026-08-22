import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Maximize,
  Mic,
  MicOff,
  Send,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSession } from "@/hooks/use-session";
import { useSpeech, speak, stopSpeaking } from "@/hooks/use-speech";
import { getDeck } from "@/lib/decks";
import { youtubeSearchEmbed } from "@/lib/images";
import { bestImageLive } from "@/lib/image.functions";
import { liveAssist } from "@/lib/ai.functions";
import { lookupVideo } from "@/lib/video.functions";
import { placeholderImage, templateGradient } from "@/lib/deck-types";

export const Route = createFileRoute("/present/$id")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Presenter mode — AI Live Canvas" },
      {
        name: "description",
        content:
          "Full-screen presenting with speaker notes, a timer, and a voice co-pilot that pulls up images, videos and answers on command.",
      },
      { property: "og:title", content: "Presenter mode — AI Live Canvas" },
      {
        property: "og:description",
        content: "Present with a voice co-pilot for live images, videos and answers.",
      },
    ],
  }),
  component: Presenter,
});

type Overlay =
  | { kind: "image"; src: string; caption: string }
  | { kind: "video"; src: string; caption: string }
  | { kind: "answer"; text: string; caption: string };

function Presenter() {
  const { id } = Route.useParams();
  const { signedIn, loading } = useSession();
  const navigate = useNavigate();

  const [index, setIndex] = useState(0);
  const [overlay, setOverlay] = useState<Overlay | null>(null);
  const [thinking, setThinking] = useState(false);
  const [typed, setTyped] = useState("");
  const [voiceReplies, setVoiceReplies] = useState(true);
  const [elapsed, setElapsed] = useState(0);
  const [log, setLog] = useState<string[]>([]);
  const stageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!loading && !signedIn) navigate({ to: "/auth", replace: true });
  }, [loading, signedIn, navigate]);

  const deckQuery = useQuery({ queryKey: ["deck", id], queryFn: () => getDeck(id), enabled: signedIn });
  const deck = deckQuery.data ?? null;
  const slide = deck?.slides[index] ?? null;

  useEffect(() => {
    const t = window.setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => window.clearInterval(t);
  }, []);

  const handleCommand = useCallback(
    async (raw: string) => {
      const text = raw.trim();
      if (!text || !deck) return;
      setLog((l) => [text, ...l].slice(0, 8));

      const lower = text.toLowerCase();
      if (/^(next|next slide|forward)\b/.test(lower)) {
        setIndex((i) => Math.min(i + 1, deck.slides.length - 1));
        return;
      }
      if (/^(back|previous|previous slide|go back)\b/.test(lower)) {
        setIndex((i) => Math.max(i - 1, 0));
        return;
      }
      if (/^(close|dismiss|hide)\b/.test(lower)) {
        setOverlay(null);
        stopSpeaking();
        return;
      }
      const slideJump = lower.match(/^(?:go to |jump to )?slide (\d+)/);
      if (slideJump?.[1]) {
        const n = Number(slideJump[1]);
        if (n >= 1 && n <= deck.slides.length) setIndex(n - 1);
        return;
      }

      setThinking(true);
      try {
        const result = await liveAssist({
          data: {
            command: text,
            slideTitle: slide?.title ?? "",
            deckTitle: deck.title,
          },
        });
        if (result.intent === "image") {
          const found = await bestImageLive({ data: { query: result.query || text } });
          setOverlay({
            kind: "image",
            src: found?.url ?? placeholderImage(result.query || text),
            caption: found?.title ?? (result.query || text),
          });

        } else if (result.intent === "video") {
          const wanted = result.query || text;
          const hit = await lookupVideo({ data: { query: wanted } });
          if (hit) {
            setOverlay({ kind: "video", src: hit.embedUrl, caption: hit.title });
          } else {
            setOverlay({ kind: "video", src: youtubeSearchEmbed(wanted), caption: wanted });
            toast.error(`No video found for “${wanted}” — showing a search instead.`);
          }
        } else {
          setOverlay({ kind: "answer", text: result.answer, caption: text });
          if (voiceReplies) speak(result.answer);
        }
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "The co-pilot could not respond.");
      } finally {
        setThinking(false);
      }
    },
    [deck, slide, voiceReplies],
  );

  const { listening, supported, transcript, error: micError, toggle } = useSpeech((t) => void handleCommand(t));

  // Presenter-only HUD: lives inside the stage so it survives fullscreen, and
  // fades out after a moment so the audience never sees the controls.
  const [hud, setHud] = useState(false);
  const hudTimer = useRef<number | null>(null);
  const hudInputRef = useRef<HTMLInputElement>(null);
  const revealHud = useCallback(() => {
    setHud(true);
    if (hudTimer.current) window.clearTimeout(hudTimer.current);
    hudTimer.current = window.setTimeout(() => setHud(false), 3000);
  }, []);
  useEffect(() => () => { if (hudTimer.current) window.clearTimeout(hudTimer.current); }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!deck) return;
      if (e.target instanceof HTMLInputElement) {
        if (e.key === "Escape") (e.target as HTMLInputElement).blur();
        return;
      }
      if (e.key === "ArrowRight" || e.key === " ") {
        e.preventDefault();
        setIndex((i) => Math.min(i + 1, deck.slides.length - 1));
      }
      if (e.key === "ArrowLeft") setIndex((i) => Math.max(i - 1, 0));
      if (e.key === "Escape") setOverlay(null);
      if (e.key.toLowerCase() === "f") void stageRef.current?.requestFullscreen?.();
      if (e.key.toLowerCase() === "m") {
        toggle();
        revealHud();
      }
      if (e.key.toLowerCase() === "c") {
        e.preventDefault();
        revealHud();
        window.setTimeout(() => hudInputRef.current?.focus(), 30);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [deck, toggle, revealHud]);


  if (loading || deckQuery.isLoading) {
    return (
      <div className="grid min-h-screen place-items-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!deck || !slide) {
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

  const mm = String(Math.floor(elapsed / 60)).padStart(2, "0");
  const ss = String(elapsed % 60).padStart(2, "0");

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-7xl px-4 py-4">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link to="/app/deck/$id" params={{ id: deck.id }}>
              <ArrowLeft className="mr-1.5 size-4" />
              Editor
            </Link>
          </Button>
          <span className="truncate text-sm font-medium">{deck.title}</span>
          <span className="glass rounded-full px-3 py-1 font-mono text-xs">
            {mm}:{ss}
          </span>
          <div className="ml-auto flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              aria-label={voiceReplies ? "Mute spoken answers" : "Unmute spoken answers"}
              onClick={() => {
                setVoiceReplies((v) => !v);
                stopSpeaking();
              }}
            >
              {voiceReplies ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
            </Button>
            <Button
              variant={listening ? "default" : "outline"}
              size="sm"
              onClick={toggle}
              disabled={!supported}
              className={listening ? "mic-live" : ""}
            >
              {listening ? <Mic className="mr-1.5 size-4" /> : <MicOff className="mr-1.5 size-4" />}
              {supported ? (listening ? "Listening" : "Start voice") : "Voice unsupported"}
            </Button>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
          <div className="min-w-0">
            <div
              ref={stageRef}
              onMouseMove={revealHud}
              className="slide-stage relative mx-auto aspect-video w-full max-h-[calc(100vh-11rem)] overflow-hidden rounded-2xl p-6 text-white shadow-2xl sm:p-10"

              style={{ background: templateGradient(deck.template), fontFamily: deck.font }}
            >
              <div className="flex h-full min-h-0 gap-6 sm:gap-8">
                <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
                  <h1 className="text-2xl font-semibold sm:text-4xl">{slide.title}</h1>
                  <ul className="mt-5 min-h-0 flex-1 space-y-3 overflow-y-auto pr-1 text-sm sm:text-lg">
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

              {overlay ? (
                <div className="absolute inset-0 flex flex-col bg-black/80 p-6 backdrop-blur-sm">
                  <div className="mb-3 flex items-center gap-2">
                    <span className="truncate text-sm opacity-80">{overlay.caption}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="ml-auto text-white hover:bg-white/10"
                      aria-label="Close overlay"
                      onClick={() => {
                        setOverlay(null);
                        stopSpeaking();
                      }}
                    >
                      <X className="size-4" />
                    </Button>
                  </div>
                  <div className="flex min-h-0 flex-1 items-center justify-center">
                    {overlay.kind === "image" ? (
                      <img referrerPolicy="no-referrer" src={overlay.src} alt={overlay.caption} className="max-h-full max-w-full rounded-xl" />
                    ) : overlay.kind === "video" ? (
                      <iframe
                        src={overlay.src}
                        title={overlay.caption}
                        allow="accelerometer; autoplay; encrypted-media; picture-in-picture"
                        allowFullScreen
                        className="h-full w-full rounded-xl"
                      />
                    ) : (
                      <p className="max-w-2xl text-center text-lg leading-relaxed">{overlay.text}</p>
                    )}
                  </div>
                </div>
              ) : null}

              {/* Presenter HUD — hidden from the audience unless you move the mouse or press M / C */}
              <div
                className={`absolute inset-x-0 bottom-0 flex flex-wrap items-center gap-2 bg-gradient-to-t from-black/70 to-transparent p-4 transition-opacity duration-500 ${
                  hud || thinking || transcript ? "opacity-100" : "pointer-events-none opacity-0"
                }`}
              >
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  aria-label={listening ? "Stop voice commands" : "Start voice commands"}
                  disabled={!supported}
                  onClick={() => {
                    toggle();
                    revealHud();
                  }}
                  className={`text-white hover:bg-white/15 ${listening ? "mic-live bg-white/15" : ""}`}
                >
                  {listening ? <Mic className="size-4" /> : <MicOff className="size-4" />}
                </Button>
                <form
                  className="flex min-w-0 flex-1 items-center gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const value = typed;
                    setTyped("");
                    revealHud();
                    void handleCommand(value);
                  }}
                >
                  <Input
                    ref={hudInputRef}
                    value={typed}
                    onChange={(e) => setTyped(e.target.value)}
                    onFocus={revealHud}
                    placeholder="Say or type: show image of a tidal turbine…"
                    className="h-9 max-w-md border-white/25 bg-black/40 text-white placeholder:text-white/50"
                  />
                  <Button type="submit" size="icon" variant="ghost" aria-label="Run command" className="text-white hover:bg-white/15">
                    <Send className="size-4" />
                  </Button>
                </form>
                <span className="ml-auto max-w-[45%] truncate text-xs text-white/75">
                  {thinking ? "Thinking…" : transcript ? `“${transcript}”` : micError ? micError : "M mic · C command · F fullscreen"}
                </span>
              </div>

              {thinking ? (
                <div className="absolute left-4 top-4 flex items-center gap-2 rounded-full bg-black/50 px-3 py-1.5 text-xs">
                  <Loader2 className="size-3.5 animate-spin" /> Thinking…
                </div>
              ) : null}

            </div>

            <div className="mt-3 flex items-center gap-2">
              <Button variant="outline" size="icon" aria-label="Previous slide" onClick={() => setIndex((i) => Math.max(0, i - 1))}>
                <ChevronLeft className="size-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                aria-label="Next slide"
                onClick={() => setIndex((i) => Math.min(deck.slides.length - 1, i + 1))}
              >
                <ChevronRight className="size-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void stageRef.current?.requestFullscreen?.()}
              >
                <Maximize className="mr-1.5 size-4" />
                Fullscreen
              </Button>
              <span className="text-xs text-muted-foreground">
                Slide {index + 1} of {deck.slides.length} · arrow keys to navigate, F for fullscreen
              </span>
            </div>
          </div>

          <aside className="space-y-4">
            <div className="glass rounded-2xl p-4">
              <h2 className="text-sm font-semibold">Ask the co-pilot</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Try “show image of a tidal turbine”, “play video of tides”, “next slide”, or any question.
              </p>
              <form
                className="mt-3 flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  const value = typed;
                  setTyped("");
                  void handleCommand(value);
                }}
              >
                <Input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="Type a command…" />
                <Button type="submit" size="icon" aria-label="Send command">
                  <Send className="size-4" />
                </Button>
              </form>
              {transcript ? <p className="mt-2 text-xs italic text-muted-foreground">“{transcript}”</p> : null}
            </div>

            <div className="glass rounded-2xl p-4">
              <h2 className="text-sm font-semibold">Speaker notes</h2>
              <p className="mt-2 text-sm text-muted-foreground">{slide.notes || "No notes for this slide."}</p>
            </div>

            {log.length ? (
              <div className="glass rounded-2xl p-4">
                <h2 className="text-sm font-semibold">Recent commands</h2>
                <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                  {log.map((l, i) => (
                    <li key={i} className="truncate">
                      {l}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </aside>
        </div>
      </div>
    </div>
  );
}
