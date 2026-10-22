import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowUp, Bookmark, Wand2 } from "lucide-react";
import { toast } from "sonner";
import type { ChatOutfit, ChatReply } from "@/lib/chat.functions";
import { saveOutfit, useImageUrls, useItems } from "@/lib/wardrobe";
import { OutfitBoard } from "@/components/OutfitBoard";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/chat")({
  head: () => ({
    meta: [
      { title: "Chat AI — Armadio" },
      { name: "description", content: "Chiedi all'AI un outfit con i tuoi capi." },
      { property: "og:title", content: "Chat AI — Armadio" },
      { property: "og:description", content: "Chiedi all'AI un outfit con i tuoi capi." },
    ],
  }),
  component: ChatPage,
});

type Msg = { role: "user" | "assistant"; content: string; outfits?: ChatOutfit[]; error?: boolean };

const SUGGESTIONS = ["Pranzo informale", "Qualcosa di più elegante", "Serata con amici", "Outfit sportivo per il weekend"];

function ChatPage() {
  const qc = useQueryClient();
  const { data: items } = useItems();
  const { data: urls } = useImageUrls(items);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function send(text: string) {
    const content = text.trim();
    if (!content || loading) return;
    const next = [...messages, { role: "user" as const, content }];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      const history = next.slice(-10).map((m) => ({
        role: m.role,
        content:
          m.content +
          (m.outfits?.length ? `\n[Outfit proposti: ${m.outfits.map((o) => `${o.name} (${o.item_ids.join(",")})`).join("; ")}]` : "") || "…",
      }));
      const { data: sessionData } = await (await import("@/integrations/supabase/client")).supabase.auth.getSession();
      const response = await fetch("/api/stylist", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${sessionData.session?.access_token ?? ""}` },
        body: JSON.stringify({ messages: history }),
      });
      const res = (await response.json()) as ChatReply;
      if (!response.ok || res.error) setMessages((m) => [...m, { role: "assistant", content: res.error ?? "La Chat AI non è disponibile al momento.", error: true }]);
      else setMessages((m) => [...m, { role: "assistant", content: res.message, outfits: res.outfits }]);
    } catch (error) {
      console.error("Chat request error", error);
      const message = error instanceof Error ? error.message : String(error);
      setMessages((m) => [...m, { role: "assistant", content: `Errore Chat: ${message}`, error: true }]);
    } finally {
      setLoading(false);
    }
  }

  async function save(o: ChatOutfit, key: string) {
    try {
      await saveOutfit({ name: o.name.slice(0, 80), occasion: o.occasion.slice(0, 60) || null, notes: o.reason, item_ids: o.item_ids });
      setSaved((s) => new Set(s).add(key));
      qc.invalidateQueries({ queryKey: ["outfits"] });
      toast.success("Outfit salvato");
    } catch {
      toast.error("Impossibile salvare");
    }
  }

  return (
    <div className="mx-auto flex max-w-4xl flex-col">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <Wand2 className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-black text-foreground">Stylist AI</h1>
          <p className="text-sm text-muted-foreground">Usa solo i capi del tuo guardaroba</p>
        </div>
      </div>

      <div className="mt-6 flex-1 space-y-6 pb-40">
        {messages.length === 0 && (
          <div className="rounded-3xl bg-secondary p-6">
            <p className="font-bold text-foreground">Che outfit ti serve oggi?</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {SUGGESTIONS.map((s) => (
                <button key={s} onClick={() => send(s)} className="rounded-full border border-border bg-card px-4 py-2 text-sm font-bold text-foreground hover:border-primary">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, idx) =>
          m.role === "user" ? (
            <div key={idx} className="flex justify-end">
              <div className="max-w-[80%] rounded-3xl rounded-br-lg bg-primary px-5 py-3 font-semibold text-primary-foreground">{m.content}</div>
            </div>
          ) : (
            <div key={idx} className="space-y-4">
              {m.content && <p className={m.error ? "font-semibold text-destructive" : "text-foreground"}>{m.content}</p>}
              {m.outfits && m.outfits.length > 0 && (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {m.outfits.map((o, oi) => {
                    const key = `${idx}-${oi}`;
                    const its = (items ?? []).filter((i) => o.item_ids.includes(i.id));
                    return (
                      <article key={key} className="flex flex-col rounded-3xl border border-border bg-card p-3">
                        <OutfitBoard items={its} urls={urls} compact />
                        <div className="flex flex-1 flex-col px-2 pt-3">
                          <h3 className="text-lg font-extrabold text-foreground">{o.name}</h3>
                          <span className="mt-1 w-fit rounded-full bg-accent px-3 py-0.5 text-xs font-bold text-accent-foreground">{o.occasion}</span>
                          <p className="mt-2 flex-1 text-sm text-muted-foreground">{o.reason}</p>
                          <Button
                            onClick={() => save(o, key)}
                            disabled={saved.has(key)}
                            variant={saved.has(key) ? "secondary" : "default"}
                            className="mt-3 rounded-full font-bold"
                          >
                            <Bookmark className="mr-1 h-4 w-4" /> {saved.has(key) ? "Salvato" : "Salva outfit"}
                          </Button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </div>
          ),
        )}
        {loading && (
          <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
            <span className="h-2 w-2 animate-bounce rounded-full bg-primary" />
            <span className="h-2 w-2 animate-bounce rounded-full bg-primary [animation-delay:150ms]" />
            <span className="h-2 w-2 animate-bounce rounded-full bg-primary [animation-delay:300ms]" />
            Sto abbinando i tuoi capi…
          </div>
        )}
        <div ref={endRef} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="fixed inset-x-3 bottom-24 z-20 mx-auto flex max-w-4xl items-end gap-2 rounded-3xl border border-border bg-card p-2 shadow-lg md:bottom-6"
      >
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send(input);
            }
          }}
          placeholder="Es. un outfit più elegante per una cena"
          rows={1}
          maxLength={2000}
          className="min-h-11 resize-none border-0 bg-transparent shadow-none focus-visible:ring-0"
        />
        <Button type="submit" size="icon" disabled={loading || !input.trim()} className="h-11 w-11 shrink-0 rounded-full" aria-label="Invia">
          <ArrowUp className="h-5 w-5" />
        </Button>
      </form>
    </div>
  );
}
