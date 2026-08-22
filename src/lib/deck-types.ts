export type Slide = {
  id: string;
  title: string;
  bullets: string[];
  notes: string;
  image: string | null;
  imageCredit?: string | null;
};

export type Deck = {
  id: string;
  title: string;
  template: TemplateName;
  font: FontName;
  slides: Slide[];
  updatedAt: string;
};

export type TemplateName =
  | "Modern"
  | "Midnight"
  | "Sunrise"
  | "Forest"
  | "Coral"
  | "Slate";

export const TEMPLATES: Record<TemplateName, { a: string; b: string }> = {
  Modern: { a: "#2E6BFF", b: "#63E6FF" },
  Midnight: { a: "#141B3D", b: "#3B2E8F" },
  Sunrise: { a: "#F5A524", b: "#FF5F6D" },
  Forest: { a: "#0F766E", b: "#34D399" },
  Coral: { a: "#FF7A59", b: "#B23FD6" },
  Slate: { a: "#22345E", b: "#5A6480" },
};

export const TEMPLATE_NAMES = Object.keys(TEMPLATES) as TemplateName[];

export type FontName = "Space Grotesk" | "Inter" | "IBM Plex Mono" | "Georgia";
export const FONT_NAMES: FontName[] = ["Space Grotesk", "Inter", "IBM Plex Mono", "Georgia"];

export const AVATAR_COLORS = ["#2E6BFF", "#12A594", "#FF7A59", "#B23FD6", "#22345E", "#F5A524"];

export function uid() {
  return Math.random().toString(36).slice(2, 10);
}

export function templateGradient(name: string) {
  const tpl = TEMPLATES[(name as TemplateName) in TEMPLATES ? (name as TemplateName) : "Modern"];
  return `linear-gradient(135deg, ${tpl.a}, ${tpl.b})`;
}

export function emptySlide(title = "Title slide"): Slide {
  return {
    id: uid(),
    title,
    bullets: ["Click to edit this slide"],
    notes: "",
    image: null,
  };
}

export function placeholderImage(text: string) {
  const t = (text || "image").slice(0, 40);
  const hue = Math.abs([...t].reduce((a, c) => a + c.charCodeAt(0), 0)) % 360;
  const esc = t.replace(/[&<>"']/g, "");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="700" height="440" viewBox="0 0 700 440">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="hsl(${hue},70%,45%)"/><stop offset="1" stop-color="hsl(${(hue + 50) % 360},70%,30%)"/>
    </linearGradient></defs>
    <rect width="700" height="440" fill="url(#g)"/>
    <text x="350" y="215" font-family="sans-serif" font-size="30" fill="#fff" text-anchor="middle" font-weight="600">${esc}</text>
    <text x="350" y="255" font-family="sans-serif" font-size="15" fill="rgba(255,255,255,0.75)" text-anchor="middle">no live match found — placeholder</text>
  </svg>`;
  return "data:image/svg+xml;utf8," + encodeURIComponent(svg);
}
