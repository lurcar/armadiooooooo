import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { editImage, imageSettings } from "@/lib/image-gateway.server";

async function isSignedIn(request: Request) {
  const auth = request.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (token.split(".").length !== 3) return false;
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  const supabase = createClient(process.env["SUPABASE_URL"]!, key, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
  const { data, error } = await supabase.auth.getUser(token);
  return !error && !!data.user;
}

function buildPrompt(name: string, brand: string, category: string) {
  const what = [brand, name].filter(Boolean).join(" ") || category;
  return `Turn this photo into a professional e-commerce product photo of the garment "${what}" (${category}), as it would appear on the official ${brand || "brand"} online store.
- Keep the EXACT same item: same color, fabric, pattern, logos, prints, text, stitching and details. Do not invent or change design elements.
- Show only the item, front view, perfectly centered and straight, symmetrical, neatly shaped like a ghost-mannequin or a perfectly laid-flat catalog shot. For shoes: a clean side profile of the pair. For accessories: clean front view.
- Completely smooth and pressed: no wrinkles, no creases, no folds, no lint.
- Remove everything else: no hands, no people, no hanger, no bed, no floor, no shadows from the room.
- Transparent background with no rectangle, no black pixels around the item, soft even studio lighting, sharp focus, the item fills most of the frame with a small margin.
- The result should look identical to a product photo from a high-end online fashion retailer: crisp, clean, professional.`;
}

export const Route = createFileRoute("/api/clean-image")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!(await isSignedIn(request))) return new Response("Unauthorized", { status: 401 });
        const apiKey = process.env["LOVABLE_API_KEY"];
        if (!apiKey) return new Response("Missing LOVABLE_API_KEY", { status: 500 });

        const incoming = await request.formData();
        const image = incoming.get("image");
        if (!(image instanceof File) || image.size > 15 * 1024 * 1024) {
          return new Response("Foto mancante o troppo grande", { status: 400 });
        }
        const str = (k: string) => String(incoming.get(k) ?? "").slice(0, 80);

        const form = new FormData();
        form.set("image", image);
        form.set("prompt", buildPrompt(str("name"), str("brand"), str("category")));
        form.set("background", "transparent");
        form.set("output_format", "png");
        form.set("quality", "high");
        form.set("size", "1024x1024");
        form.set("stream", incoming.get("stream") === "false" ? "false" : "true");

        const upstream = await editImage({ ...imageSettings, apiKey }, form);
        return new Response(upstream.body, {
          status: upstream.status,
          headers: {
            "Content-Type": upstream.headers.get("Content-Type") ?? "application/json",
            "Cache-Control": "no-cache",
          },
        });
      },
    },
  },
});
