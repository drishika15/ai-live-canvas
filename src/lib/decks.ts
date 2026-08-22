import { supabase } from "@/integrations/supabase/client";
import {
  type Deck,
  type FontName,
  type TemplateName,
  type Slide,
  uid,
} from "./deck-types";

const GUEST_KEY = "alc-guest-session";
const GUEST_DECKS_KEY = "alc-guest-decks";

export type GuestSession = { name: string; startedAt: number };

export function getGuestSession(): GuestSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(GUEST_KEY);
    return raw ? (JSON.parse(raw) as GuestSession) : null;
  } catch {
    return null;
  }
}

export function startGuestSession() {
  const session: GuestSession = { name: "Guest", startedAt: Date.now() };
  window.sessionStorage.setItem(GUEST_KEY, JSON.stringify(session));
  return session;
}

export function endGuestSession() {
  window.sessionStorage.removeItem(GUEST_KEY);
  window.sessionStorage.removeItem(GUEST_DECKS_KEY);
}

export function isGuest() {
  return getGuestSession() !== null;
}

/* ------------------------------ guest deck store ------------------------------ */

function readGuestDecks(): Deck[] {
  try {
    const raw = window.sessionStorage.getItem(GUEST_DECKS_KEY);
    return raw ? (JSON.parse(raw) as Deck[]) : [];
  } catch {
    return [];
  }
}

function writeGuestDecks(decks: Deck[]) {
  try {
    window.sessionStorage.setItem(GUEST_DECKS_KEY, JSON.stringify(decks));
  } catch {
    /* quota — guest data is ephemeral anyway */
  }
}

/* ------------------------------ shared deck API ------------------------------ */

type DeckRow = {
  id: string;
  title: string;
  template: string;
  font: string;
  slides: unknown;
  updated_at: string;
};

function rowToDeck(row: DeckRow): Deck {
  return {
    id: row.id,
    title: row.title,
    template: row.template as TemplateName,
    font: row.font as FontName,
    slides: (Array.isArray(row.slides) ? row.slides : []) as Slide[],
    updatedAt: row.updated_at,
  };
}

export async function listDecks(): Promise<Deck[]> {
  if (isGuest()) {
    return readGuestDecks().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }
  const { data, error } = await supabase
    .from("decks")
    .select("id, title, template, font, slides, updated_at")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => rowToDeck(row as DeckRow));
}

export async function getDeck(id: string): Promise<Deck | null> {
  if (isGuest()) {
    return readGuestDecks().find((d) => d.id === id) ?? null;
  }
  const { data, error } = await supabase
    .from("decks")
    .select("id, title, template, font, slides, updated_at")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data ? rowToDeck(data as DeckRow) : null;
}

export async function createDeck(input: {
  title: string;
  template: TemplateName;
  font: FontName;
  slides: Slide[];
}): Promise<Deck> {
  if (isGuest()) {
    const deck: Deck = { id: uid(), ...input, updatedAt: new Date().toISOString() };
    writeGuestDecks([deck, ...readGuestDecks()]);
    return deck;
  }
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) throw new Error("You need to be signed in to save a presentation.");
  const { data, error } = await supabase
    .from("decks")
    .insert({
      user_id: userId,
      title: input.title,
      template: input.template,
      font: input.font,
      slides: input.slides as unknown as never,
    })
    .select("id, title, template, font, slides, updated_at")
    .single();
  if (error) throw error;
  return rowToDeck(data as DeckRow);
}

export async function saveDeck(deck: Deck): Promise<void> {
  if (isGuest()) {
    const decks = readGuestDecks().map((d) =>
      d.id === deck.id ? { ...deck, updatedAt: new Date().toISOString() } : d,
    );
    writeGuestDecks(decks);
    return;
  }
  const { error } = await supabase
    .from("decks")
    .update({
      title: deck.title,
      template: deck.template,
      font: deck.font,
      slides: deck.slides as unknown as never,
    })
    .eq("id", deck.id);
  if (error) throw error;
}

export async function deleteDeck(id: string): Promise<void> {
  if (isGuest()) {
    writeGuestDecks(readGuestDecks().filter((d) => d.id !== id));
    return;
  }
  const { error } = await supabase.from("decks").delete().eq("id", id);
  if (error) throw error;
}
