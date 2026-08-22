import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { savePrefs, type Prefs } from "@/lib/prefs";
import {
  AVATAR_COLORS,
  FONT_NAMES,
  TEMPLATE_NAMES,
  type FontName,
  type TemplateName,
} from "@/lib/deck-types";

export function SettingsDialog({
  open,
  onOpenChange,
  prefs,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  prefs: Prefs | undefined;
  onSaved: () => void;
}) {
  const [draft, setDraft] = useState<Prefs | null>(null);
  useEffect(() => {
    if (prefs) setDraft(prefs);
  }, [prefs, open]);

  async function save() {
    if (!draft) return;
    try {
      await savePrefs(draft);
      onSaved();
      onOpenChange(false);
      toast.success("Preferences saved.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Preferences</DialogTitle>
          <DialogDescription>Defaults applied to every new deck you create.</DialogDescription>
        </DialogHeader>
        {draft ? (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Display name</Label>
              <Input
                value={draft.displayName}
                onChange={(e) => setDraft({ ...draft, displayName: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Avatar colour</Label>
              <div className="flex gap-2">
                {AVATAR_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    aria-label={`Colour ${c}`}
                    onClick={() => setDraft({ ...draft, avatarColor: c })}
                    className={`size-8 rounded-full border-2 transition ${
                      draft.avatarColor === c ? "border-foreground" : "border-transparent"
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Default template</Label>
                <Select
                  value={draft.defaultTemplate}
                  onValueChange={(v) => setDraft({ ...draft, defaultTemplate: v as TemplateName })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TEMPLATE_NAMES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Default font</Label>
                <Select
                  value={draft.defaultFont}
                  onValueChange={(v) => setDraft({ ...draft, defaultFont: v as FontName })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FONT_NAMES.map((f) => (
                      <SelectItem key={f} value={f}>
                        {f}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Default slide count: {draft.defaultSlideCount}</Label>
              <Slider
                min={3}
                max={12}
                step={1}
                value={[draft.defaultSlideCount]}
                onValueChange={(v) => setDraft({ ...draft, defaultSlideCount: v[0] ?? 7 })}
              />
            </div>
            <Button className="w-full" onClick={save}>
              Save preferences
            </Button>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
