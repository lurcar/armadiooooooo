import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, BriefcaseBusiness, Check, Footprints, Layers3, Shirt, Sparkles, Watch } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { saveOutfit, useImageUrls, useItems, useOutfits, type Category } from "@/lib/wardrobe";
import { OutfitBoard } from "@/components/OutfitBoard";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/crea-outfit")({
  validateSearch: z.object({ id: z.string().optional() }),
  head: () => ({
    meta: [
      { title: "Crea Outfit — Armadio" },
      { name: "description", content: "Combina i tuoi capi e salva un nuovo outfit." },
    ],
  }),
  component: CreateOutfit,
});

type PickerKey = "top" | "outer" | Category;
type PickerOption = { key: PickerKey; label: string; categories: Category[]; icon: LucideIcon };

const PICKER_OPTIONS: PickerOption[] = [
  { key: "top", label: "Maglie", categories: ["maglie"], icon: Shirt },
  { key: "outer", label: "Felpe e giubbotti", categories: ["felpe", "giubbotti"], icon: BriefcaseBusiness },
  { key: "pantaloni", label: "Pantaloni", categories: ["pantaloni"], icon: Layers3 },
  { key: "scarpe", label: "Scarpe", categories: ["scarpe"], icon: Footprints },
  { key: "accessori", label: "Accessori", categories: ["accessori"], icon: Watch },
];

function CreateOutfit() {
  const { id } = Route.useSearch();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: items } = useItems();
  const { data: outfits } = useOutfits();
  const { data: urls } = useImageUrls(items);
  const [picker, setPicker] = useState<PickerKey | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [occasion, setOccasion] = useState("");
  const [saving, setSaving] = useState(false);

  const editing = outfits?.find((o) => o.id === id);
  useEffect(() => {
    if (editing) {
      setSelected(editing.item_ids);
      setName(editing.name);
      setOccasion(editing.occasion ?? "");
    }
  }, [editing]);

  const chosen = useMemo(() => (items ?? []).filter((item) => selected.includes(item.id)), [items, selected]);
  const activeOption = PICKER_OPTIONS.find((option) => option.key === picker);
  const pickerItems = useMemo(
    () => (items ?? []).filter((item) => activeOption?.categories.includes(item.category)),
    [items, activeOption],
  );

  const toggle = (itemId: string) =>
    setSelected((current) => (current.includes(itemId) ? current.filter((value) => value !== itemId) : [...current, itemId]));

  async function save() {
    if (!name.trim()) { toast.error("Dai un nome all'outfit"); return; }
    if (selected.length < 2) { toast.error("Scegli almeno 2 capi"); return; }
    setSaving(true);
    try {
      await saveOutfit({ id, name: name.trim().slice(0, 80), occasion: occasion.trim().slice(0, 60) || null, item_ids: selected });
      toast.success("Outfit salvato");
      qc.invalidateQueries({ queryKey: ["outfits"] });
      navigate({ to: "/outfit" });
    } catch {
      toast.error("Non è stato possibile salvare l'outfit");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto min-w-0 max-w-2xl pb-4">
      <div className="flex items-center gap-3">
        <Button asChild variant="outline" size="icon" className="h-10 w-10 shrink-0 rounded-full">
          <Link to="/outfit" aria-label="Torna agli outfit"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-black tracking-tight text-foreground md:text-4xl">{editing ? "Modifica outfit" : "Crea outfit"}</h1>
          <p className="text-sm font-semibold text-muted-foreground">Scegli i capi per comporre il tuo look</p>
        </div>
      </div>

      <section className="mt-5 rounded-[2rem] bg-card p-2 shadow-sm md:p-4">
        <OutfitBoard items={chosen} urls={urls} onRemove={toggle} className="aspect-[4/5] md:aspect-[4/5]" />
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {PICKER_OPTIONS.map((option) => {
            const Icon = option.icon;
            const count = chosen.filter((item) => option.categories.includes(item.category)).length;
            return (
              <button
                key={option.key}
                type="button"
                onClick={() => setPicker(option.key)}
                className="flex min-h-16 items-center gap-3 rounded-2xl border border-border bg-background px-3 py-3 text-left transition-colors hover:border-primary hover:bg-primary/5"
              >
                <Icon className="h-5 w-5 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-extrabold text-foreground">{option.label}</span>
                  <span className="text-xs font-semibold text-muted-foreground">{count ? `${count} selezionati` : "Aggiungi capo"}</span>
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="mt-4 grid gap-3 sm:grid-cols-2">
        <Input placeholder="Nome outfit" value={name} onChange={(event) => setName(event.target.value)} maxLength={80} className="h-12 rounded-2xl px-4" />
        <Input placeholder="Occasione (es. pranzo informale)" value={occasion} onChange={(event) => setOccasion(event.target.value)} maxLength={60} className="h-12 rounded-2xl px-4" />
      </section>
      <Button onClick={save} disabled={saving} className="mt-3 h-12 w-full rounded-2xl text-base font-bold">
        {saving ? "Salvataggio…" : `Salva outfit${selected.length ? ` (${selected.length} capi)` : ""}`}
      </Button>

      <Dialog open={picker !== null} onOpenChange={(open) => !open && setPicker(null)}>
        <DialogContent className="max-h-[88vh] w-[calc(100%-1rem)] max-w-2xl overflow-y-auto rounded-[2rem] p-4 sm:p-6">
          <DialogHeader className="pr-8">
            <DialogTitle className="text-2xl font-black">Seleziona elemento</DialogTitle>
            <DialogDescription>
              {activeOption?.label} · tocca un capo per aggiungerlo o rimuoverlo
            </DialogDescription>
          </DialogHeader>
          {pickerItems.length === 0 ? (
            <div className="rounded-3xl bg-surface p-10 text-center">
              <Sparkles className="mx-auto h-8 w-8 text-muted-foreground" />
              <p className="mt-3 font-bold text-foreground">Nessun capo disponibile</p>
              <p className="mt-1 text-sm text-muted-foreground">Aggiungi prima un articolo al guardaroba.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {pickerItems.map((item) => {
                const isSelected = selected.includes(item.id);
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => toggle(item.id)}
                    className={cn(
                      "relative overflow-hidden rounded-2xl border-2 bg-surface p-2 text-left transition",
                      isSelected ? "border-primary ring-2 ring-primary/20" : "border-transparent hover:border-border",
                    )}
                  >
                    <div className="aspect-square overflow-hidden rounded-xl">
                      {urls?.[item.image_path] ? <img src={urls[item.image_path]} alt={item.name} className="h-full w-full object-contain" /> : null}
                    </div>
                    <p className="mt-2 truncate text-sm font-bold text-surface-foreground">{item.name}</p>
                    {isSelected && <span className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground"><Check className="h-4 w-4" /></span>}
                  </button>
                );
              })}
            </div>
          )}
          <Button type="button" onClick={() => setPicker(null)} className="h-12 w-full rounded-2xl font-bold">
            Conferma selezione
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
