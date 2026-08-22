import { type Slide, uid } from "./deck-types";

function slide(title: string, bullets: string[], notes = "", image: string | null = null): Slide {
  return {
    id: uid(),
    title: title.slice(0, 120) || "Untitled",
    bullets: bullets.length ? bullets : ["(no additional text found)"],
    notes,
    image,
  };
}

export async function importFile(
  file: File,
  onProgress?: (message: string) => void,
): Promise<Slide[]> {
  if (/\.pdf$/i.test(file.name)) return importPdf(file, onProgress);
  if (/\.pptx$/i.test(file.name)) return importPptx(file, onProgress);
  if (/\.(txt|md)$/i.test(file.name)) return importText(file);
  throw new Error("Unsupported file type — use .pdf, .pptx, .txt or .md");
}

async function importText(file: File): Promise<Slide[]> {
  const text = await file.text();
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const slides: Slide[] = [];
  const chunk = 5;
  for (let i = 0; i < lines.length; i += chunk) {
    const part = lines.slice(i, i + chunk);
    const title = i === 0 ? (part[0] ?? file.name) : `${file.name} (cont.)`;
    const bullets = i === 0 ? part.slice(1) : part;
    slides.push(slide(title, bullets, `Imported from ${file.name}`));
  }
  return slides;
}

async function importPdf(file: File, onProgress?: (m: string) => void): Promise<Slide[]> {
  const pdfjs = await import("pdfjs-dist");
  const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;

  const buf = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: buf }).promise;
  const maxPages = Math.min(doc.numPages, 25);
  const slides: Slide[] = [];
  for (let i = 1; i <= maxPages; i++) {
    onProgress?.(`Reading page ${i} of ${maxPages}…`);
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const raw = content.items
      .map((it) => ("str" in it ? it.str : ""))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    const sentences = raw
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.trim())
      .filter(Boolean);
    const title = (sentences[0] ?? `Page ${i}`).slice(0, 90);
    const bullets = sentences
      .slice(1, 6)
      .map((s) => (s.length > 140 ? s.slice(0, 137) + "…" : s));
    slides.push(slide(title, bullets, `Extracted from PDF page ${i}`));
  }
  if (doc.numPages > maxPages) {
    slides.push(
      slide("(truncated)", [
        `This PDF has ${doc.numPages} pages — only the first ${maxPages} were imported.`,
      ]),
    );
  }
  return slides;
}

async function importPptx(file: File, onProgress?: (m: string) => void): Promise<Slide[]> {
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const slideFiles = Object.keys(zip.files)
    .filter((p) => /^ppt\/slides\/slide\d+\.xml$/.test(p))
    .sort(
      (a, b) =>
        Number(a.match(/slide(\d+)\.xml/)?.[1] ?? 0) - Number(b.match(/slide(\d+)\.xml/)?.[1] ?? 0),
    );
  if (!slideFiles.length) throw new Error("No slides found in this .pptx");

  const parser = new DOMParser();
  const slides: Slide[] = [];
  for (let i = 0; i < slideFiles.length; i++) {
    const path = slideFiles[i]!;
    onProgress?.(`Reading slide ${i + 1} of ${slideFiles.length}…`);
    const xmlText = await zip.file(path)!.async("text");
    const xml = parser.parseFromString(xmlText, "application/xml");
    const texts = Array.from(xml.getElementsByTagName("a:t"))
      .map((n) => (n.textContent ?? "").trim())
      .filter(Boolean);

    let image: string | null = null;
    try {
      const relsPath = path.replace("ppt/slides/", "ppt/slides/_rels/") + ".rels";
      const relsFile = zip.file(relsPath);
      if (relsFile) {
        const relsXml = parser.parseFromString(await relsFile.async("text"), "application/xml");
        const rel = Array.from(relsXml.getElementsByTagName("Relationship")).find((r) =>
          /image/i.test(r.getAttribute("Type") ?? ""),
        );
        const target = rel?.getAttribute("Target")?.replace(/^\.\.\//, "ppt/");
        const imgFile = target ? zip.file(target) : null;
        if (imgFile && target) {
          const base64 = await imgFile.async("base64");
          const ext = target.match(/\.(\w+)$/)?.[1] ?? "png";
          image = `data:image/${ext === "jpg" ? "jpeg" : ext};base64,${base64}`;
        }
      }
    } catch (e) {
      console.error("Slide image extraction failed", e);
    }

    slides.push(
      slide(texts[0] ?? `Slide ${i + 1}`, texts.slice(1, 7), `Imported from slide ${i + 1}`, image),
    );
  }
  return slides;
}
