import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { ChatOutfit, ChatReply } from "@/lib/chat.functions";
import type { Database } from "@/integrations/supabase/types";

const inputSchema = z.object({
  messages: z.array(z.object({
    role: z.enum(["user", "assistant"]),
    content: z.string().trim().min(1).max(2000),
  })).min(1).max(20),
});

function createAuthenticatedClient(token: string) {
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"] ?? process.env["SUPABASE_ANON_KEY"];
  if (!url || !key) return null;
  return createClient<Database>(url, key, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    global: {
      headers: { Authorization: `Bearer ${token}` },
      fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        headers.set("apikey", key);
        headers.set("Authorization", `Bearer ${token}`);
        return fetch(input, { ...init, headers });
      },
    },
  });
}

export const Route = createFileRoute("/api/stylist")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const authorization = request.headers.get("authorization") ?? "";
          const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
          const supabase = token ? createAuthenticatedClient(token) : null;
          if (!supabase) return Response.json({ message: "", outfits: [], error: "Sessione non valida." } satisfies ChatReply, { status: 401 });

          const { data: userData, error: authError } = await supabase.auth.getUser(token);
          if (authError || !userData.user) return Response.json({ message: "", outfits: [], error: "Sessione non valida." } satisfies ChatReply, { status: 401 });

          const parsed = inputSchema.safeParse(await request.json());
          if (!parsed.success) return Response.json({ message: "", outfits: [], error: "Richiesta non valida." } satisfies ChatReply, { status: 400 });

          const { data: items, error } = await supabase
            .from("items")
            .select("id, name, category, color, style, favorite");
          if (error) return Response.json({ message: "", outfits: [], error: "Non riesco a leggere il tuo guardaroba." } satisfies ChatReply, { status: 500 });
          if (!items || items.length < 2) {
            return Response.json({ message: "", outfits: [], error: "Aggiungi almeno qualche capo al guardaroba prima di chiedere un outfit." } satisfies ChatReply);
          }

          const apiKey = process.env["GEMINI_API_KEY"];
          if (!apiKey) return Response.json({ message: "", outfits: [], error: "Chat AI non configurata." } satisfies ChatReply, { status: 500 });
          const schema = z.object({
            message: z.string(),
            outfits: z.array(z.object({
              name: z.string(),
              occasion: z.string(),
              reason: z.string(),
              item_ids: z.array(z.string()),
            })),
          });
          const wardrobe = items.map((i) => ({ id: i.id, nome: i.name, categoria: i.category, colore: i.color, stile: i.style, preferito: i.favorite }));
          const system = `Sei uno stylist personale italiano. Crea outfit usando SOLO gli id del guardaroba.
Regole: proponi 2 o 3 outfit; massimo un capo per categoria tra giubbotti, felpe, maglie, pantaloni e scarpe; fino a 2 accessori; includi maglia o felpa, pantaloni e scarpe quando disponibili; non inventare capi; rispondi in italiano.
Guardaroba: ${JSON.stringify(wardrobe)}`;
          const body = JSON.stringify({
            systemInstruction: { parts: [{ text: system }] },
            contents: parsed.data.messages.map((message) => ({ role: message.role === "assistant" ? "model" : "user", parts: [{ text: message.content }] })),
            generationConfig: {
              responseMimeType: "application/json",
              responseSchema: {
                type: "OBJECT",
                properties: {
                  message: { type: "STRING" },
                  outfits: {
                    type: "ARRAY",
                    items: {
                      type: "OBJECT",
                      properties: {
                        name: { type: "STRING" },
                        occasion: { type: "STRING" },
                        reason: { type: "STRING" },
                        item_ids: { type: "ARRAY", items: { type: "STRING" } },
                      },
                      required: ["name", "occasion", "reason", "item_ids"],
                    },
                  },
                },
                required: ["message", "outfits"],
              },
            },
          });
          const models = ["gemini-3.5-flash-lite", "gemini-3.8-flash"];
          let result: z.infer<typeof schema> | null = null;
          let lastError: Error | null = null;
          for (const model of models) {
            try {
              const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body,
              });
              const responseBody = await response.text();
              if (!response.ok) {
                console.error(`Gemini API error (${model})`, { status: response.status, statusText: response.statusText, body: responseBody });
                let apiMessage = responseBody || response.statusText || "Risposta vuota";
                try {
                  const errorBody = JSON.parse(responseBody) as { error?: { message?: string } };
                  apiMessage = errorBody.error?.message ?? apiMessage;
                } catch {
                  // Keep the exact non-JSON response in the error shown to the user.
                }
                const err = Object.assign(new Error(`Gemini API ${response.status}: ${apiMessage}`), { statusCode: response.status });
                if ((response.status === 503 || response.status === 429) && model !== models[models.length - 1]) {
                  lastError = err;
                  console.warn(`Modello ${model} non disponibile (${response.status}), provo il fallback…`);
                  continue;
                }
                throw err;
              }
              const payload = JSON.parse(responseBody) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
              const text = payload.candidates?.[0]?.content?.parts?.[0]?.text;
              if (!text) throw new Error(`Gemini (${model}) returned no content`);
              result = schema.parse(JSON.parse(text));
              break;
            } catch (err) {
              if (err instanceof Error && "statusCode" in err && ((err as { statusCode: number }).statusCode === 503 || (err as { statusCode: number }).statusCode === 429) && model !== models[models.length - 1]) {
                lastError = err instanceof Error ? err : new Error(String(err));
                continue;
              }
              throw err;
            }
          }
          if (!result) throw lastError ?? new Error("Nessuna risposta dai modelli Gemini.");
          const valid = new Set(items.map((i) => i.id));
          const outfits: ChatOutfit[] = result.outfits
            .map((outfit) => ({ ...outfit, item_ids: [...new Set(outfit.item_ids)].filter((id) => valid.has(id)) }))
            .filter((outfit) => outfit.item_ids.length >= 2)
            .slice(0, 3);
          return Response.json({ message: result.message, outfits, error: null } satisfies ChatReply);
        } catch (error) {
          console.error("stylist request failed", error);
          const status = typeof error === "object" && error !== null && "statusCode" in error ? Number(error.statusCode) : 500;
          const errorMessage = error instanceof Error ? error.message : String(error);
          const message = status > 0 && status < 600 ? errorMessage : `Server error: ${errorMessage}`;
          return Response.json({ message: "", outfits: [], error: message } satisfies ChatReply, { status: status > 0 && status < 600 ? status : 500 });
        }
      },
    },
  },
});
