import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { chatJson } from "./ai-gateway.server";

const OutlineInput = z.object({
  topic: z.string().min(3).max(600),
  slideCount: z.number().int().min(3).max(12),
});

const AssistInput = z.object({
  command: z.string().min(1).max(500),
  slideTitle: z.string().max(200).optional(),
  deckTitle: z.string().max(200).optional(),
});

export type OutlineResult = {
  title: string;
  slides: { title: string; bullets: string[]; notes: string; imageQuery: string }[];
};

export type AssistResult = {
  intent: "image" | "video" | "answer";
  query: string;
  answer: string;
};

export const generateOutline = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => OutlineInput.parse(input))
  .handler(async ({ data }) => {
    const system =
      `You design presentation outlines. Respond with ONLY valid minified JSON, no markdown fences, no commentary. ` +
      `Schema: {"title": string, "slides": [{"title": string, "bullets": [string], "notes": string, "imageQuery": string}]}. ` +
      `Keep bullets short (<10 words each), 5 bullets per slide, covering distinct non-repetitive points. ` +
      `Keep "notes" to one brief speaker note (<14 words). Include exactly ${data.slideCount} content slides. ` +
      `imageQuery must be 2-4 concrete, literal nouns naming exactly what THIS slide's content shows (a real object, place, person, device or diagram) — no adjectives, no abstract words like "innovation" or "future", no brand slogans, so a photo search finds a matching picture. ` +
      `Every slide's imageQuery must name a visually DIFFERENT subject from every other slide — never repeat a query, a subject, or the deck topic alone. ` +
      `Every bullet must be factually accurate and specific to the topic — no filler, no self-references to the tool.`;
    return chatJson<OutlineResult>(system, `Topic: ${data.topic}`);
  });

export const liveAssist = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => AssistInput.parse(input))
  .handler(async ({ data }) => {
    const system =
      `You power the live panel of a presentation tool. The presenter speaks or types a command mid-talk. ` +
      `Classify it and respond with ONLY valid minified JSON: {"intent":"image"|"video"|"answer","query":string,"answer":string}. ` +
      `Use "image" when they ask to show/display a picture, photo, diagram or map. ` +
      `Use "video" when they ask to play/show a video or clip. ` +
      `Otherwise use "answer" and put a concise 2-3 sentence audience-friendly explanation in "answer". ` +
      `"query" is a short search phrase for image/video intents (empty string for "answer").`;
    const context = [
      data.deckTitle ? `Deck: ${data.deckTitle}` : null,
      data.slideTitle ? `Current slide: ${data.slideTitle}` : null,
      `Command: ${data.command}`,
    ]
      .filter(Boolean)
      .join("\n");
    return chatJson<AssistResult>(system, context);
  });
