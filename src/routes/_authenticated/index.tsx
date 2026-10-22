import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Heart, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { CATEGORIES, categoryLabel, useImageUrls, useItems, type Category } from "@/lib/wardrobe";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AddItemDialog } from "@/components/AddItemDialog";
import { WeatherCard } from "@/components/WeatherCard";
import { useProfile } from "@/components/AppShell";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [
      { title: "Guardaroba — Armadio" },
      { name: "description", content: "Tutti i tuoi capi divisi per categoria." },
      { property: "og:title", content: "Guardaroba — Armadio" },
      { property: "og:description", content: "Tutti i tuoi capi divisi per categoria." },
    ],
  }),
  component: WardrobePage,
});

function WardrobePage() {
  const qc = useQueryClient();
  const { data: items, isLoading } = useItems();
  const { data: urls } = useImageUrls(items);
  const [cat, setCat] = useState<Category | "tutti" | "preferiti">("tutti");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const { data: profile } = useProfile();

  const filtered = useMemo(
    () =>
      (items ?? []).filter(
        (i) =>
          (cat === "tutti" || (cat === "preferiti" ? i.favorite : i.category === cat)) &&
          i.name.toLowerCase().includes(q.toLowerCase()),
      ),
    [items, cat, q],
  );

  async function toggleFav(id: string, favorite: boolean) {
    const { error } = await supabase.from("items").update({ favorite: !favorite }).eq("id", id);
    if (error) { toast.error("Errore"); return; }
    qc.invalidateQueries({ queryKey: ["items"] });
  }

  async function remove(id: string, path: string) {
    const { error } = await supabase.from("items").delete().eq("id", id);
    if (error) { toast.error("Impossibile eliminare"); return; }
    await supabase.storage.from("wardrobe").remove([path]);
    toast.success("Capo eliminato");
    qc.invalidateQueries({ queryKey: ["items"] });
    qc.invalidateQueries({ queryKey: ["outfits"] });
  }

  const pills: { value: typeof cat; label: string }[] = [
    { value: "tutti", label: "Tutti" },
    ...CATEGORIES,
    { value: "preferiti", label: "♥ Preferiti" },
  ];

  return (
    <div>
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-black tracking-tight text-foreground md:text-4xl">Il mio guardaroba</h1>
          <p className="mt-0.5 text-sm font-semibold text-muted-foreground">{filtered.length} articoli</p>
        </div>
        <Button onClick={() => setOpen(true)} className="h-10 shrink-0 rounded-full px-4 text-sm font-bold md:h-11 md:px-6 md:text-base">
          <Plus className="mr-1 h-4 w-4" /> Aggiungi
        </Button>
      </div>

      <WeatherCard name={profile?.display_name ?? ""} items={items ?? []} />

      <div className="mt-5 flex flex-col gap-3 md:flex-row md:items-center">
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] md:mx-0 md:flex-wrap md:px-0 [&::-webkit-scrollbar]:hidden">
          {pills.map((p) => (
            <button
              key={p.value}
              onClick={() => setCat(p.value)}
              className={cn(
                "shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-bold transition-colors md:px-4 md:py-2",
                cat === p.value
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-foreground hover:border-primary/50",
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="relative md:ml-auto md:w-60">
          <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cerca…" className="h-10 rounded-full pl-10" />
        </div>
      </div>

      {isLoading ? (
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 md:gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="aspect-square animate-pulse rounded-2xl bg-muted md:rounded-3xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="mt-8 rounded-3xl border border-dashed border-border p-8 text-center md:mt-10 md:p-12">
          <p className="font-bold text-foreground">Nessun capo qui</p>
          <p className="mt-1 text-sm text-muted-foreground">Aggiungi il tuo primo vestito con una foto.</p>
          <Button onClick={() => setOpen(true)} className="mt-4 rounded-full font-bold">Aggiungi vestiti</Button>
        </div>
      ) : (
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 md:gap-4">
          {filtered.map((i) => (
            <div key={i.id} className="group overflow-hidden rounded-2xl border border-border bg-card md:rounded-3xl">
              <div className="relative aspect-square bg-surface p-3 md:p-4">
                {urls?.[i.image_path] && (
                  <img src={urls[i.image_path]} alt={i.name} loading="lazy" className="h-full w-full object-contain" />
                )}
                <button
                  onClick={() => toggleFav(i.id, i.favorite)}
                  aria-label="Preferito"
                  className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-card shadow-sm md:right-3 md:top-3 md:h-9 md:w-9"
                >
                  <Heart className={cn("h-4 w-4", i.favorite ? "fill-primary text-primary" : "text-muted-foreground")} />
                </button>
              </div>
              <div className="flex items-start justify-between gap-2 p-3 md:p-4">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-foreground md:text-base">{i.name}</p>
                  <p className="truncate text-xs font-semibold text-muted-foreground">
                    {i.brand ? `${i.brand} · ` : ""}
                    {categoryLabel(i.category)}
                    {i.color ? ` · ${i.color}` : ""}
                  </p>
                </div>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <button aria-label="Elimina" className="shrink-0 rounded-full p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="rounded-3xl">
                    <AlertDialogHeader>
                      <AlertDialogTitle>Eliminare "{i.name}"?</AlertDialogTitle>
                      <AlertDialogDescription>Il capo verrà tolto anche dagli outfit che lo contengono.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel className="rounded-full">Annulla</AlertDialogCancel>
                      <AlertDialogAction className="rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => remove(i.id, i.image_path)}>
                        Elimina
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          ))}
        </div>
      )}

      <AddItemDialog open={open} onOpenChange={setOpen} defaultCategory={cat !== "tutti" && cat !== "preferiti" ? cat : undefined} />
    </div>
  );
}
