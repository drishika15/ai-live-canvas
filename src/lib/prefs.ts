import { supabase } from "@/integrations/supabase/client";
import { isGuest } from "./decks";
import type { FontName, TemplateName } from "./deck-types";

export type Prefs = {
  displayName: string;
  avatarColor: string;
  defaultTemplate: TemplateName;
  defaultFont: FontName;
  defaultSlideCount: number;
};

const DEFAULTS: Prefs = {
  displayName: "Guest",
  avatarColor: "#2E6BFF",
  defaultTemplate: "Modern",
  defaultFont: "Space Grotesk",
  defaultSlideCount: 7,
};

const GUEST_PREFS_KEY = "alc-guest-prefs";

export async function getPrefs(): Promise<Prefs> {
  if (isGuest()) {
    try {
      const raw = window.sessionStorage.getItem(GUEST_PREFS_KEY);
      return raw ? { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Prefs>) } : DEFAULTS;
    } catch {
      return DEFAULTS;
    }
  }
  const { data, error } = await supabase
    .from("profiles")
    .select("display_name, avatar_color, default_template, default_font, default_slide_count")
    .maybeSingle();
  if (error) throw error;
  if (!data) return DEFAULTS;
  return {
    displayName: data.display_name,
    avatarColor: data.avatar_color,
    defaultTemplate: data.default_template as TemplateName,
    defaultFont: data.default_font as FontName,
    defaultSlideCount: data.default_slide_count,
  };
}

export async function savePrefs(prefs: Prefs): Promise<void> {
  if (isGuest()) {
    window.sessionStorage.setItem(GUEST_PREFS_KEY, JSON.stringify(prefs));
    return;
  }
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) throw new Error("Not signed in.");
  const { error } = await supabase.from("profiles").upsert({
    id: userId,
    display_name: prefs.displayName,
    avatar_color: prefs.avatarColor,
    default_template: prefs.defaultTemplate,
    default_font: prefs.defaultFont,
    default_slide_count: prefs.defaultSlideCount,
  });
  if (error) throw error;
}
