import { useCallback, useEffect, useRef, useState } from "react";

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: ((e: any) => void) | null;
  onerror: ((e: any) => void) | null;
  onend: (() => void) | null;
};

function getRecognitionCtor(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === "undefined") return null;
  const w = window as any;
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function useSpeech(onCommand: (text: string) => void) {
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const wantRef = useRef(false);
  const handlerRef = useRef(onCommand);
  handlerRef.current = onCommand;

  useEffect(() => {
    setSupported(getRecognitionCtor() !== null);
  }, []);

  const stop = useCallback(() => {
    wantRef.current = false;
    setListening(false);
    try {
      recRef.current?.stop();
    } catch {
      /* already stopped */
    }
  }, []);

  const start = useCallback(async () => {
    const Ctor = getRecognitionCtor();
    if (!Ctor) {
      setError("Voice input isn't supported in this browser.");
      return;
    }
    setError(null);
    // Ask for mic access first: inside an embedded preview the permission prompt
    // is often blocked, and SpeechRecognition then fails silently.
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
    } catch {
      setError("Microphone blocked. Allow mic access (or open the app in a new tab) and try again.");
      setListening(false);
      return;
    }
    if (recRef.current) {
      try {
        recRef.current.stop();
      } catch {
        /* noop */
      }
    }
    const rec = new Ctor();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "en-US";
    rec.onresult = (event: any) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const text = String(result[0]?.transcript ?? "").trim();
        if (result.isFinal) {
          setTranscript("");
          if (text) handlerRef.current(text);
        } else {
          interim += text + " ";
        }
      }
      if (interim) setTranscript(interim.trim());
    };
    rec.onerror = (event: any) => {
      const code = String(event?.error ?? "");
      if (code === "no-speech") {
        setError("I didn't hear anything — try speaking again.");
        return; // onend will restart
      }
      wantRef.current = false;
      setListening(false);
      setError(
        code === "not-allowed" || code === "service-not-allowed"
          ? "Microphone blocked. Allow mic access (or open the app in a new tab) and try again."
          : code === "network"
            ? "Speech service unreachable — check your connection."
            : "Voice input stopped unexpectedly. Tap the mic to try again.",
      );
    };
    rec.onend = () => {
      if (wantRef.current) {
        try {
          rec.start();
        } catch {
          setListening(false);
        }
      } else {
        setListening(false);
      }
    };
    recRef.current = rec;
    wantRef.current = true;
    try {
      rec.start();
      setListening(true);
    } catch {
      setListening(false);
    }
  }, []);

  useEffect(() => () => stop(), [stop]);

  return {
    listening,
    supported,
    transcript,
    error,
    start,
    stop,
    toggle: () => {
      if (listening) stop();
      else void start();
    },
  };
}

export function speak(text: string) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  utter.rate = 1.02;
  window.speechSynthesis.speak(utter);
}

export function stopSpeaking() {
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
}
