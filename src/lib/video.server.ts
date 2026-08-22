/** Resolve a real YouTube video for a spoken command.
 * The old `listType=search` embed was deprecated by YouTube and renders an
 * error, so we resolve an actual videoId from YouTube search results and pick
 * the candidate whose title best matches what the presenter asked for. */

const FILLER =
  /^(please\s+)?(can you\s+)?(play|show|display|find|search|open|pull up|bring up|start)\s+(me\s+)?(a\s+|an\s+|the\s+)?/i;

const STOP = new Set([
  "a", "an", "the", "of", "for", "and", "or", "in", "on", "at", "to", "with",
  "video", "videos", "clip", "clips", "youtube", "please", "about", "some",
]);

export function normalizeVideoQuery(raw: string): string {
  const cleaned = (raw || "")
    .replace(FILLER, "")
    .replace(/\b(video|videos|clip|clips|movie|footage)\s+(of|for|about|on)\s+/i, "")
    .replace(/\b(youtube|on youtube)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned || (raw || "").trim();
}

function tokens(text: string): string[] {
  return (text || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2 && !STOP.has(t));
}

export type VideoHit = { id: string; title: string; embedUrl: string };

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

export async function findYoutubeVideo(rawQuery: string): Promise<VideoHit | null> {
  const query = normalizeVideoQuery(rawQuery);
  if (!query) return null;
  const qTokens = tokens(query);

  const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}&sp=EgIQAQ%253D%253D`;
  try {
    const res = await fetch(url, {
      headers: { "user-agent": UA, "accept-language": "en-US,en;q=0.9" },
    });
    if (!res.ok) return null;
    const html = await res.text();

    // Collect every video renderer with its title, then rank by title overlap.
    const candidates: { id: string; title: string }[] = [];
    const re =
      /"videoRenderer":\{"videoId":"([\w-]{11})".*?"title":\{"runs":\[\{"text":"((?:[^"\\]|\\.)*)"/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(html)) && candidates.length < 20) {
      let title = m[2] ?? "";
      try {
        title = JSON.parse(`"${title}"`) as string;
      } catch {
        /* keep raw */
      }
      if (!candidates.some((c) => c.id === m![1])) {
        candidates.push({ id: m[1]!, title: title || query });
      }
    }

    if (candidates.length) {
      const scored = candidates.map((c, i) => {
        const t = c.title.toLowerCase();
        const titleTokens = new Set(tokens(c.title));
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
        if (qTokens.length) score += Math.round((matched / qTokens.length) * 8);
        if (qTokens.length > 1 && t.includes(qTokens.join(" "))) score += 5;
        score -= i * 0.4; // gentle nudge toward YouTube's own ordering
        return { ...c, score };
      });
      const best = scored.sort((a, b) => b.score - a.score)[0]!;
      return { id: best.id, title: best.title, embedUrl: embed(best.id) };
    }

    const plain = html.match(/"videoId":"([\w-]{11})"/);
    if (plain?.[1]) return { id: plain[1], title: query, embedUrl: embed(plain[1]) };
    return null;
  } catch (e) {
    console.error("Video search failed", e);
    return null;
  }
}

function embed(id: string) {
  return `https://www.youtube.com/embed/${id}?autoplay=1&rel=0&modestbranding=1`;
}
