import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Pencil, Trash2, Shirt } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useImageUrls, useItems, useOutfits } from "@/lib/wardrobe";
import { OutfitBoard } from "@/components/OutfitBoard";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_authenticated/outfit")({
  head: () => ({
    meta: [
      { title: "I miei outfit — Armadio" },
      { name: "description", content: "Gli outfit che hai salvato." },
      { property: "og:title", content: "I miei outfit — Armadio" },
      { property: "og:description", content: "Gli outfit che hai salvato." },
    ],
  }),
  component: OutfitsPage,
});

function OutfitsPage() {
  const qc = useQueryClient();
  const { data: outfits, isLoading } = useOutfits();
  const { data: items } = useItems();
  const { data: urls } = useImageUrls(items);

  async function wear(id: string, count: number) {
    const { error } = await supabase.from("outfits").update({ worn_count: count + 1, last_worn: new Date().toISOString() }).eq("id", id);
    if (error) { toast.error("Errore"); return; }
    toast.success("Segnato come indossato oggi");
    qc.invalidateQueries({ queryKey: ["outfits"] });
  }
  async function remove(id: string) {
    const { error } = await supabase.from("outfits").delete().eq("id", id);
    if (error) { toast.error("Errore"); return; }
    qc.invalidateQueries({ queryKey: ["outfits"] });
  }

  return (
    <div>
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-foreground md:text-4xl">I miei outfit</h1>
          <p className="mt-0.5 text-sm font-semibold text-muted-foreground">{outfits?.length ?? 0} outfit salvati</p>
        </div>
        <Button asChild className="h-10 shrink-0 rounded-full px-4 text-sm font-bold md:h-11 md:px-6 md:text-base">
          <Link to="/crea-outfit">Crea outfit</Link>
        </Button>
      </div>

      {isLoading ? null : !outfits?.length ? (
        <div className="mt-8 rounded-3xl border border-dashed border-border p-8 text-center md:mt-10 md:p-12">
          <p className="font-bold text-foreground">Ancora nessun outfit</p>
          <p className="mt-1 text-sm text-muted-foreground">Creane uno a mano o chiedi alla Chat AI.</p>
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-2 gap-3 overflow-hidden sm:grid-cols-2 lg:grid-cols-3 md:mt-6 md:gap-5">
          {outfits.map((o) => {
            const its = (items ?? []).filter((i) => o.item_ids.includes(i.id));
            return (
              <article key={o.id} className="flex min-w-0 flex-col overflow-hidden rounded-2xl border border-border bg-card p-2 md:rounded-3xl md:p-3">
                <OutfitBoard items={its} urls={urls} compact />
                <div className="px-1 pb-1 pt-2 md:px-2 md:pt-3">
                  <div className="flex items-start justify-between gap-1.5 md:gap-2">
                    <div className="min-w-0 flex-1">
                      <h2 className="truncate text-sm font-extrabold text-foreground md:text-lg">{o.name}</h2>
                      {o.occasion && (
                        <span className="mt-1 inline-block rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold text-accent-foreground md:px-3 md:text-xs">{o.occasion}</span>
                      )}
                    </div>
                    <div className="flex shrink-0 gap-0.5 md:gap-1">
                      <Link to="/crea-outfit" search={{ id: o.id }} aria-label="Modifica" className="rounded-full p-1.5 text-muted-foreground hover:bg-secondary md:p-2">
                        <Pencil className="h-3.5 w-3.5 md:h-4 md:w-4" />
                      </Link>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <button aria-label="Elimina" className="rounded-full p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive md:p-2">
                            <Trash2 className="h-3.5 w-3.5 md:h-4 md:w-4" />
                          </button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="rounded-3xl">
                          <AlertDialogHeader>
                            <AlertDialogTitle>Eliminare "{o.name}"?</AlertDialogTitle>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel className="rounded-full">Annulla</AlertDialogCancel>
                            <AlertDialogAction className="rounded-full bg-destructive text-destructive-foreground" onClick={() => remove(o.id)}>Elimina</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-2 text-[10px] font-semibold text-muted-foreground md:mt-3 md:text-xs">
                    <span className="truncate">
                      {o.worn_count} {o.worn_count === 1 ? "volta" : "volte"}
                      {o.last_worn ? ` · ${new Date(o.last_worn).toLocaleDateString("it-IT")}` : ""}
                    </span>
                    <button onClick={() => wear(o.id, o.worn_count)} className="flex shrink-0 items-center gap-1 rounded-full border border-border px-2 py-0.5 font-bold text-foreground hover:border-primary md:px-3 md:py-1">
                      <Shirt className="h-3 w-3 md:h-3.5 md:w-3.5" /> Oggi
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
