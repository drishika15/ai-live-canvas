import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { FileUp, Loader2 } from "lucide-react";
import { AppShell, useDeckDefaults } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { createDeck } from "@/lib/decks";
import { importFile } from "@/lib/import-deck";

export const Route = createFileRoute("/app/import")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Import a file — AI Live Canvas" },
      {
        name: "description",
        content: "Turn an existing PPTX, PDF or text file into an editable AI Live Canvas presentation.",
      },
      { property: "og:title", content: "Import a file — AI Live Canvas" },
      { property: "og:description", content: "Import PPTX, PDF, TXT or Markdown into a live deck." },
    ],
  }),
  component: ImportPage,
});

function ImportPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { template, font } = useDeckDefaults();
  const fileRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  async function handleImport(file: File) {
    setStatus("Reading your file…");
    try {
      const slides = await importFile(file, (m) => setStatus(m));
      setStatus("Saving…");
      const deck = await createDeck({
        title: file.name.replace(/\.[^.]+$/, ""),
        template,
        font,
        slides,
      });
      await queryClient.invalidateQueries({ queryKey: ["decks"] });
      navigate({ to: "/app/deck/$id", params: { id: deck.id } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Import failed.");
    } finally {
      setStatus(null);
    }
  }

  return (
    <AppShell
      title="Import PDF, PPTX or text"
      description="We pull out the text into editable slides — then add imagery and present."
    >
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const f = e.dataTransfer.files?.[0];
          if (f) void handleImport(f);
        }}
        className={`glass grid max-w-2xl place-items-center rounded-2xl border-2 border-dashed p-10 text-center transition ${
          dragging ? "border-primary" : "border-border/60"
        }`}
      >
        <FileUp className="size-8 text-muted-foreground" />
        <p className="mt-3 font-medium">Drop a file here</p>
        <p className="mt-1 text-sm text-muted-foreground">Supports .pptx, .pdf, .txt and .md</p>
        <Button className="mt-5" onClick={() => fileRef.current?.click()} disabled={status !== null}>
          {status ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
          {status ?? "Choose a file"}
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept=".pptx,.pdf,.txt,.md"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) void handleImport(f);
          }}
        />
      </div>
    </AppShell>
  );
}
