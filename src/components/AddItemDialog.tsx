import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ImagePlus, Wand2, RotateCcw, Plus, X, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { CATEGORIES, type Category } from "@/lib/wardrobe";
import { streamImage } from "@/lib/stream-image";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

async function resizeImage(file: File, max = 1536): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  return new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error("resize"))), "image/jpeg", 0.9));
}

async function removeDarkBorder(src: string): Promise<string> {
  const image = new Image();
  image.src = src;
  await image.decode();
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const context = canvas.getContext("2d");
  if (!context) return src;
  context.drawImage(image, 0, 0);
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
  const { data, width, height } = pixels;
  const queue: number[] = [];
  const visited = new Uint8Array(width * height);
  const isDark = (index: number) => data[index * 4 + 3] > 0 && data[index * 4] < 55 && data[index * 4 + 1] < 55 && data[index * 4 + 2] < 55;
  const add = (x: number, y: number) => {
    const index = y * width + x;
    if (!visited[index] && isDark(index)) {
      visited[index] = 1;
      queue.push(index);
    }
  };
  for (let x = 0; x < width; x++) { add(x, 0); add(x, height - 1); }
  for (let y = 1; y < height - 1; y++) { add(0, y); add(width - 1, y); }
  for (let cursor = 0; cursor < queue.length; cursor++) {
    const index = queue[cursor]!;
    data[index * 4 + 3] = 0;
    const x = index % width;
    const y = Math.floor(index / width);
    if (x > 0) add(x - 1, y);
    if (x < width - 1) add(x + 1, y);
    if (y > 0) add(x, y - 1);
    if (y < height - 1) add(x, y + 1);
  }
  context.putImageData(pixels, 0, 0);
  return canvas.toDataURL("image/png");
}

type Draft = {
  id: string;
  file: File;
  preview: string;
  aiImage: string | null;
  aiFinal: boolean;
  useAi: boolean;
  generating: boolean;
  category: Category;
  name: string;
  brand: string;
  color: string;
  style: string;
  saved: boolean;
};

