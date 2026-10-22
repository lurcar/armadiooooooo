import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type Category = Database["public"]["Enums"]["item_category"];
export type Item = Database["public"]["Tables"]["items"]["Row"];
export type Outfit = Database["public"]["Tables"]["outfits"]["Row"] & { item_ids: string[] };

export const CATEGORIES: { value: Category; label: string }[] = [
  { value: "giubbotti", label: "Giubbotti" },
  { value: "felpe", label: "Felpe" },
  { value: "maglie", label: "Maglie" },
  { value: "pantaloni", label: "Pantaloni" },
  { value: "scarpe", label: "Scarpe" },
  { value: "accessori", label: "Accessori" },
];

export const categoryLabel = (c: Category) => CATEGORIES.find((x) => x.value === c)?.label ?? c;

export const itemsQuery = {
  queryKey: ["items"],
  queryFn: async (): Promise<Item[]> => {
    const { data, error } = await supabase.from("items").select("*").order("created_at", { ascending: false });
    if (error) throw error;
    return data;
  },
};

export const outfitsQuery = {
  queryKey: ["outfits"],
  queryFn: async (): Promise<Outfit[]> => {
    const { data, error } = await supabase
      .from("outfits")
      .select("*, outfit_items(item_id)")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data.map(({ outfit_items, ...o }) => ({ ...o, item_ids: outfit_items.map((x) => x.item_id) }));
  },
};

export function useItems() {
  return useQuery(itemsQuery);
}
export function useOutfits() {
  return useQuery(outfitsQuery);
}

/** Signed URLs for all item photos, keyed by image_path. */
export function useImageUrls(items: Item[] | undefined) {
  const paths = (items ?? []).map((i) => i.image_path).sort();
  return useQuery({
    queryKey: ["signed", paths],
    enabled: paths.length > 0,
    staleTime: 50 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.storage.from("wardrobe").createSignedUrls(paths, 3600);
      if (error) throw error;
      const map: Record<string, string> = {};
      data.forEach((d) => {
        if (d.path && d.signedUrl) map[d.path] = d.signedUrl;
      });
      return map;
    },
  });
}

export async function saveOutfit(input: {
  id?: string | undefined;
  name: string;
  occasion: string | null;
  notes?: string | null;
  item_ids: string[];
}) {
  let id = input.id;
  if (id) {
    const { error } = await supabase
      .from("outfits")
      .update({ name: input.name, occasion: input.occasion, notes: input.notes ?? null })
      .eq("id", id);
    if (error) throw error;
    const { error: delErr } = await supabase.from("outfit_items").delete().eq("outfit_id", id);
    if (delErr) throw delErr;
  } else {
    const { data, error } = await supabase
      .from("outfits")
      .insert({ name: input.name, occasion: input.occasion, notes: input.notes ?? null })
      .select("id")
      .single();
    if (error) throw error;
    id = data.id;
  }
  const { error } = await supabase
    .from("outfit_items")
    .insert(input.item_ids.map((item_id) => ({ outfit_id: id!, item_id })));
  if (error) throw error;
  return id!;
}
