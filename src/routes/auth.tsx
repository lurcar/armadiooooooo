import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Accedi — Armadio" },
      { name: "description", content: "Accedi al tuo guardaroba personale." },
      { property: "og:title", content: "Accedi — Armadio" },
      { property: "og:description", content: "Accedi al tuo guardaroba personale." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "in") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/", replace: true });
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        if (data.session) navigate({ to: "/", replace: true });
        else toast.success("Controlla la tua email per confermare l'account.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Errore di accesso");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <form onSubmit={submit} className="w-full max-w-sm space-y-5 rounded-3xl border border-border bg-card p-8 shadow-sm">
        <div className="text-center">
          <h1 className="text-3xl font-extrabold text-foreground">
            Armadio<span className="text-primary">.</span>
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {mode === "in" ? "Entra nel tuo guardaroba" : "Crea il tuo account"}
          </p>
        </div>
        <Input type="email" required placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} className="h-12 rounded-full px-5" />
        <Input type="password" required minLength={6} placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} className="h-12 rounded-full px-5" />
        <Button type="submit" disabled={loading} className="h-12 w-full rounded-full text-base font-bold">
          {loading ? "Attendi…" : mode === "in" ? "Accedi" : "Registrati"}
        </Button>
        <button type="button" onClick={() => setMode(mode === "in" ? "up" : "in")} className="w-full text-center text-sm font-semibold text-primary">
          {mode === "in" ? "Non hai un account? Registrati" : "Hai già un account? Accedi"}
        </button>
      </form>
    </div>
  );
}
