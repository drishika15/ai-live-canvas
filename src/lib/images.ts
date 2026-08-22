export type ImageResult = { title: string; url: string; fullUrl: string; score?: number };

const STOP = new Set([
  "a", "an", "the", "of", "for", "and", "or", "in", "on", "at", "to", "with", "show",
  "me", "image", "images", "picture", "pictures", "photo", "photos", "diagram", "please",
  "display", "about", "some", "that", "this", "it", "is", "are", "video", "clip",
]);

/** Words that usually indicate an off-target Commons file (logos, seals, charts of unrelated data). */
const NOISE = /\b(logo|icon|seal|coat of arms|flag|signature|stamp|banner|barnstar|userbox|template|screenshot of wikipedia)\b/i;

function tokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[_\-.,()[\]{}"'’/\\]+/g, " ")
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 2 && !STOP.has(t));
}

/** Normalise a spoken/typed command into a tight visual search phrase. */
export function normalizeImageQuery(raw: string): string {
  const cleaned = (raw || "")
    .replace(/^(please\s+)?(can you\s+)?(show|display|find|search|get|bring|pull)\s+(me\s+)?(an?\s+|the\s+)?/i, "")
    .replace(/\b(image|images|picture|pictures|photo|photos|diagram|visual)\s+(of|for|about)\s+/i, "")
    .replace(/\b(image|images|picture|pictures|photo|photos)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned || raw.trim();
}

function relevance(title: string, queryTokens: string[]): number {
  const t = title.toLowerCase();
  const titleTokens = new Set(tokens(title));
  let score = 0;
  for (const q of queryTokens) {
    if (titleTokens.has(q)) score += 3;
    else if (t.includes(q)) score += 2;
  }
  // reward matching the full phrase, penalise obvious noise and very long file names
  if (queryTokens.length > 1 && t.includes(queryTokens.join(" "))) score += 4;
  if (NOISE.test(title)) score -= 5;
  if (t.length > 90) score -= 1;
  return score;
}

async function commonsSearch(search: string, limit: number): Promise<ImageResult[]> {
  const url =
    `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrnamespace=6` +
    `&gsrsearch=${encodeURIComponent(search)}&gsrlimit=${limit}` +
    `&prop=imageinfo&iiprop=url%7Cextmetadata&iiurlwidth=900&format=json&origin=*`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Wikimedia HTTP " + res.status);
  const data = (await res.json()) as {
    query?: { pages?: Record<string, { title: string; imageinfo?: { url: string; thumburl?: string }[] }> };
  };
  return Object.values(data.query?.pages ?? {})
    .filter((p) => p.imageinfo?.[0] && /\.(jpe?g|png|gif|webp)$/i.test(p.title))
    .map((p) => {
      const info = p.imageinfo![0]!;
      return {
        title: p.title.replace(/^File:/, "").replace(/\.(jpe?g|png|gif|webp)$/i, ""),
        url: info.thumburl ?? info.url,
        fullUrl: info.url,
      };
    });
}

/**
 * Live image search against Wikimedia Commons (CORS-enabled, no API key).
 * Runs a strict phrase pass plus a broad pass, then ranks hits by how well the
 * file name matches the requested subject so the top result actually matches.
 */
export async function searchImages(query: string, limit = 6): Promise<ImageResult[]> {
  const q = normalizeImageQuery(query);
  if (!q) return [];
  const qTokens = tokens(q);

  try {
    const passes: string[] = [];
    if (qTokens.length > 1) passes.push(`intitle:"${q}"`, `"${q}"`);
    passes.push(q);

    const settled = await Promise.all(
      passes.map((p) => commonsSearch(p, Math.max(limit * 4, 20)).catch(() => [] as ImageResult[])),
    );

    const seen = new Set<string>();
    const pool: ImageResult[] = [];
    settled.forEach((batch, passIndex) => {
      for (const r of batch) {
        if (seen.has(r.fullUrl)) continue;
        seen.add(r.fullUrl);
        // earlier (stricter) passes get a relevance bonus
        pool.push({ ...r, score: relevance(r.title, qTokens) + (passes.length - passIndex) });
      }
    });

    const ranked = pool.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
    const strong = ranked.filter((r) => (r.score ?? 0) > 0);
    return (strong.length ? strong : ranked).slice(0, limit);
  } catch (e) {
    console.error("Image search failed", e);
    return [];
  }
}

/**
 * Best single match for a spoken command. Requires the winning file name to
 * actually contain one of the requested words, otherwise it retries with the
 * most meaningful keywords only, so overlays match what was asked for.
 */
export async function bestImage(query: string): Promise<ImageResult | null> {
  const q = normalizeImageQuery(query);
  const qTokens = tokens(q);
  const attempts = [q];
  if (qTokens.length > 2) attempts.push(qTokens.slice(0, 2).join(" "));
  if (qTokens.length > 1) attempts.push(qTokens[0]!);

  for (const attempt of attempts) {
    const results = await searchImages(attempt, 8);
    const hit = results.find((r) => {
      const titleTokens = new Set(tokens(r.title));
      return qTokens.some((t) => titleTokens.has(t) || r.title.toLowerCase().includes(t));
    });
    if (hit) return hit;
    if (results[0] && attempt === attempts[attempts.length - 1]) return results[0];
  }
  return null;
}

export function youtubeSearchEmbed(query: string) {
  return `https://www.youtube.com/embed?listType=search&list=${encodeURIComponent(query)}`;
}

