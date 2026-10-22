import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useItems, useOutfits } from "@/lib/wardrobe";
import { useProfile } from "@/components/AppShell";
import { getTheme, setTheme, type Theme } from "@/lib/theme";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/profilo")({
  head: () => ({
    meta: [
      { title: "Profilo e impostazioni — Armadio" },
      { name: "description", content: "Il tuo profilo e le preferenze dell'app." },
      { property: "og:title", content: "Profilo e impostazioni — Armadio" },
      { property: "og:description", content: "Il tuo profilo e le preferenze dell'app." },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data: profile } = useProfile();
  const { data: items } = useItems();
  const { data: outfits } = useOutfits();
  const [name, setName] = useState("");
  const [theme, setThemeState] = useState<Theme>("light");

  useEffect(() => {
    setThemeState(getTheme());
  }, []);
  useEffect(() => {
    if (profile) setName(profile.display_name);
  }, [profile]);

  async function saveName() {
    if (!profile) return;
    const { error } = await supabase.from("profiles").upsert({ id: profile.id, display_name: name.trim().slice(0, 60) });
    if (error) { toast.error("Errore"); return; }
    toast.success("Nome aggiornato");
    qc.invalidateQueries({ queryKey: ["profile"] });
  }

  function chooseTheme(t: Theme) {
    setTheme(t);
    setThemeState(t);
  }

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <div className="flex flex-col items-center rounded-3xl border border-border bg-card p-8 text-center">
        <div className="flex h-24 w-24 items-center justify-center rounded-full bg-primary text-4xl font-black text-primary-foreground">
          {(profile?.display_name || "?").charAt(0).toUpperCase()}
        </div>
        <h1 className="mt-4 text-2xl font-black text-foreground">{profile?.display_name}</h1>
        <p className="text-sm text-muted-foreground">{profile?.email}</p>
        <div className="mt-6 grid w-full grid-cols-2 gap-3">
          <div className="rounded-2xl bg-secondary p-4">
            <p className="text-3xl font-black text-primary">{items?.length ?? 0}</p>
            <p className="text-xs font-bold text-muted-foreground">Capi</p>
          </div>
          <div className="rounded-2xl bg-secondary p-4">
            <p className="text-3xl font-black text-primary">{outfits?.length ?? 0}</p>
            <p className="text-xs font-bold text-muted-foreground">Outfit</p>
          </div>
        </div>
      </div>

      <section className="rounded-3xl border border-border bg-card p-6">
        <h2 className="font-extrabold text-foreground">Nome</h2>
        <div className="mt-3 flex gap-2">
          <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} className="h-11 rounded-full px-5" />
          <Button onClick={saveName} className="h-11 rounded-full px-6 font-bold">Salva</Button>
        </div>
      </section>

      <section className="rounded-3xl border border-border bg-card p-6">
        <h2 className="font-extrabold text-foreground">Sfondo</h2>
        <div className="mt-3 grid grid-cols-2 gap-3">
          {(["light", "dark"] as const).map((t) => (
            <button
              key={t}
              onClick={() => chooseTheme(t)}
              className={cn(
                "flex items-center gap-3 rounded-2xl border-2 p-4 text-left font-bold text-foreground",
                theme === t ? "border-primary" : "border-border",
              )}
            >
              <span className={cn("h-8 w-8 rounded-full border border-border", t === "light" ? "bg-[oklch(1_0_0)]" : "bg-[oklch(0_0_0)]")} />
              {t === "light" ? "Bianco" : "Nero"}
            </button>
          ))}
        </div>
      </section>

      <Button variant="outline" onClick={signOut} className="h-12 w-full rounded-full font-bold">Esci</Button>
    </div>
  );
}