export function AddItemDialog({
  open,
  onOpenChange,
  defaultCategory,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  defaultCategory?: Category | undefined;
}) {
  const qc = useQueryClient();
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [savingAll, setSavingAll] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const active = drafts.find((d) => d.id === activeId) ?? null;

  useEffect(() => {
    if (open) {
      setDrafts([]);
      setActiveId(null);
      setSavingAll(false);
    }
  }, [open]);

  function addFiles(files: FileList | File[]) {
    const arr = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (arr.length === 0) return;
    const newDrafts: Draft[] = arr.map((file) => ({
      id: crypto.randomUUID(),
      file,
      preview: URL.createObjectURL(file),
      aiImage: null,
      aiFinal: false,
      useAi: true,
      generating: false,
      category: defaultCategory ?? "maglie",
      name: "",
      brand: "",
      color: "",
      style: "",
      saved: false,
    }));
    setDrafts((prev) => [...prev, ...newDrafts]);
    setActiveId(newDrafts[0]!.id);
    void processNewDrafts(newDrafts);
  }

  async function processNewDrafts(newDrafts: Draft[]) {
    for (const draft of newDrafts) {
      await makeCatalogPhoto(draft);
    }
  }

  function removeDraft(id: string) {
    setDrafts((prev) => {
      const d = prev.find((x) => x.id === id);
      if (d) URL.revokeObjectURL(d.preview);
      const next = prev.filter((x) => x.id !== id);
      if (activeId === id) setActiveId(next[0]?.id ?? null);
      return next;
    });
  }

  function updateDraft(id: string, patch: Partial<Draft>) {
    setDrafts((prev) => prev.map((d) => (d.id === id ? { ...d, ...patch } : d)));
  }

  async function makeCatalogPhoto(draft: Draft) {
    updateDraft(draft.id, { generating: true, aiFinal: false });
    try {
      const { data } = await supabase.auth.getSession();
      const form = new FormData();
      form.append("image", await resizeImage(draft.file), "capo.jpg");
      form.append("name", draft.name.trim());
      form.append("brand", draft.brand.trim());
      form.append("category", draft.category);
      let latestImage = "";
      await streamImage(
        "/api/clean-image",
        form,
        (src, isFinal) => {
          latestImage = src;
          updateDraft(draft.id, { aiImage: src, aiFinal: isFinal });
        },
        undefined,
        { Authorization: `Bearer ${data.session?.access_token ?? ""}` },
      );
      const cleanedImage = latestImage ? await removeDarkBorder(latestImage) : null;
      updateDraft(draft.id, { aiImage: cleanedImage, aiFinal: !!cleanedImage, useAi: !!cleanedImage });
    } catch (err) {
      console.error(err);
      updateDraft(draft.id, { aiImage: null, aiFinal: false });
      const msg = err instanceof Error ? err.message : "";
      toast.error(
        msg.includes("402") ? "Crediti AI esauriti" : msg.includes("429") ? "Troppe richieste, riprova tra poco" : "Non sono riuscito a creare la foto, puoi usare l'originale",
      );
    } finally {
      updateDraft(draft.id, { generating: false });
    }
  }

  async function saveDraft(draft: Draft): Promise<boolean> {
    if (!draft.name.trim()) return false;
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Non sei collegato");
      const useCatalog = draft.useAi && draft.aiFinal && draft.aiImage;
      const body: Blob = useCatalog ? await (await fetch(draft.aiImage)).blob() : await resizeImage(draft.file, 1600);
      const ext = useCatalog ? "png" : "jpg";
      const path = `${u.user.id}/${crypto.randomUUID()}.${ext}`;
      const up = await supabase.storage.from("wardrobe").upload(path, body, { contentType: useCatalog ? "image/png" : "image/jpeg" });
      if (up.error) throw up.error;
      const { error } = await supabase.from("items").insert({
        name: draft.name.trim().slice(0, 80),
        brand: draft.brand.trim().slice(0, 40) || null,
        category: draft.category,
        color: draft.color.trim().slice(0, 40) || null,
        style: draft.style.trim().slice(0, 40) || null,
        image_path: path,
      });
      if (error) {
        await supabase.storage.from("wardrobe").remove([path]);
        throw error;
      }
      updateDraft(draft.id, { saved: true });
      return true;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Errore nel salvataggio");
      return false;
    }
  }

  async function saveAll() {
    const unsaved = drafts.filter((d) => !d.saved);
    const invalid = unsaved.filter((d) => !d.name.trim());
    if (invalid.length > 0) {
      toast.error(`${invalid.length} capi senza nome`);
      setActiveId(invalid[0]!.id);
      return;
    }
    setSavingAll(true);
    let ok = 0;
    for (const d of unsaved) {
      if (await saveDraft(d)) ok++;
    }
    setSavingAll(false);
    if (ok > 0) {
      toast.success(`${ok} capi aggiunti al guardaroba`);
      qc.invalidateQueries({ queryKey: ["items"] });
    }
    if (ok === unsaved.length) onOpenChange(false);
  }

  const shown = active ? (active.useAi && active.aiImage ? active.aiImage : active.preview) : null;
  const unsavedCount = drafts.filter((d) => !d.saved).length;
  const processing = drafts.some((draft) => draft.generating);

  return (
    <Dialog open={open} onOpenChange={(o) => !savingAll && onOpenChange(o)}>
      <DialogContent className="max-h-[92vh] overflow-y-auto rounded-3xl sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xl font-extrabold">Aggiungi vestiti</DialogTitle>
        </DialogHeader>

        {drafts.length === 0 ? (
          <div className="space-y-4">
            <label className="relative flex aspect-square cursor-pointer items-center justify-center overflow-hidden rounded-3xl border-2 border-dashed border-border bg-surface">
              <div className="text-center text-surface-foreground/60">
                <ImagePlus className="mx-auto h-10 w-10" />
                <p className="mt-2 text-sm font-bold">Tocca per scegliere le foto</p>
                <p className="mt-1 text-xs text-muted-foreground">Puoi selezionare più articoli insieme</p>
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => {
                  if (e.target.files) addFiles(e.target.files);
                  e.target.value = "";
                }}
              />
            </label>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Thumbnail strip */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              {drafts.map((d) => (
                <button
                  key={d.id}
                  onClick={() => setActiveId(d.id)}
                  className={cn(
                    "relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl border-2 bg-surface",
                    activeId === d.id ? "border-primary" : "border-border",
                  )}
                >
                  <img src={d.useAi && d.aiImage ? d.aiImage : d.preview} alt="" className="h-full w-full object-cover" />
                  {d.saved && (
                    <span className="absolute inset-0 flex items-center justify-center bg-primary/80">
                      <Check className="h-5 w-5 text-primary-foreground" />
                    </span>
                  )}
                  {!d.saved && (
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => { e.stopPropagation(); removeDraft(d.id); }}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); removeDraft(d.id); } }}
                      className="absolute right-0.5 top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-foreground/80 text-background"
                    >
                      <X className="h-3 w-3" />
                    </span>
                  )}
                </button>
              ))}
              <button
                onClick={() => fileRef.current?.click()}
                className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border-2 border-dashed border-border text-muted-foreground"
                aria-label="Aggiungi altre foto"
              >
                <Plus className="h-5 w-5" />
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => {
                  if (e.target.files) addFiles(e.target.files);
                  e.target.value = "";
                }}
              />
            </div>

            {active && !active.saved && (
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  {CATEGORIES.map((c) => (
                    <button
                      type="button"
                      key={c.value}
                      onClick={() => updateDraft(active.id, { category: c.value })}
                      className={cn(
                        "rounded-full border px-3 py-1.5 text-sm font-bold",
                        active.category === c.value ? "border-primary bg-primary text-primary-foreground" : "border-border text-foreground",
                      )}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>

                <Input
                  placeholder="Nome (es. Felpa grigia oversize)"
                  value={active.name}
                  onChange={(e) => updateDraft(active.id, { name: e.target.value })}
                  maxLength={80}
                  className="h-11 rounded-full px-5"
                />
                <Input
                  placeholder="Marchio (es. Nike, Zara…)"
                  value={active.brand}
                  onChange={(e) => updateDraft(active.id, { brand: e.target.value })}
                  maxLength={40}
                  className="h-11 rounded-full px-5"
                />

                <label className="relative flex aspect-square cursor-pointer items-center justify-center overflow-hidden rounded-3xl border-2 border-dashed border-border bg-surface">
                  {shown ? (
                    <img
                      src={shown}
                      alt="Anteprima"
                      className={cn(
                        "h-full w-full object-contain p-4 transition-[filter] duration-500",
                        active.useAi && active.aiImage && !active.aiFinal ? "blur-2xl" : "blur-0",
                      )}
                    />
                  ) : (
                    <div className="text-center text-surface-foreground/60">
                      <ImagePlus className="mx-auto h-8 w-8" />
                    </div>
                  )}
                  {active.generating && (
                    <span className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-4 py-1.5 text-xs font-bold text-primary-foreground">
                      Creo la foto da catalogo…
                    </span>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    disabled={active.generating}
                    onChange={(e) => {
                      if (e.target.files?.[0]) {
                        const f = e.target.files[0];
                        URL.revokeObjectURL(active.preview);
                        updateDraft(active.id, { file: f, preview: URL.createObjectURL(f), aiImage: null, aiFinal: false });
                      }
                      e.target.value = "";
                    }}
                  />
                </label>

                <p className="text-xs font-semibold text-muted-foreground">
                  La foto viene ripulita automaticamente con AI: sfondo uniforme, bordi rifiniti e capo centrato. Puoi comunque usare l’originale se preferisci.
                </p>

                <div className="flex flex-wrap gap-2">
                  {!active.aiImage || !active.aiFinal ? (
                    <Button
                      type="button"
                      onClick={() => makeCatalogPhoto(active)}
                      disabled={active.generating}
                      className="h-11 flex-1 rounded-full font-bold"
                    >
                      {active.generating ? <><Loader2 className="mr-1 h-4 w-4 animate-spin" /> Attendi…</> : <><Wand2 className="mr-1 h-4 w-4" /> Crea foto da catalogo con AI</>}
                    </Button>
                  ) : (
                    <>
                      <div className="flex flex-1 rounded-full bg-secondary p-1">
                        {[true, false].map((v) => (
                          <button
                            type="button"
                            key={String(v)}
                            onClick={() => updateDraft(active.id, { useAi: v })}
                            className={cn(
                              "flex-1 rounded-full py-2 text-sm font-bold",
                              active.useAi === v ? "bg-primary text-primary-foreground" : "text-secondary-foreground",
                            )}
                          >
                            {v ? "Foto AI" : "Originale"}
                          </button>
                        ))}
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => makeCatalogPhoto(active)}
                        className="h-11 rounded-full font-bold"
                        aria-label="Rifai foto AI"
                      >
                        <RotateCcw className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Input
                    placeholder="Colore"
                    value={active.color}
                    onChange={(e) => updateDraft(active.id, { color: e.target.value })}
                    maxLength={40}
                    className="h-11 rounded-full px-5"
                  />
                  <Input
                    placeholder="Stile (es. casual)"
                    value={active.style}
                    onChange={(e) => updateDraft(active.id, { style: e.target.value })}
                    maxLength={40}
                    className="h-11 rounded-full px-5"
                  />
                </div>
              </div>
            )}

            {active?.saved && (
              <div className="flex flex-col items-center gap-3 rounded-3xl bg-secondary p-8 text-center">
                <Check className="h-10 w-10 text-primary" />
                <p className="font-bold text-foreground">Capo salvato nel guardaroba</p>
              </div>
            )}

            <Button
              onClick={saveAll}
              disabled={savingAll || processing || unsavedCount === 0}
              className="h-12 w-full rounded-full text-base font-bold"
            >
              {savingAll ? (
                <><Loader2 className="mr-1 h-5 w-5 animate-spin" /> Salvataggio…</>
              ) : processing ? (
                <><Loader2 className="mr-1 h-5 w-5 animate-spin" /> Pulizia foto…</>
              ) : unsavedCount > 1 ? (
                `Salva ${unsavedCount} capi`
              ) : unsavedCount === 1 ? (
                "Salva capo"
              ) : (
                "Chiudi"
              )}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
