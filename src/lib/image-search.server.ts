/**
 * Server-side, Google-like image search.
 * Runs several free sources in parallel (DuckDuckGo image index, Openverse,
 * Wikimedia Commons, Wikipedia lead image), then ranks every candidate by how
 * well its title matches the spoken/typed command so the top hit is the thing
 * that was actually asked for.
 */

export type ImageHit = {
  title: string;
  url: string;
  fullUrl: string;
  source: string;
  score?: number;
};

const STOP = new Set([
  "a", "an", "the", "of", "for", "and", "or", "in", "on", "at", "to", "with", "show",
  "me", "image", "images", "picture", "pictures", "photo", "photos", "diagram", "please",
  "display", "about", "some", "that", "this", "it", "is", "are", "video", "clip", "pull",
  "up", "bring", "give", "find", "search", "get", "look", "can", "you", "slide",
]);

const NOISE =
  /\b(logo|icon|seal|coat of arms|flag|signature|stamp|banner|barnstar|userbox|template|wikipedia|clipart|watermark|stock photo|shutterstock|alamy|blank)\b/i;

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

export function normalizeImageQuery(raw: string): string {
  const cleaned = (raw || "")
    .replace(
      /^(please\s+)?(can you\s+)?(show|display|find|search|get|bring|pull|pull up|generate|give)\s+(me\s+)?(an?\s+|the\s+)?/i,
      "",
    )
    .replace(/\b(image|images|picture|pictures|photo|photos|diagram|visual)\s+(of|for|about|on)\s+/i, "")
    .replace(/\b(image|images|picture|pictures|photos?)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned || (raw || "").trim();
}

function tokens(text: string): string[] {
  return (text || "")
    .toLowerCase()
    .replace(/[_\-.,()[\]{}"'’/\\|:;!?]+/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2 && !STOP.has(t));
}

function relevance(title: string, qTokens: string[]): number {
  const t = (title || "").toLowerCase();
  const titleTokens = new Set(tokens(title));
  let score = 0;
  let matched = 0;
  for (const q of qTokens) {
    if (titleTokens.has(q)) {
      score += 4;
      matched++;
    } else if (t.includes(q)) {
      score += 2;
      matched++;
    }
  }
  if (qTokens.length) {
    const coverage = matched / qTokens.length;
    score += Math.round(coverage * 8); // reward hitting most of the request
    if (coverage === 1) score += 4;
    if (coverage === 0) score -= 6;
  }
  if (qTokens.length > 1 && t.includes(qTokens.join(" "))) score += 5;
  if (NOISE.test(title)) score -= 6;
  if (t.length > 110) score -= 1;
  return score;
}

/* ---------------- sources ---------------- */

async function duckduckgoImages(query: string, limit: number): Promise<ImageHit[]> {
  const tokenRes = await fetch(
    `https://duckduckgo.com/?q=${encodeURIComponent(query)}&iax=images&ia=images`,
    { headers: { "user-agent": UA, "accept-language": "en-US,en;q=0.9" } },
  );
  if (!tokenRes.ok) return [];
  const html = await tokenRes.text();
  const vqd =
    html.match(/vqd=["']([\d-]+)["']/)?.[1] ??
    html.match(/vqd=([\d-]+)&/)?.[1] ??
    html.match(/"vqd":\s*["']([\d-]+)["']/)?.[1];
  if (!vqd) return [];

  const res = await fetch(
    `https://duckduckgo.com/i.js?l=us-en&o=json&q=${encodeURIComponent(query)}&vqd=${vqd}&f=,,,,,&p=1`,
    {
      headers: {
        "user-agent": UA,
        accept: "application/json, text/javascript; q=0.01",
        referer: `https://duckduckgo.com/?q=${encodeURIComponent(query)}&iax=images&ia=images`,
        "accept-language": "en-US,en;q=0.9",
      },
    },
  );
  if (!res.ok) return [];
  const data = (await res.json()) as {
    results?: { title?: string; image?: string; thumbnail?: string; width?: number; height?: number }[];
  };
  return (data.results ?? [])
    .filter((r) => r.image && /^https:\/\//.test(r.image))
    .slice(0, limit)
    .map((r) => ({
      title: r.title || query,
      url: r.image!,
      fullUrl: r.image!,
      source: "web",
    }));
}

async function openverseImages(query: string, limit: number): Promise<ImageHit[]> {
  const res = await fetch(
    `https://api.openverse.org/v1/images/?q=${encodeURIComponent(query)}&page_size=${limit}&mature=false`,
    { headers: { "user-agent": UA, accept: "application/json" } },
  );
  if (!res.ok) return [];
  const data = (await res.json()) as {
    results?: { title?: string; url?: string; thumbnail?: string }[];
  };
  return (data.results ?? [])
    .filter((r) => r.url)
    .map((r) => ({
      title: r.title || query,
      url: r.thumbnail || r.url!,
      fullUrl: r.url!,
      source: "openverse",
    }));
}

async function commonsImages(search: string, limit: number): Promise<ImageHit[]> {
  const url =
    `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrnamespace=6` +
    `&gsrsearch=${encodeURIComponent(search)}&gsrlimit=${limit}` +
    `&prop=imageinfo&iiprop=url&iiurlwidth=1000&format=json&origin=*`;
  const res = await fetch(url, { headers: { "user-agent": UA } });
  if (!res.ok) return [];
  const data = (await res.json()) as {
    query?: {
      pages?: Record<string, { title: string; imageinfo?: { url: string; thumburl?: string }[] }>;
    };
  };
  return Object.values(data.query?.pages ?? {})
    .filter((p) => p.imageinfo?.[0] && /\.(jpe?g|png|webp)$/i.test(p.title))
    .map((p) => {
      const info = p.imageinfo![0]!;
      return {
        title: p.title.replace(/^File:/, "").replace(/\.(jpe?g|png|webp)$/i, ""),
        url: info.thumburl ?? info.url,
        fullUrl: info.url,
        source: "commons",
      };
    });
}

async function wikipediaLeadImage(query: string): Promise<ImageHit[]> {
  const res = await fetch(
    `https://en.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(
      query,
    )}&gsrlimit=3&prop=pageimages&piprop=original|thumbnail&pithumbsize=1000&format=json&origin=*`,
    { headers: { "user-agent": UA } },
  );
  if (!res.ok) return [];
  const data = (await res.json()) as {
    query?: {
      pages?: Record<
        string,
        { title: string; original?: { source: string }; thumbnail?: { source: string } }
      >;
    };
  };
  return Object.values(data.query?.pages ?? {})
    .filter((p) => p.original?.source || p.thumbnail?.source)
    .map((p) => ({
      title: p.title,
      url: p.thumbnail?.source ?? p.original!.source,
      fullUrl: p.original?.source ?? p.thumbnail!.source,
      source: "wikipedia",
    }));
}

/* ---------------- ranking ---------------- */

const SOURCE_BONUS: Record<string, number> = {
  web: 6, // closest to a Google image result
  wikipedia: 4,
  openverse: 2,
  commons: 1,
};

export async function searchImagesServer(
  rawQuery: string,
  limit = 9,
  exclude: string[] = [],
): Promise<ImageHit[]> {
  const q = normalizeImageQuery(rawQuery);
  if (!q) return [];
  const qTokens = tokens(q);
  const skip = new Set(exclude);

  const batches = await Promise.all([
    duckduckgoImages(q, Math.max(limit * 3, 24)).catch(() => []),
    wikipediaLeadImage(q).catch(() => []),
    openverseImages(q, Math.max(limit * 2, 16)).catch(() => []),
    commonsImages(qTokens.length > 1 ? `intitle:"${q}" OR ${q}` : q, Math.max(limit * 2, 16)).catch(
      () => [],
    ),
  ]);

  const seen = new Set<string>();
  const pool: ImageHit[] = [];
  for (const batch of batches) {
    for (const hit of batch) {
      if (skip.has(hit.fullUrl) || skip.has(hit.url)) continue;
      const key = hit.fullUrl.split("?")[0]!;
      if (seen.has(key)) continue;
      seen.add(key);
      pool.push({ ...hit, score: relevance(hit.title, qTokens) + (SOURCE_BONUS[hit.source] ?? 0) });
    }
  }

  const ranked = pool.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  const strong = ranked.filter((r) => (r.score ?? 0) >= 6);
  return (strong.length ? strong : ranked).slice(0, limit);
}

/** Single best match, retrying with tighter keyword sets when nothing matches. */
export async function bestImageServer(
  rawQuery: string,
  exclude: string[] = [],
): Promise<ImageHit | null> {
  const q = normalizeImageQuery(rawQuery);
  const qTokens = tokens(q);
  const attempts = [q];
  if (qTokens.length > 3) attempts.push(qTokens.slice(0, 3).join(" "));
  if (qTokens.length > 1) attempts.push(qTokens.slice(0, 2).join(" "));

  let fallback: ImageHit | null = null;
  for (const attempt of attempts) {
    const results = await searchImagesServer(attempt, 8, exclude);
    if (!results.length) continue;
    fallback ??= results[0]!;
    const hit = results.find((r) => (r.score ?? 0) >= 8);
    if (hit) return hit;
  }
  return fallback;
}
